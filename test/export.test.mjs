import assert from "node:assert/strict";
import test from "node:test";
import { exportCapture, exportFilename } from "../extension/export.mjs";

test("exportFilename puts a valid research ID inside the export folder", () => {
  assert.equal(exportFilename("Research_2026-1"), "web-live-tracker/Research_2026-1/traffic.json");
});

for (const id of ["", "../other", "a/b", String.raw`a\b`, "%2e%2e", "/absolute", "CON", "a".repeat(65)]) {
  test(`exportFilename rejects invalid research ID ${JSON.stringify(id)}`, () => {
    assert.throws(() => exportFilename(id), /Use 1–64/);
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

test("exportCapture saves the snapshot and handles completion after download starts", async () => {
  const downloads = mockDownloads("in_progress");
  const requests = [{ method: "GET", url: "https://example.test/" }];

  await exportCapture(downloads, "study", requests);

  assert.deepEqual({ calls: downloads.calls, listeners: downloads.listeners.size }, {
    calls: [{
      filename: "web-live-tracker/study/traffic.json",
      conflictAction: "uniquify",
      data: { researchId: "study", requests },
    }],
    listeners: 0,
  });
});

test("exportCapture detects an already interrupted download", async () => {
  const downloads = mockDownloads("interrupted");

  await assert.rejects(exportCapture(downloads, "study", []), /download was interrupted/);
});

test("exportCapture reports failure to start a download", async () => {
  const downloads = {
    async download() {
      throw new Error("Download failed to start.");
    },
  };

  await assert.rejects(exportCapture(downloads, "study", []), /failed to start/);
});
