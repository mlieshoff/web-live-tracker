import assert from "node:assert/strict";
import test from "node:test";
import { prepareMediaRetry, retryUnavailableMedia } from "../extension/media-retry.mjs";

const url = "https://media.example.com/video.mp4";
const metadata = { method: "GET", status: 200, mediaType: "Video/MP4; codecs=avc1" };
const unavailable = { status: "unavailable", reason: "Chrome withheld the body." };

function entry(requestUrl = url, headers = [], size = 4) {
  return { request: { url: requestUrl, headers }, response: { content: { size } } };
}

test("prepareMediaRetry excludes sensitive URLs, authentication, partial bodies, and oversized files", () => {
  const eligible = prepareMediaRetry(entry(), metadata);
  const ineligible = [
    prepareMediaRetry(entry(url + "?example=value"), metadata),
    prepareMediaRetry(entry("https://user:example@media.example.com/video.mp4"), metadata),
    prepareMediaRetry(entry("http://127.0.0.1/video.mp4"), metadata),
    prepareMediaRetry(entry("http://server.home.arpa/video.mp4"), metadata),
    prepareMediaRetry(entry(url, [{ name: "Authorization" }]), metadata),
    prepareMediaRetry(entry(url, [], 65 * 1024 * 1024), metadata),
    prepareMediaRetry(entry(), { ...metadata, status: 206 }),
    prepareMediaRetry(entry(), { ...metadata, method: "POST" }),
    prepareMediaRetry(entry(), { ...metadata, mediaType: "text/html" }),
  ];

  assert.deepEqual({ eligible, ineligible }, {
    eligible: { url, type: "video/mp4", expectedSize: 4 },
    ineligible: Array(ineligible.length).fill(null),
  });
});

test("retryUnavailableMedia makes one anonymous request and preserves the recovered bytes", async () => {
  const calls = [];
  const bytes = Uint8Array.of(0, 1, 254, 255);
  const recovered = await retryUnavailableMedia(prepareMediaRetry(entry(), metadata), unavailable,
    async (requestUrl, { signal, ...options }) => {
      calls.push({ requestUrl, options, signal: signal instanceof AbortSignal });
      return new Response(bytes, { headers: { "content-type": "video/mp4" } });
    });

  assert.deepEqual({ calls, source: recovered.source, body: new Uint8Array(await recovered.data.arrayBuffer()) }, {
    calls: [{
      requestUrl: url,
      options: {
        method: "GET", mode: "cors", credentials: "omit", redirect: "error",
        referrerPolicy: "no-referrer", cache: "no-store",
      },
      signal: true,
    }],
    source: "refetched",
    body: bytes,
  });
});

test("retryUnavailableMedia leaves captured bytes alone and reports an unsuccessful retry", async () => {
  const candidate = prepareMediaRetry(entry(), metadata);
  const captured = { status: "saved", data: Uint8Array.of(0) };
  let requests = 0;
  const unchanged = await retryUnavailableMedia(candidate, captured, () => { requests += 1; });
  const failed = await retryUnavailableMedia(candidate, unavailable, async () => {
    requests += 1;
    return new Response(Uint8Array.of(0), { headers: { "content-type": "video/mp4" } });
  });

  assert.deepEqual({ unchanged, failed, requests }, {
    unchanged: captured,
    failed: {
      ...unavailable,
      retryError: "The anonymous media response size differed from the captured response.",
    },
    requests: 1,
  });
});

test("retryUnavailableMedia cancels a streamed response once it exceeds the byte limit", async () => {
  const chunk = new Uint8Array(1024 * 1024);
  let canceled = false;
  const stream = new ReadableStream({
    pull(controller) {
      controller.enqueue(chunk);
    },
    cancel() {
      canceled = true;
    },
  });
  const failed = await retryUnavailableMedia(prepareMediaRetry(entry(url, [], -1), metadata), unavailable,
    async () => new Response(stream, { headers: { "content-type": "video/mp4" } }));

  assert.deepEqual({ failed, canceled }, {
    failed: { ...unavailable, retryError: "The anonymous media response exceeded the 64 MiB limit." },
    canceled: true,
  });
});
