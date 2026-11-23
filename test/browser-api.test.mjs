import assert from "node:assert/strict";
import test from "node:test";
import { readResponseContent } from "../extension/browser-api.mjs";

test("readResponseContent uses Chrome's callback body and encoding", async () => {
  const entry = { getContent: (callback) => callback("AAH/", "base64") };
  const result = await new Promise((resolve) => {
    readResponseContent(entry, (...args) => resolve(args), false);
  });

  assert.deepEqual(result, ["AAH/", "base64"]);
});

test("readResponseContent uses Firefox HAR encoding instead of the returned MIME type", async () => {
  const binary = {
    response: { content: { encoding: "base64" } },
    getContent: async () => ["AAH/", "image/png"],
  };
  const text = {
    response: { content: { mimeType: "application/json" } },
    getContent: async () => ["{}", "application/json"],
  };
  const read = (entry) => new Promise((resolve) => {
    readResponseContent(entry, (...args) => resolve(args), true);
  });

  assert.deepEqual(await Promise.all([read(binary), read(text)]), [
    ["AAH/", "base64"],
    ["{}", undefined],
  ]);
});

test("readResponseContent reports a rejected Firefox body request as unavailable", async () => {
  const entry = {
    async getContent() {
      throw new Error("Content unavailable");
    },
  };
  const result = await new Promise((resolve) => readResponseContent(entry, resolve, true));

  assert.equal(result, undefined);
});
