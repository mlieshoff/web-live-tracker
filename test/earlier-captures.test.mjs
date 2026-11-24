import assert from "node:assert/strict";
import test from "node:test";
import { loadEarlierCaptures } from "../shared/earlier-captures.mjs";
import { captureReport } from "../shared/report.mjs";

const root = "study/2026-06-01/example.test/image/one";
const oldRecord = {
  timestamp: "2026-06-01T10:00:00.000Z",
  url: "https://example.test/image",
  method: "GET",
  status: 206,
  requestBody: "absent",
  requestFile: null,
  responseBody: "saved",
  responseFile: "response (1).png",
};

function file(path, content = "") {
  return { webkitRelativePath: path, size: content.length, text: async () => content };
}

test("earlier raw records retain their metadata and link to the actual conflict-renamed payload", async () => {
  const earlier = await loadEarlierCaptures([
    file(`${root}/exchange.json`, JSON.stringify(oldRecord)),
    file(`${root}/response (1).png`),
    file("study/capture-old.html"),
  ], "study");
  const result = captureReport({ researchId: "study", startedAt: new Date(), ...earlier });
  const html = await result.text();

  assert.match(html, /href="\.\/2026-06-01\/example\.test\/image\/one\/response%20\(1\)\.png"/);
  assert.match(html, /href="[^"]*exchange\.json"/);
  assert.match(html, /Earlier capture/);
  assert.match(html, /Partial file/);
  assert.match(html, /2026-06-01T10:00:00\.000Z/);
});

test("earlier imports explain deleted payloads and skip unreadable records", async () => {
  const earlier = await loadEarlierCaptures([
    file(`${root}/exchange.json`, JSON.stringify(oldRecord)),
    file(`${root}/exchange (1).json`, "broken"),
    file(`${root}/../bad/exchange.json`, JSON.stringify(oldRecord)),
  ], "study");

  const html = await captureReport({ researchId: "study", startedAt: new Date(), ...earlier }).text();
  assert.equal(earlier.records.length, 1);
  assert.match(html, /1 earlier record could not be read/);
  assert.match(html, /was saved earlier but is missing from the selected folder/);
  assert.doesNotMatch(html, /href="[^"]*response/);
});

test("earlier imports reject a different research folder and a folder without capture records", async () => {
  await assert.rejects(loadEarlierCaptures([file(`${root}/exchange.json`)], "other"), /Choose the folder named "other"/);
  await assert.rejects(loadEarlierCaptures([file("study/README.md")], "study"), /no earlier capture records/);
});

test("earlier imports leave active files unlinked when a raw record points to them", async () => {
  const earlier = await loadEarlierCaptures([
    file(`${root}/exchange.json`, JSON.stringify({
      ...oldRecord, responseFile: "response.html", requestBody: "saved", requestFile: "request.svg",
    })),
    file(`${root}/response.html`, "<script></script>"),
    file(`${root}/request.svg`),
  ], "study");

  const html = await captureReport({ researchId: "study", startedAt: new Date(), ...earlier }).text();
  assert.match(html, /the tracker can’t link/);
  assert.doesNotMatch(html, /href="[^"]*(response\.html|request\.svg)/);
});
