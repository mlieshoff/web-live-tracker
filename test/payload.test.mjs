import assert from "node:assert/strict";
import test from "node:test";
import { capturePayload, exportPayloads } from "../extension/payload.mjs";

const metadata = {
  timestamp: "2026-01-03T10:00:00.000Z",
  method: "POST",
  url: "https://example.test/api/items",
  status: 200,
  mediaType: "application/octet-stream",
};

test("capturePayload preserves request text and decodes DevTools binary representation", async () => {
  const exchange = await capturePayload({
    request: { method: "POST", postData: { text: "  sample\n" } },
    response: { status: 200 },
    getContent: (callback) => callback("AAH/gA==", "base64"),
  }, metadata);

  assert.deepEqual(exchange, {
    metadata,
    request: { status: "saved", data: "  sample\n" },
    response: { status: "saved", data: Uint8Array.of(0, 1, 255, 128) },
  });
});

test("capturePayload marks an unsupported compressed upload and a missing response", async () => {
  const exchange = await capturePayload({
    request: {
      method: "POST",
      headers: [{ name: "Content-Encoding", value: "gzip" }],
      postData: { text: "unreliable character representation" },
    },
    response: { status: 204 },
  }, metadata);

  assert.deepEqual([exchange.request.status, exchange.response.status], ["unavailable", "absent"]);
});

test("exportPayloads separates repeated exchanges and escapes unsafe path names", async () => {
  const files = new Map();
  const downloads = {
    onChanged: { addListener() {}, removeListener() {} },
    async download({ url, filename }) {
      files.set(filename, await (await fetch(url)).text());
      return files.size;
    },
    async search() {
      return [{ state: "complete" }];
    },
  };
  const exchange = {
    metadata: { ...metadata, url: "https://example.test/CON.txt/..%2F/" },
    request: { status: "saved", data: "request" },
    response: { status: "unavailable" },
  };

  await exportPayloads(downloads, "study", [exchange, exchange], new Date(2026, 0, 3));

  const result = [...files].map(([filename, text]) => {
    const parts = filename.split("/");
    const file = parts.pop();
    const id = parts.pop();
    return { base: parts.join("/"), id, file, text };
  });
  assert.deepEqual({
    bases: [...new Set(result.map(({ base }) => base))],
    count: new Set(result.map(({ id }) => id)).size,
    files: result.map(({ file, text }) => file === "exchange.json"
      ? [file, JSON.parse(text)]
      : [file, text]),
  }, {
    bases: ["web-live-tracker/study/2026-01-03/example.test/~reserved~CON.txt/~2e~~2e~~25~2F/~empty~"],
    count: 2,
    files: Array.from({ length: 2 }, () => [
      ["request.txt", "request"],
      ["exchange.json", {
        ...exchange.metadata, requestBody: "saved", responseBody: "unavailable",
        requestFile: "request.txt", responseFile: null,
      }],
    ]).flat(),
  });
});

test("exportPayloads reports a blocked file and still saves later payloads and metadata", async () => {
  const files = new Map();
  let savedMetadata;
  const downloads = {
    onChanged: { addListener() {}, removeListener() {} },
    async download({ url, filename }) {
      const id = files.size + 1;
      files.set(id, filename);
      if (filename.endsWith("/exchange.json") && !savedMetadata) {
        savedMetadata = await (await fetch(url)).json();
      }
      return id;
    },
    async search({ id }) {
      return [id === 1
        ? { state: "interrupted", error: "FILE_ACCESS_DENIED" }
        : { state: "complete" }];
    },
  };
  const exchange = {
    metadata,
    request: { status: "saved", data: "request" },
    response: { status: "saved", data: "response" },
  };

  const result = await exportPayloads(downloads, "study", [exchange, exchange], new Date(2026, 0, 3));

  assert.deepEqual({
    result,
    attempted: files.size,
    requestStatus: savedMetadata.requestBody,
    requestFile: savedMetadata.requestFile,
    responseFile: savedMetadata.responseFile,
  }, {
    result: { saved: 5, failed: 1, reason: "Chrome could not write to the download destination." },
    attempted: 6,
    requestStatus: "download-failed",
    requestFile: null,
    responseFile: "response.txt",
  });
});

test("exportPayloads escapes Chromium-reserved names in both the domain and path", async () => {
  const attempted = [];
  const downloads = {
    onChanged: { addListener() {}, removeListener() {} },
    async download({ filename }) {
      attempted.push(filename);
      return attempted.length;
    },
    async search() {
      return [{ state: "complete" }];
    },
  };
  const exchange = {
    metadata: { ...metadata, url: "https://example.local/assets/desktop.ini/THUMBS.DB/a.LNK/b.scf/c.url/photo.png" },
    request: { status: "absent" },
    response: { status: "saved", data: Uint8Array.of(1, 2, 3) },
  };

  await exportPayloads(downloads, "study", [exchange], new Date(2026, 0, 3));

  const prefix = "web-live-tracker/study/2026-01-03/example~2e~local/assets/" +
    "~reserved~desktop.ini/~reserved~THUMBS.DB/a~2e~LNK/b~2e~scf/c~2e~url/photo.png";
  assert.deepEqual(attempted.map((filename) => filename.replace(/\/[^/]+\/([^/]+)$/, "/$1")), [
    `${prefix}/response.bin`,
    `${prefix}/exchange.json`,
  ]);
});
