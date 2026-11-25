import assert from "node:assert/strict";
import test from "node:test";
import { readCaptureDirectory, readSelectedCaptureFiles } from "../shared/capture-folder.mjs";
import { earlierCaptureRecords } from "../shared/earlier-captures.mjs";
import { exportPayloads } from "../shared/payload.mjs";
import { captureReport } from "../shared/report.mjs";

const date = new Date(2026, 5, 1, 12);
const directory = "2026-06-01/example.test/archive.txt/01234567-abcd-4567-1";
const index = JSON.stringify({
  url: "https://example.test/archive.txt", timestamp: date.toISOString(), method: "GET", status: 206,
  requestBody: "absent", responseBody: "saved", responseFile: "response (1).txt",
});

function selected(path, contents = "") {
  return Object.assign(new Blob([contents]), { webkitRelativePath: path });
}

test("selected folder files form a report with their actual metadata and names", async () => {
  const folder = `study/${directory}`;
  const entries = await readSelectedCaptureFiles([
    selected(`${folder}/exchange.json`, index),
    selected(`${folder}/response (1).txt`),
    selected(`${folder}/response.html`),
  ], "study");
  const { records } = earlierCaptureRecords(entries, "study", []);
  const html = await captureReport({ researchId: "study", startedAt: date, records }).text();

  assert.equal(records.length, 1);
  assert.match(html, /response%20\(1\)\.txt/);
  assert.match(html, /exchange\.json/);
  assert.match(html, /Partial file/);
  assert.match(html, /Status 206/);
  assert.doesNotMatch(html, /response\.html|Downloads history/);
});

test("a project folder selection isolates the requested ID and rejects malformed paths", async () => {
  const root = `web-live-tracker/study/${directory}`;
  const entries = await readSelectedCaptureFiles([
    selected(`web-live-tracker/another/${directory}/response.txt`),
    selected(`${root}/exchange.json`, index),
    selected(`${root}/../response.txt`),
  ], "study");
  const { records } = earlierCaptureRecords(entries, "study", []);
  assert.equal(records.length, 1);
  assert.equal(records[0].response.status, "missing-from-folder");
  assert.equal(records[0].response.path, null);
  await assert.rejects(readSelectedCaptureFiles([selected(`wrong/${directory}/response.txt`)], "study"),
    /Choose Downloads\/web-live-tracker\/study/);
});

function handle(name, children) {
  if (!Array.isArray(children)) return {
    name, kind: "file", async getFile() { return new Blob([children]); },
  };
  return {
    name, kind: "directory",
    async *values() { yield* children; },
    async getDirectoryHandle(id) { return children.find((entry) => entry.name === id); },
  };
}

test("a granted project directory locates the existing Research ID without a picker", async () => {
  const exchange = handle("01234567-abcd-4567-1", [handle("exchange.json", index), handle("response (1).txt", "data")]);
  const dateFolder = handle("2026-06-01", [handle("example.test", [handle("archive.txt", [exchange])])]);
  const project = handle("web-live-tracker", [handle("study", [dateFolder])]);
  const entries = await readCaptureDirectory(project, "study");
  assert.equal(entries[0].directory, directory);
  assert.equal(entries[0].index.text, index);
});

test("actual raw exports are recognized and current files are not duplicated", async () => {
  const files = [];
  const prefix = "web-live-tracker/";
  const result = await exportPayloads(async (path, data) => {
    files.push(Object.assign(data, { webkitRelativePath: path.slice(prefix.length) }));
    return path.split("/").at(-1);
  }, "study", [{
    metadata: { url: "https://example.test/archive.txt", method: "GET", timestamp: date.toISOString(),
      status: 200, mediaType: "text/plain" },
    request: { status: "absent" },
    response: { status: "saved", data: "Saved payload" },
  }], date);
  const entries = await readSelectedCaptureFiles(files, "study");
  assert.match(earlierCaptureRecords(entries, "study", []).records[0].indexPath, /exchange\.json$/);
  assert.deepEqual(earlierCaptureRecords(entries, "study", result.records), { records: [], unreadable: 0 });
});

test("an ID matching the project folder works for both direct and parent selections", async () => {
  const id = "web-live-tracker";
  for (const prefix of [id, `${id}/${id}`]) {
    const entries = await readSelectedCaptureFiles([selected(`${prefix}/${directory}/response.txt`)], id);
    assert.equal(entries[0].directory, directory);
  }

  const exchange = handle("01234567-abcd-4567-1", [handle("response.txt", "data")]);
  const research = handle(id, [handle("2026-06-01", [handle("example.test", [handle("archive.txt", [exchange])])])]);
  const project = handle(id, [research]);
  for (const folder of [research, project]) {
    const entries = await readCaptureDirectory(folder, id);
    assert.equal(entries[0].directory, directory);
  }
});

test("a shared response reference requires an eligible file in the same research folder", async () => {
  const folder = `study/${directory}`;
  const paths = ["../another/response.txt", `${directory}/response.html`, `${directory}/response.txt`];
  for (const responseFilePath of paths) {
    const entries = await readSelectedCaptureFiles([
      selected(`${folder}/exchange.json`, JSON.stringify({
        ...JSON.parse(index), responseFile: null, responseFilePath,
      })),
      selected(`${folder}/response.html`),
    ], "study");
    const [record] = earlierCaptureRecords(entries, "study", []).records;
    assert.deepEqual(record.response, { status: "missing-from-folder", path: null });
  }
});

test("rebuilt reports show neutral SVG captures under Images, including a shared response", async () => {
  const svg = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 10 10"><circle cx="5" cy="5" r="4"/></svg>';
  const first = `study/${directory}`;
  const second = first.replace("01234567-abcd-4567-1", "01234567-abcd-4567-2");
  const metadata = { ...JSON.parse(index), status: 200, mediaType: "image/svg+xml; charset=utf-8", responseFile: "response.txt" };
  const entries = await readSelectedCaptureFiles([
    selected(`${first}/exchange.json`, JSON.stringify(metadata)),
    selected(`${first}/response.txt`, svg),
    selected(`${second}/exchange.json`, JSON.stringify({
      ...metadata, responseFile: null, responseFilePath: `${directory}/response.txt`,
    })),
  ], "study");
  const { records } = earlierCaptureRecords(entries, "study", []);
  const html = await captureReport({ researchId: "study", startedAt: date, records }).text();

  assert.equal(records.length, 2);
  assert.equal(records[0].response.path, records[1].response.path);
  assert.match(html, /<h3 id="files-images">Images<\/h3><ul class="file-gallery"[^>]*><li><div id="svg-view-1"/);
  assert.match(html, /target="_blank" rel="noopener noreferrer" href="#svg-view-1"><img class="thumbnail" src="data:image\/svg\+xml;base64,/);
  assert.equal((html.match(/href="#svg-view-1"/g) ?? []).length, 2);
  assert.match(html, /target="_blank" rel="noopener noreferrer" href="[^"]+response\.txt">Open saved file/);
  assert.equal((html.match(/data:image\/svg\+xml;base64,/g) ?? []).length, 1);
  assert.doesNotMatch(html, /<svg|<object|<embed|<iframe|<h3>Documents/);
});

test("an SVG too large for an inline preview still belongs to Images and keeps its raw link", async () => {
  const folder = `study/${directory}`;
  const entries = await readSelectedCaptureFiles([
    selected(`${folder}/exchange.json`, JSON.stringify({
      ...JSON.parse(index), mediaType: "image/svg+xml", responseFile: "response.txt",
    })),
    selected(`${folder}/response.txt`, " ".repeat(65 * 1024)),
  ], "study");
  const html = await captureReport({
    researchId: "study", startedAt: date, ...earlierCaptureRecords(entries, "study", []),
  }).text();

  assert.match(html, /<h3 id="files-images">Images<\/h3>.*href="[^"]+response\.txt"/);
  assert.doesNotMatch(html, /src="data:image\/svg/);
});
