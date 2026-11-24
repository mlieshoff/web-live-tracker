import assert from "node:assert/strict";
import test from "node:test";
import { captureReport } from "../shared/report.mjs";

test("the report groups saved files, links raw records, and explains incomplete and missing files", async () => {
  const path = "web-live-tracker/study/2026-01-01/example.test";
  const startedAt = new Date("2026-01-01T10:00:00Z");
  const report = captureReport({
    researchId: "<b>Study</b>",
    startedAt,
    records: [{
      metadata: {
        timestamp: startedAt.toISOString(), url: "https://example.test/movie", method: "POST", status: 206,
      },
      indexPath: `${path}/movie/exchange.json`,
      request: { status: "saved", path: `${path}/movie/request.json` },
      response: { status: "saved", path: `${path}/movie/response.mp4` },
    }, {
      metadata: {
        timestamp: startedAt.toISOString(), url: "https://example.test/picture", method: "GET", status: 200,
      },
      indexPath: `${path}/picture/exchange.json`,
      request: { status: "absent", path: null },
      response: { status: "saved", path: `${path}/picture/response.png` },
    }, {
      metadata: {
        timestamp: startedAt.toISOString(), url: "https://example.test/a&b", method: "POST", status: 200,
      },
      indexPath: null,
      request: { status: "saved", path: null },
      response: { status: "unavailable", path: null },
    }],
  });

  const html = await report.text();
  assert.equal(report.type, "text/html;charset=utf-8");
  assert.match(html, /&lt;b&gt;Study&lt;\/b&gt;/);
  assert.match(html, /Images.*href="[^"]+\/response\.png".*Audio and video.*href="[^"]+\/response\.mp4".*Documents.*href="[^"]+\/request\.json"/);
  assert.match(html, /Partial file/);
  assert.match(html, /href="[^"]+\/exchange\.json">Open raw record/);
  assert.match(html, /provided the file, but it could not be saved/);
  assert.match(html, /could not provide this file/);
  assert.match(html, /technical record could not be saved/);
  assert.match(html, /a&amp;b/);
  assert.doesNotMatch(html.slice(html.indexOf('<section id="issues">'), html.indexOf('<section id="details">')),
    /did not send a file/);
});

test("an empty capture can still produce a readable report", async () => {
  const html = await captureReport({ researchId: "study", startedAt: new Date(), records: [] }).text();
  assert.match(html, /No files were saved in this capture/);
  assert.match(html, /No completed requests were recorded/);
});
