import assert from "node:assert/strict";
import test from "node:test";
import { createCapture } from "../extension/capture.mjs";

const startTime = Date.parse("2025-01-01T12:00:00.000Z");
const entry = {
  startedDateTime: "2025-01-01T12:00:01.000Z",
  request: {
    url: "https://example.test/api/items?sample=value#fragment",
    method: "POST",
    headers: [{ name: "X-Test", value: "fixture" }],
    postData: { text: "fixture request" },
  },
  response: {
    status: 201,
    cookies: [],
    content: { mimeType: "application/json", text: "fixture response" },
  },
};

function networkEvent() {
  const listeners = new Set();
  return {
    addListener: (listener) => listeners.add(listener),
    removeListener: (listener) => listeners.delete(listener),
    emit(request) {
      for (const listener of listeners) {
        listener(request);
      }
    },
  };
}

test("capture records only the allowed metadata from a finished request", () => {
  const event = networkEvent();
  const records = [];
  const capture = createCapture(event, (_, metadata) => records.push(metadata), () => startTime);
  capture.start();
  event.emit(entry);

  assert.deepEqual(records, [
    {
      timestamp: entry.startedDateTime,
      method: "POST",
      url: "https://example.test/api/items",
      status: 201,
      mediaType: "application/json",
    },
  ]);
});

test("capture excludes other event sources, inactive periods and pre-start requests", () => {
  const inspectedTab = networkEvent();
  const otherTab = networkEvent();
  let time = startTime;
  const accepted = [];
  const capture = createCapture(inspectedTab, (request) => accepted.push(request), () => time);

  inspectedTab.emit(entry);
  capture.start();
  capture.start();
  otherTab.emit(entry);
  inspectedTab.emit({ ...entry, startedDateTime: "2025-01-01T11:59:59.000Z" });
  inspectedTab.emit(entry);
  capture.stop();
  inspectedTab.emit(entry);
  time += 2000;
  capture.start();
  inspectedTab.emit(entry);

  assert.deepEqual(accepted, [entry]);
});

test("capture skips non-web schemes and represents missing media types as null", () => {
  const event = networkEvent();
  const types = [];
  const capture = createCapture(event, (_, metadata) => types.push(metadata.mediaType), () => startTime);
  capture.start();
  event.emit({ ...entry, request: { ...entry.request, url: "data:text/plain,example" } });
  event.emit({ ...entry, response: { status: 204 } });

  assert.deepEqual(types, [null]);
});

test("capture retains the server's byte range for a partial media response", () => {
  const event = networkEvent();
  const records = [];
  const capture = createCapture(event, (_, metadata) => records.push(metadata), () => startTime);
  capture.start();

  event.emit({
    ...entry,
    response: {
      status: 206,
      content: { mimeType: "video/mp4" },
      headers: [{ name: "Content-Range", value: "bytes 0-39/1133" }],
    },
  });

  assert.equal(records[0].responseRange, "bytes 0-39/1133");
});
