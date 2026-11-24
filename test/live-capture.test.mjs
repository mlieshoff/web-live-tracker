import assert from "node:assert/strict";
import test from "node:test";
import { readSelectedCaptureFiles } from "../shared/capture-folder.mjs";
import { earlierCaptureRecords } from "../shared/earlier-captures.mjs";
import { captureReport } from "../shared/report.mjs";
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

function entry(path, date, body = `Example response for ${path}`) {
  return {
    startedDateTime: date.toISOString(),
    request: { url: `https://example.test/${path}`, method: "GET", bodySize: 0 },
    response: { status: 200, content: { mimeType: "text/plain" } },
    getContent: (callback) => callback(body, ""),
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
    state: "ready", researchId: "study", historyOnly: false, needsFolder: false, id: 7, filename: path.split("/").at(-1),
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


const earlierDirectory = "2025-12-31/example.test/earlier/01234567-abcd-4567-1";
const earlierEntry = {
  directory: earlierDirectory,
  files: ["response.txt", "exchange.json"],
  index: {
    name: "exchange.json",
    text: JSON.stringify({
      timestamp: "2025-12-31T12:00:00Z", method: "GET", status: 200,
      url: "https://example.test/earlier", requestBody: "absent",
      responseBody: "saved", responseFile: "response.txt",
    }),
  },
};

test("a granted folder automatically supplies earlier files and merges the current capture", async () => {
  const date = new Date(2026, 0, 1);
  const event = networkEvent();
  let report;
  const capture = createLiveCapture({
    requestFinished: event,
    async writeFile(path) { return path.split("/").at(-1); },
    async readEarlierFolder(id) {
      assert.equal(id, "study");
      return [earlierEntry];
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
  const saved = await capture.stop();
  assert.equal(saved.needsFolder, false);
  assert.match(report, /2025-12-31\/example.test\/earlier\/[^"]+\/response.txt/);
  assert.match(report, /2026-01-01\/example.test\/new\/[^"]+\/response.txt/);
});

test("a report from selected files opens before starting a capture", async () => {
  const event = networkEvent();
  let report;
  const capture = createLiveCapture({
    requestFinished: event,
    async readEarlierFolder() { return null; },
    async writeReport(path, data) {
      report = await data.text();
      return { id: 1, filename: path.split("/").at(-1) };
    },
    onStatus() {},
  });
  const saved = await capture.prepareReport("study", [earlierEntry]);
  assert.equal(event.listeners.size, 0);
  assert.equal(saved.needsFolder, false);
  assert.match(report, /Report created/);
  assert.match(report, /earlier\/01234567-abcd-4567-1\/response.txt/);
});

test("a current report can be completed with folder contents after stopping", async () => {
  const event = networkEvent();
  const date = new Date(2026, 0, 1);
  let html;
  const capture = createLiveCapture({
    requestFinished: event,
    async readEarlierFolder() { return null; },
    async writeFile(path) { return path.split("/").at(-1); },
    async writeReport(path, data) {
      html = await data.text();
      return { id: 1, filename: path.split("/").at(-1) };
    },
    readResponseContent,
    onStatus() {},
    now: () => date.getTime() - 1,
  });
  capture.start("study");
  event.emit(entry("new", date));
  assert.equal((await capture.stop()).needsFolder, true);
  assert.match(html, /choose the research folder/);
  const saved = await capture.prepareReport("study", [earlierEntry]);
  assert.equal(saved.needsFolder, false);
  assert.equal(saved.historyOnly, false);
  assert.match(html, /earlier\/01234567-abcd-4567-1\/response.txt/);
  assert.match(html, /2026-01-01\/example.test\/new\//);
});

test("different request timestamps and identical response bytes open the same live and rebuilt report file", async () => {
  const first = new Date(2026, 0, 1, 23, 59);
  const next = new Date(2026, 0, 2, 0, 1);
  const event = networkEvent();
  const files = new Map();
  let reportPath;
  const capture = createLiveCapture({
    requestFinished: event,
    async writeFile(path, data) {
      const actualPath = path.replace(/response\.txt$/, "response (1).txt");
      files.set(actualPath, data);
      return actualPath.split("/").at(-1);
    },
    async writeReport(path, data) {
      reportPath = path;
      files.set(path, data);
      return { id: 1, filename: path.split("/").at(-1) };
    },
    readResponseContent,
    onStatus() {},
    now: () => first.getTime() - 1,
  });

  capture.start("study");
  event.emit(entry("same?timestamp=1", first, "Café"));
  const binary = entry("same?timestamp=2", next);
  binary.getContent = (callback) => callback("Q2Fmw6k=", "base64");
  event.emit(binary);
  await capture.stop();

  const [savedPayload] = [...files.keys()].filter((path) => path.endsWith("/response (1).txt"));
  const rawRecords = await Promise.all([...files].filter(([path]) => path.endsWith("/exchange.json"))
    .map(async ([, blob]) => JSON.parse(await blob.text())));
  assert.deepEqual(rawRecords.map((record) => record.timestamp), [first.toISOString(), next.toISOString()]);
  assert.deepEqual(rawRecords.map((record) => record.responseBody), ["saved", "saved"]);
  assert.equal(rawRecords[0].responseFile, "response (1).txt");
  assert.equal(rawRecords[1].responseFile, null);
  assert.equal(rawRecords[1].responseFilePath, savedPayload.slice("web-live-tracker/study/".length));
  assert.equal([...files.keys()].filter((path) => /\/response.*\.[^/]+$/.test(path)).length, 1);

  const selected = [...files].filter(([path]) => !path.endsWith(".html"))
    .map(([path, blob]) => Object.assign(blob, { webkitRelativePath: path.slice("web-live-tracker/".length) }));
  const entries = await readSelectedCaptureFiles(selected, "study");
  const rebuilt = captureReport({ researchId: "study", startedAt: first, ...earlierCaptureRecords(entries, "study", []) });
  for (const report of [files.get(reportPath), rebuilt]) {
    const savedSection = (await report.text()).split('<section id="issues">')[0];
    const links = [...savedSection.matchAll(/href="(\.\/[^"]+\/response%20\(1\)\.txt)"/g)].map((match) => match[1]);
    const targets = links.map((href) => decodeURIComponent(new URL(href, `file:///${reportPath}`).pathname.slice(1)));
    assert.deepEqual(targets, [savedPayload, savedPayload]);
    assert.deepEqual(await Promise.all(targets.map((path) => files.get(path).text())), ["Café", "Café"]);
  }
});

test("failed response writes can retry and each new capture has a fresh response cache", async () => {
  const date = new Date(2026, 0, 1);
  const event = networkEvent();
  const attempts = [];
  const capture = createLiveCapture({
    requestFinished: event,
    async writeFile(path) {
      if (path.endsWith("/response.txt")) {
        attempts.push(path);
        if (attempts.length === 1) throw new Error("First save failed");
      }
      return path.split("/").at(-1);
    },
    readResponseContent,
    onStatus() {},
    now: () => date.getTime() - 1,
  });

  capture.start("study");
  for (const name of ["failed", "retried", "reused"]) event.emit(entry(name, date, "same response"));
  await capture.stop();
  capture.start("study");
  event.emit(entry("new-capture", date, "same response"));
  await capture.stop();

  assert.deepEqual(attempts.map((path) => path.split("/").at(-3)), ["failed", "retried", "new-capture"]);
});

test("partial response reuse requires a known matching range and matching bytes", async () => {
  const date = new Date(2026, 0, 1);
  const event = networkEvent();
  const written = [];
  const capture = createLiveCapture({
    requestFinished: event,
    async writeFile(path) {
      if (path.endsWith("/response.txt")) written.push(path.split("/").at(-3));
      return path.split("/").at(-1);
    },
    readResponseContent,
    onStatus() {},
    now: () => date.getTime() - 1,
  });

  function partial(name, range, body = "abc") {
    const response = entry(name, date, body);
    response.response.status = 206;
    if (range) response.response.headers = [{ name: "Content-Range", value: range }];
    return response;
  }

  capture.start("study");
  event.emit(partial("first", "bytes 0-2/20"));
  event.emit(partial("same-range", "bytes 0-2/20"));
  event.emit(partial("other-range", "bytes 3-5/20"));
  event.emit(partial("different-bytes", "bytes 0-2/20", "xyz"));
  event.emit(partial("unknown-1"));
  event.emit(partial("unknown-2"));
  event.emit(entry("full", date, "abc"));
  await capture.stop();

  assert.deepEqual(written, ["first", "other-range", "different-bytes", "unknown-1", "unknown-2", "full"]);
});
