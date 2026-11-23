import assert from "node:assert/strict";
import test from "node:test";
import { capturePayload, exportPayloads } from "../shared/payload.mjs";
import { downloadFile } from "../shared/export.mjs";
import { readResponseContent } from "../chrome/browser-api.mjs";

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
  }, metadata, readResponseContent);

  assert.deepEqual(exchange, {
    metadata,
    request: { status: "saved", data: "  sample\n" },
    response: { status: "saved", data: Uint8Array.of(0, 1, 255, 128) },
    requestMediaType: undefined,
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
  }, metadata, readResponseContent);

  assert.deepEqual([exchange.request.status, exchange.response.status], ["unavailable", "absent"]);
});

test("capturePayload marks an empty DevTools result as unavailable when response bytes were expected", async () => {
  const exchange = await capturePayload({
    request: { method: "GET", bodySize: 0 },
    response: { status: 200, content: { mimeType: "video/mp4", size: 24 * 1024 * 1024 } },
    getContent: (callback) => callback("", ""),
  }, metadata, readResponseContent);

  assert.deepEqual(exchange.response, {
    status: "unavailable",
    data: undefined,
    reason: "DevTools did not retain the response body.",
  });
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

  await exportPayloads(downloadFile.bind(null, downloads), "study", [exchange, exchange], new Date(2026, 0, 3));

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
    bases: ["web-live-tracker/study/2026-01-03/example.test/!reserved!CON.txt/!2e!!2e!!25!2F/!empty!"],
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

  const result = await exportPayloads(downloadFile.bind(null, downloads), "study", [exchange, exchange], new Date(2026, 0, 3));

  assert.deepEqual({
    result,
    attempted: files.size,
    requestStatus: savedMetadata.requestBody,
    requestFile: savedMetadata.requestFile,
    responseFile: savedMetadata.responseFile,
  }, {
    result: {
      saved: 5,
      errors: [{ target: files.get(1), reason: "The browser could not write to the download destination." }],
    },
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

  await exportPayloads(downloadFile.bind(null, downloads), "study", [exchange], new Date(2026, 0, 3));

  const prefix = "web-live-tracker/study/2026-01-03/example!2e!local/assets/" +
    "!reserved!desktop.ini/!reserved!THUMBS.DB/a!2e!LNK/b!2e!scf/c!2e!url/photo.png";
  assert.deepEqual(attempted.map((filename) => filename.replace(/\/[^/]+\/([^/]+)$/, "/$1")), [
    `${prefix}/response.bin`,
    `${prefix}/exchange.json`,
  ]);
});

test("exportPayloads gives root, empty, and shortened URL paths portable folder names", async () => {
  const files = [];
  const downloads = {
    onChanged: { addListener() {}, removeListener() {} },
    async download({ url, filename }) {
      const { url: originalUrl } = await (await fetch(url)).json();
      files.push({ filename, originalUrl });
      return files.length;
    },
    async search() {
      return [{ state: "complete" }];
    },
  };
  const paths = ["/", "/us//static/images/example.png", "/!empty!", `/${"x".repeat(120)}`];
  const exchanges = paths.map((path) => ({
    metadata: { ...metadata, url: `https://example.test${path}` },
    request: { status: "absent" },
    response: { status: "unavailable" },
  }));

  await exportPayloads(downloadFile.bind(null, downloads), "study", exchanges, new Date(2026, 0, 3));

  assert.deepEqual(files.map(({ filename, originalUrl }) => [
    filename.split("/").slice(4, -2).join("/"),
    originalUrl,
  ]), [
    ["!root!", "https://example.test/"],
    ["us/!empty!/static/images/example.png", "https://example.test/us//static/images/example.png"],
    ["!21!empty!21!", "https://example.test/!empty!"],
    [`${"x".repeat(80)}!more!`, `https://example.test${paths[3]}`],
  ]);
});

test("exportPayloads names request and response files independently and records Chrome's final name", async () => {
  const files = [];
  const downloads = {
    onChanged: { addListener() {}, removeListener() {} },
    async download({ url, filename }) {
      const response = await fetch(url);
      files.push({
        name: filename.split("/").at(-1),
        type: response.headers.get("content-type"),
        bytes: [...new Uint8Array(await response.arrayBuffer())],
      });
      return files.length;
    },
    async search({ id }) {
      const name = id === 2 ? "response (1).png" : files[id - 1].name;
      return [{ state: "complete", filename: `/browser-downloads/${name}` }];
    },
  };
  const exchange = await capturePayload({
    request: {
      method: "POST",
      headers: [{ name: "CONTENT-TYPE", value: "Application/vnd.example+JSON; charset=utf-8" }],
      postData: { text: "{}" },
    },
    response: { status: 200 },
    getContent: (callback) => callback("AAH/gA==", "base64"),
  }, { ...metadata, mediaType: "Image/PNG" }, readResponseContent);

  await exportPayloads(downloadFile.bind(null, downloads), "study", [exchange], new Date(2026, 0, 3));

  const index = JSON.parse(new TextDecoder().decode(Uint8Array.from(files[2].bytes)));
  assert.deepEqual({
    bodies: files.slice(0, 2),
    indexedNames: [index.requestFile, index.responseFile],
  }, {
    bodies: [
      { name: "request.json", type: "application/json", bytes: [123, 125] },
      { name: "response.png", type: "image/png", bytes: [0, 1, 255, 128] },
    ],
    indexedNames: ["request.json", "response (1).png"],
  });
});

test("exportPayloads uses neutral text and binary types for active or unknown media", async () => {
  const types = [];
  const downloads = {
    onChanged: { addListener() {}, removeListener() {} },
    async download({ url, filename }) {
      types.push([filename.split("/").at(-1), (await fetch(url)).headers.get("content-type")]);
      return types.length;
    },
    async search() {
      return [{ state: "complete" }];
    },
  };
  const exchange = {
    metadata: { ...metadata, mediaType: "application/x-unknown" },
    requestMediaType: "text/html",
    request: { status: "saved", data: "<p>Fixture</p>" },
    response: { status: "saved", data: Uint8Array.of(0, 1, 255) },
  };

  await exportPayloads(downloadFile.bind(null, downloads), "study", [exchange], new Date(2026, 0, 3));

  assert.deepEqual(types, [
    ["request.txt", "text/plain;charset=utf-8"],
    ["response.bin", "application/octet-stream"],
    ["exchange.json", "application/json"],
  ]);
});

test("exportPayloads detects recognizable binary content only when a declared type does not take precedence", async () => {
  const files = [];
  const downloads = {
    onChanged: { addListener() {}, removeListener() {} },
    async download({ url, filename }) {
      const response = await fetch(url);
      files.push({
        name: filename.split("/").at(-1),
        type: response.headers.get("content-type"),
        bytes: [...new Uint8Array(await response.arrayBuffer())],
      });
      return files.length;
    },
    async search() {
      return [{ state: "complete" }];
    },
  };
  const png = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0xff];
  const pdf = [0x25, 0x50, 0x44, 0x46, 0x2d];
  const truncated = png.slice(0, 7);
  const mp4 = [0, 0, 0, 24, 0x66, 0x74, 0x79, 0x70, 0x69, 0x73, 0x6f, 0x6d];
  const mp3 = [0x49, 0x44, 0x33];
  const cases = [
    ["application/octet-stream", png],
    ["application/x-unknown", png],
    [null, pdf],
    ["image/jpeg", png],
    ["text/html", png],
    [null, truncated],
    ["application/octet-stream", mp4],
    ["audio/mpeg", mp3],
  ];
  const exchanges = cases.map(([mediaType, bytes]) => ({
    metadata: { ...metadata, mediaType },
    request: { status: "absent" },
    response: { status: "saved", data: Uint8Array.from(bytes) },
  }));

  await exportPayloads(downloadFile.bind(null, downloads), "study", exchanges, new Date(2026, 0, 3));

  const bodies = files.filter(({ name }) => name !== "exchange.json");
  const indexedNames = files.filter(({ name }) => name === "exchange.json")
    .map(({ bytes }) => JSON.parse(new TextDecoder().decode(Uint8Array.from(bytes))).responseFile);
  assert.deepEqual({ bodies, indexedNames }, {
    bodies: [
      { name: "response.png", type: "image/png", bytes: png },
      { name: "response.png", type: "image/png", bytes: png },
      { name: "response.pdf", type: "application/pdf", bytes: pdf },
      { name: "response.jpg", type: "image/jpeg", bytes: png },
      { name: "response.bin", type: "application/octet-stream", bytes: png },
      { name: "response.bin", type: "application/octet-stream", bytes: truncated },
      { name: "response.mp4", type: "video/mp4", bytes: mp4 },
      { name: "response.mp3", type: "audio/mpeg", bytes: mp3 },
    ],
    indexedNames: ["response.png", "response.png", "response.pdf", "response.jpg", "response.bin", "response.bin", "response.mp4", "response.mp3"],
  });
});
