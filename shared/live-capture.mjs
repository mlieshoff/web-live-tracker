import { createCapture } from "./capture.mjs";
import { DownloadError, exportFolder, validateResearchId } from "./export.mjs";
import { prepareMediaRetry, retryUnavailableMedia } from "./media-retry.mjs";
import { capturePayload, exportPayloads } from "./payload.mjs";
import { captureReport } from "./report.mjs";

const errorHistoryLimit = 30;

export function createLiveCapture({ requestFinished, writeFile, writeReport, readResponseContent, onStatus, now = Date.now }) {
  let researchId;
  let active = false;
  let startedAt;
  let records;
  let unreadable;
  let report;
  let queue = Promise.resolve();
  let captured = 0;
  let pending = 0;
  let saved = 0;
  let failed = 0;
  let errorCount = 0;
  let errors = [];

  function publish() {
    onStatus({ active, captured, pending, saved, failed, errorCount, errors, report });
  }

  function recordErrors(entries) {
    failed += 1;
    errorCount += entries.length;
    errors = [...errors, ...entries].slice(-errorHistoryLimit);
  }

  const capture = createCapture(requestFinished, (entry, metadata) => {
    const id = researchId;
    const date = new Date(metadata.timestamp);
    const retry = prepareMediaRetry(entry, metadata);
    // Read the response while DevTools still has it, and write files in capture order.
    const payload = capturePayload(entry, metadata, readResponseContent).catch(() => null);
    captured += 1;
    pending += 1;
    queue = queue.then(async () => {
      try {
        const exchange = await payload;
        if (!exchange) {
          throw new Error("Payload unavailable");
        }
        exchange.response = await retryUnavailableMedia(retry, exchange.response);
        const result = await exportPayloads(writeFile, id, [exchange], date);
        saved += result.saved;
        if (writeReport) records.push(...result.records);
        if (result.errors.length) {
          recordErrors(result.errors);
        }
      } catch {
        if (writeReport) records.push({ metadata, error: "The files could not be prepared for saving." });
        recordErrors([{
          target: `${metadata.method} ${metadata.url}`,
          reason: "This exchange could not be prepared for saving.",
        }]);
      } finally {
        pending -= 1;
        publish();
      }
    });
    publish();
  }, () => startedAt.getTime());

  return {
    start(id, earlier = { records: [], unreadable: 0 }) {
      if (active || pending > 0 || report?.state === "saving") {
        return;
      }
      validateResearchId(id);
      researchId = id;
      startedAt = new Date(now());
      records = [...earlier.records];
      unreadable = earlier.unreadable;
      report = undefined;
      captured = 0;
      saved = 0;
      failed = 0;
      errorCount = 0;
      errors = [];
      capture.start();
      active = true;
      publish();
    },
    stop() {
      if (active) {
        capture.stop();
        active = false;
        if (writeReport) {
          report = { state: "saving" };
          queue = queue.then(async () => {
            try {
              const folder = exportFolder(researchId, startedAt).split("/").slice(0, -1).join("/");
              const stamp = startedAt.toISOString().replace(/[:.]/g, "-");
              const file = captureReport({ researchId, startedAt, records, unreadable });
              const result = await writeReport(`${folder}/capture-${stamp}.html`, file);
              report = { state: "ready", ...result };
            } catch (error) {
              report = {
                state: "failed",
                error: error instanceof DownloadError ? error.message : "The capture report could not be saved.",
              };
            } finally {
              records = [];
              publish();
            }
          });
        }
        publish();
      }
      return queue;
    },
  };
}
