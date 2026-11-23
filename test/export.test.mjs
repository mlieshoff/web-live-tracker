import assert from "node:assert/strict";
import test from "node:test";
import { downloadFile, exportFolder, jsonFile, validateResearchId } from "../shared/export.mjs";

test("exportFolder puts a valid research ID inside the export folder", () => {
  assert.equal(exportFolder("Research_2026-1", new Date(2026, 0, 3)), "web-live-tracker/Research_2026-1/2026-01-03");
});

test("exportFolder groups captures on either side of local midnight", () => {
  const beforeMidnight = new Date(2025, 11, 31, 23, 59);
  const afterMidnight = new Date(2026, 0, 1, 0, 1);

  assert.deepEqual([beforeMidnight, afterMidnight].map((date) => exportFolder("study", date)), [
    "web-live-tracker/study/2025-12-31",
    "web-live-tracker/study/2026-01-01",
  ]);
});

for (const id of [undefined, "", "../other", "a/b", String.raw`a\b`, "%2e%2e", "/absolute", "CON", "a".repeat(65)]) {
  test(`validateResearchId rejects invalid research ID ${JSON.stringify(id)}`, () => {
    assert.throws(() => validateResearchId(id), /Use 1–64/);
  });
}

function mockDownloads(state) {
  const listeners = new Set();
  const calls = [];

  return {
    calls,
    listeners,
    onChanged: {
      addListener: (listener) => listeners.add(listener),
      removeListener: (listener) => listeners.delete(listener),
    },
    async download({ url, filename, conflictAction }) {
      const response = await fetch(url);
      calls.push({ filename, conflictAction, data: await response.json() });
      return 17;
    },
    async search() {
      if (state !== "in_progress") {
        return [{ state }];
      }

      queueMicrotask(() => {
        for (const listener of listeners) {
          listener({ id: 99, state: { current: "interrupted" } });
          listener({ id: 17, state: { current: "complete" } });
        }
      });
      return [{ state }];
    },
  };
}

test("downloadFile handles completion after download starts", async () => {
  const downloads = mockDownloads("in_progress");
  const exchange = { method: "GET", url: "https://example.test/" };

  await downloadFile(downloads, "web-live-tracker/study/exchange.json", jsonFile(exchange));

  assert.deepEqual({ calls: downloads.calls, listeners: downloads.listeners.size }, {
    calls: [{
      filename: "web-live-tracker/study/exchange.json",
      conflictAction: "uniquify",
      data: exchange,
    }],
    listeners: 0,
  });
});

test("downloadFile detects an already interrupted download", async () => {
  const downloads = mockDownloads("interrupted");

  await assert.rejects(downloadFile(downloads, "exchange.json", jsonFile({})), /download was interrupted/);
});

test("downloadFile reports failure to start a download", async () => {
  const downloads = {
    async download() {
      throw new Error("Download failed to start.");
    },
  };

  await assert.rejects(downloadFile(downloads, "exchange.json", jsonFile({})), /failed to start/);
});
