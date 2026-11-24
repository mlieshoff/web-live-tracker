import assert from "node:assert/strict";
import test from "node:test";
import { earlierCaptureRecords, searchCaptureDownloads } from "../shared/earlier-captures.mjs";
import { exportPayloads } from "../shared/payload.mjs";
import { captureReport } from "../shared/report.mjs";

const folder = "web-live-tracker/study/2026-06-01/example.test!3a!80/photo/01234567-abcd-4567-1";
const start = new Date("2026-06-02T12:00:00Z");

function item(filename, overrides = {}) {
  return { filename, startTime: "2026-06-01T12:00:00Z", state: "complete", exists: true, ...overrides };
}

test("Downloads search is scoped to the requested research folder on Unix and Windows", async () => {
  await searchCaptureDownloads({
    search(query) {
      const pattern = new RegExp(query.filenameRegex);
      assert.match(`/home/example/Downloads/${folder}/exchange.json`, pattern);
      assert.match(`C:/Downloads/${folder}/exchange.json`.replaceAll("/", "\\"), pattern);
      assert.doesNotMatch(`/home/example/Downloads/${folder.replace("/study/", "/study-extra/")}/exchange.json`, pattern);
      assert.deepEqual([query.state, query.exists], ["complete", true]);
    },
  }, "study");
});

test("earlier browser downloads are grouped by exchange and linked using their existing names", async () => {
  const base = `C:/Downloads/${folder}`;
  const candidates = [
    item(`${base}/exchange(1).json`),
    item(`${base}/response (1).png`),
    item(`${base}/response.html`),
    item(`${base}/request.txt`, { exists: false }),
    item(`${base}/request (1).txt`, { state: "interrupted" }),
    item(`C:/Downloads/${folder.replace("/study/", "/other/")}/response.txt`),
    item(`${base.replace("/photo/", "/../")}/response.txt`),
  ].map((download) => ({ ...download, filename: download.filename.replaceAll("/", "\\") }));
  const currentPath = `${folder.replace("2026-06-01", "2026-06-02")}/response.txt`;
  candidates.push(item(`C:/Downloads/${currentPath}`, { startTime: "2026-06-02T12:01:00Z" }));
  const { records } = earlierCaptureRecords(candidates, "study", start, [{ response: { path: currentPath } }]);
  const html = await captureReport({ researchId: "study", startedAt: start, records }).text();

  assert.equal(records.length, 1);
  assert.match(html, /response%20\(1\)\.png/);
  assert.match(html, /exchange\(1\)\.json/);
  assert.match(html, /photo · example\.test:80/);
  assert.match(html, /Earlier download/);
  assert.doesNotMatch(html, /\/Downloads\/|response\.html|request\.txt|Status undefined|could not provide/);
});

test("earlier download paths must match the current Downloads root and predate the capture", () => {
  const currentPath = `${folder.replace("2026-06-01", "2026-06-02")}/response.txt`;
  const currentRecords = [{ response: { path: currentPath } }];
  const items = [
    item(`/Downloads/${currentPath}`, { startTime: "2026-06-02T12:01:00Z" }),
    item(`/Downloads/${folder}/response.png`),
    item(`/otherDownloads/${folder.replace("/photo/", "/other-photo/")}/response.png`),
    item(`/Downloads/${folder.replace("/photo/", "/other-capture/")}/response.png`, { startTime: "2026-06-02T12:05:00Z" }),
  ];
  assert.deepEqual(earlierCaptureRecords(items, "study", start, currentRecords).records.map(({ response }) => response.path),
    [`${folder}/response.png`]);
  assert.deepEqual(earlierCaptureRecords(items, "study", start, []),
    { records: [], locationUnconfirmed: true });
});

test("automatic lookup recognizes the paths produced by the raw exporter", async () => {
  const items = [];
  await exportPayloads(async (path) => {
    items.push(item(`/Downloads/${path}`));
    return path.split("/").at(-1);
  }, "study", [{
    metadata: { url: "https://example.test/archive.txt", mediaType: "text/plain" },
    request: { status: "absent" },
    response: { status: "saved", data: "Saved payload" },
  }], new Date(2026, 5, 1, 12));

  const currentPath = `${folder}/request.json`;
  items.push(item(`/Downloads/${currentPath}`, { startTime: "2026-06-02T12:01:00Z" }));
  const { records: [record] } = earlierCaptureRecords(items, "study", start, [{ request: { path: currentPath } }]);
  assert.match(record.indexPath, /\/exchange\.json$/);
  assert.match(record.response.path, /\/response\.txt$/);
});
