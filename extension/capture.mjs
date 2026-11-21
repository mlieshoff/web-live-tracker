export function createCapture(requestFinished, onRecord, now = Date.now) {
  const records = [];
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

    records.push({
      timestamp: new Date(timestamp).toISOString(),
      method: entry.request.method,
      url: url.origin + url.pathname,
      status: entry.response.status,
      mediaType: entry.response.content?.mimeType || null,
    });
    onRecord(records.length);
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
    getRecords() {
      return records.map((record) => ({ ...record }));
    },
  };
}
