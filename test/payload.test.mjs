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
