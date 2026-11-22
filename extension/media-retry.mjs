const mediaByteLimit = 64 * 1024 * 1024;
const mediaTimeoutMs = 30_000;
const publicHostPattern = /^(?:[a-z0-9](?:[a-z0-9-]*[a-z0-9])?\.)+[a-z][a-z0-9-]*$/i;
const localHostPattern = /(?:^|\.)(?:local|localhost|localdomain|lan|internal|home|home\.arpa)$/i;

function normalizeType(value) {
  return value?.split(";", 1)[0].trim().toLowerCase();
}

export function prepareMediaRetry(entry, metadata) {
  const type = normalizeType(metadata.mediaType);
  const size = entry.response.content?.size;
  if (
    metadata.method !== "GET" ||
    metadata.status !== 200 ||
    !(type === "application/mp4" || /^(audio|video)\//.test(type ?? "")) ||
    size > mediaByteLimit ||
    entry.request.headers?.some(({ name }) => /^(authorization|proxy-authorization)$/i.test(name))
  ) {
    return null;
  }

  const url = new URL(entry.request.url);
  if (
    !["http:", "https:"].includes(url.protocol) ||
    url.username || url.password || url.search ||
    !publicHostPattern.test(url.hostname) ||
    localHostPattern.test(url.hostname)
  ) {
    return null;
  }

  return { url: url.origin + url.pathname, type, expectedSize: Number.isSafeInteger(size) && size > 0 ? size : null };
}

export async function retryUnavailableMedia(candidate, body, fetchMedia = fetch) {
  if (!candidate || body.status !== "unavailable") {
    return body;
  }

  const failed = (retryError) => ({ ...body, retryError });
  try {
    const response = await fetchMedia(candidate.url, {
      method: "GET",
      mode: "cors",
      credentials: "omit",
      redirect: "error",
      referrerPolicy: "no-referrer",
      cache: "no-store",
      signal: AbortSignal.timeout(mediaTimeoutMs),
    });
    if (response.status !== 200 || response.redirected ||
      normalizeType(response.headers.get("content-type")) !== candidate.type) {
      await response.body?.cancel();
      return failed("The anonymous media request returned a different status or media type.");
    }
    if (!response.body || Number(response.headers.get("content-length")) > mediaByteLimit) {
      await response.body?.cancel();
      return failed("The anonymous media response could not be read within the 64 MiB limit.");
    }

    const reader = response.body.getReader();
    const chunks = [];
    let size = 0;
    try {
      for (let chunk = await reader.read(); !chunk.done; chunk = await reader.read()) {
        size += chunk.value.byteLength;
        if (size > mediaByteLimit) {
          await reader.cancel();
          return failed("The anonymous media response exceeded the 64 MiB limit.");
        }
        chunks.push(chunk.value);
      }
    } finally {
      reader.releaseLock();
    }
    if (size === 0 || (candidate.expectedSize !== null && size !== candidate.expectedSize)) {
      return failed("The anonymous media response size differed from the captured response.");
    }

    return { status: "saved", data: new Blob(chunks), source: "refetched" };
  } catch {
    return failed("The anonymous media request could not finish. Chrome may have blocked cross-origin access or a redirect.");
  }
}
