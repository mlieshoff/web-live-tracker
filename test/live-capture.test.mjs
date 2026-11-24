import assert from "node:assert/strict";
import test from "node:test";
import { createLiveCapture } from "../shared/live-capture.mjs";
import { downloadFile } from "../shared/export.mjs";
import { readResponseContent } from "../chrome/browser-api.mjs";

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
  const capture = createLiveCapture({ requestFinished: event, onStatus() {} });

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
  const capture = createLiveCapture({
    requestFinished: event,
    writeFile: downloadFile.bind(null, downloads),
    readResponseContent,
    onStatus(status) {
      lastStatus = status;
      if (status.active && status.saved === 2) {
        firstSaved.resolve();
      }
    },
    now: () => beforeMidnight.getTime() - 1,
  });

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
  assert.deepEqual(lastStatus, { active: false, captured: 2, pending: 0, saved: 4, failed: 0, errorCount: 0, errors: [], report: undefined });
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
  const capture = createLiveCapture({
    requestFinished: event,
    writeFile: downloadFile.bind(null, downloads),
    readResponseContent,
    onStatus: (status) => { lastStatus = status; },
    now: () => date.getTime() - 1,
  });

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
    report: undefined,
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
  const capture = createLiveCapture({
    requestFinished: event,
    writeFile: downloadFile.bind(null, downloads),
    readResponseContent,
    onStatus: (status) => { lastStatus = status; },
    now: () => date.getTime() - 1,
  });

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

test("stop saves one report after the raw files and links to their final names across midnight", async () => {
  const firstDate = new Date(2025, 11, 31, 23, 59);
  const secondDate = new Date(2026, 0, 1, 0, 1);
  const event = networkEvent();
  const allowSaves = Promise.withResolvers();
  const allowReport = Promise.withResolvers();
  const reportStarted = Promise.withResolvers();
  const downloads = new Map();
  let lastStatus;
  const capture = createLiveCapture({
    requestFinished: event,
    async writeFile(path) {
      await allowSaves.promise;
      const name = path.split("/").at(-1).replace("response.txt", "response #2.txt");
      downloads.set(path.slice(0, path.lastIndexOf("/") + 1) + name, true);
      return name;
    },
    async writeReport(path, data) {
      const html = await data.text();
      reportStarted.resolve({ path, html });
      await allowReport.promise;
      return { id: 7, filename: path.split("/").at(-1) };
    },
    readResponseContent,
    onStatus: (status) => { lastStatus = status; },
    now: () => firstDate.getTime() - 1,
  });

  capture.start("study");
  event.emit(entry("before", firstDate));
  event.emit(entry("after", secondDate));
  const stopped = capture.stop();
  assert.equal(capture.stop(), stopped);
  allowSaves.resolve();
  const { path, html } = await reportStarted.promise;
  assert.equal(lastStatus.report.state, "saving");
  capture.start("another-study");
  assert.equal(event.listeners.size, 0);
  allowReport.resolve();
  await stopped;

  const links = [...new Set(Array.from(html.matchAll(/href="(\.\/[^"]+)"/g), ([, href]) => href))];
  const reportUrl = new URL(path, "file:///");
  assert.deepEqual(links.map((href) => decodeURIComponent(new URL(href, reportUrl).pathname.slice(1))).sort(),
    [...downloads.keys()].sort());
  assert.match(html, /response%20%232\.txt/);
  assert.deepEqual(lastStatus.report, {
    state: "ready", researchId: "study", historyOnly: false, id: 7, filename: path.split("/").at(-1),
  });
});

test("report download failure is shown and a new capture can start", async () => {
  const event = networkEvent();
  let lastStatus;
  const capture = createLiveCapture({
    requestFinished: event,
    async writeReport() {
      throw new Error("Download failed");
    },
    onStatus: (status) => { lastStatus = status; },
  });

  capture.start("study");
  await capture.stop();
  assert.deepEqual(lastStatus.report, { state: "failed", error: "The capture report could not be saved." });
  capture.start("next-study");
  assert.equal(lastStatus.report, undefined);
  assert.equal(lastStatus.active, true);
});

test("a continued report automatically includes earlier Downloads and newly saved files", async () => {
  const date = new Date(2026, 0, 1);
  const event = networkEvent();
  let report;
  const currentItems = [];
  const folder = "web-live-tracker/study/2025-12-31/example.test/earlier/01234567-abcd-4567-1";
  const capture = createLiveCapture({
    requestFinished: event,
    async writeFile(path) {
      currentItems.push({
        filename: `/Downloads/${path}`, startTime: date.toISOString(), state: "complete", exists: true,
      });
      return path.split("/").at(-1);
    },
    async findEarlierDownloads(id) {
      assert.equal(id, "study");
      const earlierItems = ["response.txt", "exchange.json"].map((name) => ({
        filename: `/Downloads/${folder}/${name}`,
        startTime: new Date(2025, 11, 31, 12).toISOString(),
        state: "complete",
        exists: true,
      }));
      return [...currentItems, ...earlierItems];
    },
    async writeReport(path, data) {
      report = await data.text();
      return { id: 1, filename: path.split("/").at(-1) };
    },
    readResponseContent,
    onStatus() {},
    now: () => date.getTime() - 1,
  });
  capture.start("study");
  event.emit(entry("new", date));
  await capture.stop();

  assert.match(report, /2025-12-31\/example.test\/earlier\/[^"]+\/response.txt/);
  assert.match(report, /2026-01-01\/example.test\/new\/[^"]+\/response.txt/);
});

test("a download history error still produces a report for the current capture", async () => {
  const event = networkEvent();
  let report;
  const capture = createLiveCapture({
    requestFinished: event,
    async findEarlierDownloads() { throw new Error("History unavailable"); },
    async writeReport(path, data) {
      report = await data.text();
      return { id: 1, filename: path.split("/").at(-1) };
    },
    onStatus() {},
  });

  capture.start("study");
  await capture.stop();

  assert.match(report, /Downloads history could not be read/);
});

test("opening a report before starting capture finds existing files in the actual Downloads folder", async () => {
  const date = new Date("2026-02-01T12:00:00Z");
  const event = networkEvent();
  const fault = "web-live-tracker/study/2026-01-11/example.test/another-location/87654321-abcd-4567-1";
  const folder = "web-live-tracker/study/2026-01-11/example.test/earlier/01234567-abcd-4567-1";
  const old = (filename) => ({ filename, startTime: "2026-01-11T09:00:00Z", state: "complete", exists: true });
  const calls = [];
  let html;
  const capture = createLiveCapture({
    requestFinished: event,
    async findEarlierDownloads(id) {
      calls.push(["search", id]);
      return [
        old(`/Downloads/${folder}/response.txt`),
        old(`/Downloads/${folder}/exchange.json`),
        old(`/OldDownloads/${fault}/response.txt`),
      ];
    },
    async resolveDownloadRoot(id) {
      calls.push(["resolve", id]);
      return "/Downloads";
    },
    async writeReport(path, data) {
      calls.push(["save", path]);
      html = await data.text();
      return { id: 9, filename: path.split("/").at(-1) };
    },
    now: () => date.getTime(),
    onStatus() {},
  });

  const report = await capture.prepareReport("study");

  assert.equal(event.listeners.size, 0);
  assert.deepEqual(calls, [
    ["search", "study"], ["resolve", "study"], ["save", "web-live-tracker/study/capture-2026-02-01T12-00-00-000Z.html"],
  ]);
  assert.deepEqual(report, {
    state: "ready", researchId: "study", historyOnly: true, id: 9, filename: "capture-2026-02-01T12-00-00-000Z.html",
  });
  assert.match(html, /Report created/);
  assert.match(html, /earlier\/01234567-abcd-4567-1\/response\.txt/);
  assert.match(html, /earlier\/01234567-abcd-4567-1\/exchange\.json/);
  assert.doesNotMatch(html, /another-location/);
});
