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
  assert.match(html, /target="_blank" rel="noopener noreferrer" href="[^"]+\/exchange\.json">Open raw record/);
  assert.match(html, /target="_blank" rel="noopener noreferrer" href="[^"]+\/response\.png"/);
  assert.match(html, /<a href="#files">Saved files<\/a>/);
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

test("report players use local files and appear once per eligible saved media file", async () => {
  const root = "web-live-tracker/study/2026-01-01/example.test/media";
  const date = new Date("2026-01-01T10:00:00Z");
  function record(resource, file, { status = 200, mediaType, source, responseRange, size } = {}) {
    return {
      metadata: { timestamp: date.toISOString(), url: `https://example.test/${resource}`, method: "GET", status, mediaType, responseRange },
      indexPath: `${root}/${resource}/exchange.json`,
      request: { status: "absent", path: null },
      response: { status: "saved", path: `${root}/${file}`, source, size },
    };
  }
  const records = [
    record("photo", "photo/response (1).png"),
    record("repeated-photo", "photo/response (1).png"),
    record("full-range", "full-range/response.mp4", { status: 206, responseRange: "bytes 0-99/100", size: 100 }),
    record("movie", "movie/response.webm"),
    record("repeated-movie", "movie/response.webm"),
    record("partial-movie", "partial/response.webm", { status: 206 }),
    record("partial-song", "partial-song/response.mp3", { status: 206, responseRange: "bytes 0-99/200", size: 100 }),
    record("truncated", "truncated/response.mp4", { status: 206, responseRange: "bytes 0-99/100", size: 99 }),
    record("song", "song/response.mp3"),
    record("voice", "voice/response.webm", { mediaType: "audio/webm; codecs=opus" }),
    record("refetched", "refetched/response (1).mp4", { status: 206, source: "refetched" }),
    record("transport", "transport/response.ts"),
  ];
  const html = await captureReport({ researchId: "study", startedAt: date, records }).text();

  assert.equal((html.match(/<img class="thumbnail"/g) ?? []).length, 1);
  assert.match(html, /<img class="thumbnail" src="[^"]*photo\/response%20\(1\)\.png"/);
  const players = [...html.matchAll(/<(audio|video) class="media-player" src="\.\/([^"]+)" controls preload="none" aria-label="([^"]+)"><\/\1>/g)];
  assert.deepEqual(players.map(([, tag, path, label]) => [tag, path.split("/").slice(-2).join("/"), label]), [
    ["video", "full-range/response.mp4", "full-range · example.test (received)"],
    ["video", "movie/response.webm", "movie · example.test (received)"],
    ["video", "partial/response.webm", "partial-movie · example.test (received)"],
    ["audio", "partial-song/response.mp3", "partial-song · example.test (received)"],
    ["video", "refetched/response%20(1).mp4", "refetched · example.test (received)"],
    ["audio", "song/response.mp3", "song · example.test (received)"],
    ["video", "truncated/response.mp4", "truncated · example.test (received)"],
    ["audio", "voice/response.webm", "voice · example.test (received)"],
  ]);
  assert.equal((html.match(/<(?:audio|video)\b/g) ?? []).length, players.length);
  assert.doesNotMatch(html, /<a\b[^>]*>(?:(?!<\/a>)[\s\S])*?<(?:audio|video)\b|autoplay|src="https?:/);
  for (const file of ["movie/response.webm", "song/response.mp3", "partial-song/response.mp3", "partial/response.webm", "transport/response.ts"]) {
    assert.ok(html.includes(`href="./2026-01-01/example.test/media/${file}"`));
  }
  assert.match(html, /script-src|default-src 'none'/);
});

test("the German report translates navigation, saved files and warnings while preserving file links", async () => {
  const date = new Date("2026-01-01T10:00:00Z");
  const folder = "web-live-tracker/study/2026-01-01/example.test/video";
  const metadata = { timestamp: date.toISOString(), url: "https://example.test/video", method: "GET", status: 206 };
  const html = await captureReport({
    researchId: "study", startedAt: date, language: "de", unreadable: 2, folderNotSelected: true,
    records: [{
      earlier: true, metadata, indexPath: `${folder}/exchange.json`,
      request: { status: "missing-from-folder" },
      response: { status: "saved", path: `${folder}/response.m4a` },
    }, {
      metadata, error: "The files could not be prepared for saving.",
    }],
  }).text();

  const expected = [
    '<html lang="de">', "<h1>study · Aufzeichnungsbericht</h1>", "1 Datei gespeichert",
    'aria-label="Berichtsabschnitte"', "<h3 id=\"files-media\">Audio und Video</h3>", "Frühere Aufzeichnung",
    "Unvollständige Datei", "Rohdatensatz öffnen (JSON)", "2 Rohdatensätze konnten nicht gelesen werden.",
    "Die frühere Datei fehlt im Rechercheordner.", "Die Dateien konnten nicht zum Speichern vorbereitet werden.",
    'href="./2026-01-01/example.test/video/response.m4a"',
  ];
  assert.deepEqual(expected.filter((text) => !html.includes(text)), []);
  assert.match(html, /<li><a[^>]*href="[^"]*response\.m4a"[^>]*>[^<]+<\/a><audio[^>]*src="[^"]*response\.m4a" controls[^>]*><\/audio><div class="gallery-details">.*Unvollständige Datei · Frühere Aufzeichnung.*<\/li>/);
});

test("captureReport sorts file galleries, lists, and tables A–Z by displayed name regardless of case", async () => {
  const startedAt = new Date("2026-01-01T10:00:00Z");
  const categories = [
    ["images", "png", "gallery"],
    ["media", "mp4", "gallery"],
    ["documents", "pdf", "list"],
    ["otherFiles", "zip", "table"],
  ];
  const records = categories.flatMap(([, extension]) =>
    ["Zebra", "banana", "Apple"].map((name, index) => ({
      metadata: {
        timestamp: startedAt.toISOString(),
        url: `https://example.test/${name}.${extension}`,
        method: "GET",
        status: 200,
      },
      indexPath: `web-live-tracker/study/${index}/exchange.json`,
      request: { status: "absent" },
      response: { status: "saved", path: `web-live-tracker/study/${index}/response.${extension}` },
    })),
  );

  const html = await captureReport({ researchId: "study", startedAt, records }).text();

  const savedFiles = html.split('<section id="files">')[1].split("</section>")[0];
  const groups = [...savedFiles.matchAll(/<(ul(?: class="file-gallery" role="list")?|table) aria-labelledby="files-([^"]+)">(.*?)(?:<\/ul>|<\/table>)/gs)];
  assert.deepEqual(
    groups.map(([, element, category, entries]) => [
      category,
      element.includes("file-gallery") ? "gallery" : element === "ul" ? "list" : "table",
      [...entries.matchAll(/>([^<>]+) · example\.test \(received\)<\/a>/g)].map(([, name]) => name),
      [...entries.matchAll(/href="#exchange-\d+">Capture details<\/a>/g)].length,
    ]),
    categories.map(([category, extension, layout]) => [
      category,
      layout,
      [`Apple.${extension}`, `banana.${extension}`, `Zebra.${extension}`],
      3,
    ]),
  );
});

test("captureReport lists one entry per saved path with the recorded URLs, capture links, and known size", async () => {
  const root = "web-live-tracker/study";
  const startedAt = new Date("2026-01-01T10:00:00Z");
  const records = [
    ["https://example.test/first/image.png?private=value", "first/response.png"],
    ["https://example.test/second/image.png", "first/response.png", 1536],
    ["https://example.test/second/image.png", "first/response.png", 1536],
    ["https://example.test/first/image.png", "other/response.png"],
    [null, "older/response.png"],
  ].map(([url, path, size]) => ({
    metadata: url ? { timestamp: startedAt.toISOString(), url, method: "GET", status: 200 } : null,
    host: "example.test",
    name: "image.png",
    capturedAt: startedAt.getTime(),
    earlier: !url,
    request: { status: "absent" },
    response: { status: "saved", path: `${root}/${path}`, size },
  }));

  const html = await captureReport({ researchId: "study", startedAt, records }).text();
  const savedFiles = html.split('<section id="files">')[1].split("</section>")[0];

  assert.deepEqual({
    count: html.match(/\d+ files saved/)?.[0],
    exposedQuery: html.includes("private=value"),
    paths: [...savedFiles.matchAll(/href="\.\/([^"]+\.png)"/g)].map(([, path]) => path),
    sources: [...savedFiles.matchAll(/Source URL: <span>([^<]+)<\/span>/g)].map(([, url]) => url),
    exchanges: [...savedFiles.matchAll(/href="#exchange-(\d+)"/g)].map(([, id]) => id),
    sizes: [...savedFiles.matchAll(/<div>([\d,]+ bytes)<\/div>/g)].map(([, size]) => size),
  }, {
    count: "3 files saved",
    exposedQuery: false,
    paths: ["first/response.png", "other/response.png", "older/response.png"],
    sources: ["https://example.test/first/image.png", "https://example.test/second/image.png", "https://example.test/first/image.png"],
    exchanges: ["1", "2", "3", "4", "5"],
    sizes: ["1,536 bytes"],
  });
});

test("captureReport collapses multiple earlier captures in one table cell and keeps single captures visible", async () => {
  const startedAt = new Date("2026-01-01T10:00:00Z");
  const records = [
    ["archive.zip", "earlier/first", true],
    ["archive.zip", "earlier/second", true],
    ["archive.zip", "current", false],
    ["single.zip", "earlier/single", true],
  ].map(([name, source, earlier]) => ({
    earlier,
    metadata: {
      timestamp: startedAt.toISOString(), url: `https://example.test/${source}/${name}`, method: "GET", status: 200,
    },
    request: { status: "absent" },
    response: { status: "saved", path: `web-live-tracker/study/${name}`, size: 256 },
  }));

  const html = await captureReport({ researchId: "study", startedAt, records, language: "de" }).text();
  const savedFiles = html.split('<section id="files">')[1].split("</section>")[0];
  const [multiple, single] = [...savedFiles.matchAll(/<tr><td>.*?<\/tr>/gs)].map(([row]) => row);
  const disclosure = multiple.match(/<details class="earlier-captures">.*?<\/details>/s)?.[0] ?? "";
  const visible = multiple.replace(disclosure, "");
  const links = (markup) => [...markup.matchAll(/href="#exchange-(\d+)"/g)].map(([, id]) => id);

  assert.deepEqual({
    summary: disclosure.match(/<summary>([^<]+)<\/summary>/)?.[1],
    earlierLinks: links(disclosure),
    earlierUrls: [...disclosure.matchAll(/<span>([^<]+)<\/span>/g)].map(([, url]) => url),
    currentLinks: links(visible),
    visibleSize: visible.includes("<div>256 Byte</div>"),
    singleDisclosure: single.includes("<details"),
    singleLinks: links(single),
  }, {
    summary: "Frühere Aufzeichnungsdetails (2)",
    earlierLinks: ["1", "2"],
    earlierUrls: ["https://example.test/earlier/first/archive.zip", "https://example.test/earlier/second/archive.zip"],
    currentLinks: ["3"],
    visibleSize: true,
    singleDisclosure: false,
    singleLinks: ["4"],
  });
});
