export function createCapture(requestFinished, onRecord, now = Date.now) {
  let startedAt = null;

  function record(entry) {
    const timestamp = Date.parse(entry.startedDateTime);
    if (startedAt === null || !Number.isFinite(timestamp) || timestamp < startedAt) {
      return;
    }

    const url = new URL(entry.request.url);
    if (url.protocol !== "http:" && url.protocol !== "https:") {
      return;
    }

    const metadata = {
      timestamp: new Date(timestamp).toISOString(),
      method: entry.request.method,
      url: url.origin + url.pathname,
      status: entry.response.status,
      mediaType: entry.response.content?.mimeType || null,
    };
    if (metadata.status === 206) {
      const range = entry.response.headers?.find(({ name }) => name.toLowerCase() === "content-range")?.value;
      if (typeof range === "string" && /^bytes \d+-\d+\/(?:\d+|\*)$/i.test(range.trim())) {
        metadata.responseRange = range.trim();
      }
    }
    onRecord(entry, metadata);
  }

  return {
    start() {
      if (startedAt === null) {
        startedAt = now();
        requestFinished.addListener(record);
      }
    },
    stop() {
      startedAt = null;
      requestFinished.removeListener(record);
    },
  };
}
