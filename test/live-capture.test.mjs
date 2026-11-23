import assert from "node:assert/strict";
import test from "node:test";
import { createLiveCapture } from "../extension/live-capture.mjs";

function networkEvent() {
  const listeners = new Set();
  return {
    listeners,
    addListener: (listener) => listeners.add(listener),
    removeListener: (listener) => listeners.delete(listener),
    emit(entry) {
      for (const listener of listeners) {
        listener(entry);
      }
    },
  };
}

function entry(path, date) {
  return {
    startedDateTime: date.toISOString(),
    request: { url: `https://example.test/${path}`, method: "GET", bodySize: 0 },
    response: { status: 200, content: { mimeType: "text/plain" } },
    getContent: (callback) => callback("example body", ""),
  };
}

test("start rejects an invalid research ID before subscribing to traffic", () => {
  const event = networkEvent();
  const capture = createLiveCapture(event, {}, () => {});

  assert.throws(() => capture.start("../outside"), /Use 1–64/);
  assert.equal(event.listeners.size, 0);
});

test("live capture saves while active and drains under the original ID after stopping", async () => {
  const event = networkEvent();
  const firstSaved = Promise.withResolvers();
  const allowSecond = Promise.withResolvers();
  const paths = [];
  const downloads = {
    onChanged: { addListener() {}, removeListener() {} },
    async download({ filename }) {
      paths.push(filename);
      if (filename.includes("/second/")) {
        await allowSecond.promise;
      }
      return paths.length;
    },
    async search() {
      return [{ state: "complete", filename: paths.at(-1) }];
    },
  };
  const beforeMidnight = new Date(2025, 11, 31, 23, 59);
  const afterMidnight = new Date(2026, 0, 1, 0, 1);
  let lastStatus;
  const capture = createLiveCapture(event, downloads, (status) => {
    lastStatus = status;
    if (status.active && status.saved === 2) {
      firstSaved.resolve();
    }
  }, () => beforeMidnight.getTime() - 1);

  capture.start("study");
  event.emit(entry("first", beforeMidnight));
  await firstSaved.promise;
  event.emit(entry("second", afterMidnight));
  const drained = capture.stop();
  capture.start("other");
  event.emit(entry("ignored", afterMidnight));
  allowSecond.resolve();
  await drained;

  assert.deepEqual(paths.map((path) => path.replace(/\/[^/]+\/([^/]+)$/, "/$1")), [
    "web-live-tracker/study/2025-12-31/example.test/first/response.txt",
    "web-live-tracker/study/2025-12-31/example.test/first/exchange.json",
    "web-live-tracker/study/2026-01-01/example.test/second/response.txt",
    "web-live-tracker/study/2026-01-01/example.test/second/exchange.json",
  ]);
  assert.deepEqual(lastStatus, { active: false, captured: 2, pending: 0, saved: 4, failed: 0, errorCount: 0, errors: [] });
});

test("live capture reports a failed exchange and saves subsequent files", async () => {
  const date = new Date(2026, 0, 1);
  const event = networkEvent();
  let lastStatus;
  let attempts = 0;
  const failedPaths = [];
  const downloads = {
    onChanged: { addListener() {}, removeListener() {} },
    async download({ filename }) {
      attempts += 1;
      if (filename.includes("/blocked/")) {
        failedPaths.push(filename);
        throw new Error(filename.endsWith("response.txt") ? "Invalid filename" : "Download failed to start.");
      }
      return attempts;
    },
    async search() {
      return [{ state: "complete" }];
    },
  };
  const capture = createLiveCapture(event, downloads, (status) => {
    lastStatus = status;
  }, () => date.getTime() - 1);

  capture.start("study");
  event.emit(entry("blocked", date));
  event.emit(entry("allowed", date));
  await capture.stop();

  assert.deepEqual(lastStatus, {
    active: false,
    captured: 2,
    pending: 0,
    saved: 2,
    failed: 1,
    errorCount: 2,
    errors: [
      { target: failedPaths[0], reason: "The browser rejected the download filename." },
      { target: failedPaths[1], reason: "The download failed to start. Check your browser’s downloads." },
    ],
  });
});

test("live capture keeps the latest error details and clears them for a new capture", async () => {
  const date = new Date(2026, 0, 1);
  const event = networkEvent();
  let lastStatus;
  const downloads = {
    async download() {
      throw new Error("Invalid filename");
    },
  };
  const capture = createLiveCapture(event, downloads, (status) => {
    lastStatus = status;
  }, () => date.getTime() - 1);

  capture.start("study");
  for (let index = 0; index < 16; index += 1) {
    event.emit(entry(`failed-${index}`, date));
  }
  await capture.stop();
  const failedCapture = lastStatus;
  capture.start("next-study");
  await capture.stop();

  assert.deepEqual({
    errorCount: failedCapture.errorCount,
    historyLength: failedCapture.errors.length,
    firstRetainedExchange: failedCapture.errors[0].target.split("/").at(-3),
    newCount: lastStatus.errorCount,
    newHistory: lastStatus.errors,
  }, {
    errorCount: 32,
    historyLength: 30,
    firstRetainedExchange: "failed-1",
    newCount: 0,
    newHistory: [],
  });
});
