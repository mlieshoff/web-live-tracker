import { createCapture } from "./capture.mjs";
import { validateResearchId } from "./export.mjs";
import { capturePayload, exportPayloads } from "./payload.mjs";

export function createLiveCapture(requestFinished, downloads, onStatus, now = Date.now) {
  let researchId;
  let active = false;
  let queue = Promise.resolve();
  let captured = 0;
  let pending = 0;
  let saved = 0;
  let failed = 0;
  let reason = null;

  function publish() {
    onStatus({ active, captured, pending, saved, failed, reason });
  }

  const capture = createCapture(requestFinished, (entry, metadata) => {
    const id = researchId;
    const date = new Date(metadata.timestamp);
    // Read the response while DevTools still has it, and write files in capture order.
    const payload = capturePayload(entry, metadata).catch(() => null);
    captured += 1;
    pending += 1;
    queue = queue.then(async () => {
      try {
        const exchange = await payload;
        if (!exchange) {
          throw new Error("Payload unavailable");
        }
        const result = await exportPayloads(downloads, id, [exchange], date);
        saved += result.saved;
        if (result.failed) {
          failed += 1;
          reason ??= result.reason;
        }
      } catch {
        failed += 1;
        reason ??= "An exchange could not be prepared for saving.";
      } finally {
        pending -= 1;
        publish();
      }
    });
    publish();
  }, now);

  return {
    start(id) {
      if (active || pending > 0) {
        return;
      }
      validateResearchId(id);
      researchId = id;
      captured = 0;
      saved = 0;
      failed = 0;
      reason = null;
      capture.start();
      active = true;
      publish();
    },
    stop() {
      if (active) {
        capture.stop();
        active = false;
        publish();
      }
      return queue;
    },
  };
}
