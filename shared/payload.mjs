import { DownloadError, exportFolder, jsonFile } from "./export.mjs";

const fileExtensions = new Map([
  ["application/gzip", "gz"],
  ["application/json", "json"],
  ["application/mp4", "mp4"],
  ["application/pdf", "pdf"],
  ["application/zip", "zip"],
  ["audio/aac", "aac"],
  ["audio/flac", "flac"],
  ["audio/mp4", "m4a"],
  ["audio/mpeg", "mp3"],
  ["audio/ogg", "ogg"],
  ["audio/wav", "wav"],
  ["audio/webm", "webm"],
  ["audio/x-m4a", "m4a"],
  ["image/avif", "avif"],
  ["image/bmp", "bmp"],
  ["image/gif", "gif"],
  ["image/jpeg", "jpg"],
  ["image/png", "png"],
  ["image/tiff", "tiff"],
  ["image/webp", "webp"],
  ["text/csv", "csv"],
  ["text/plain", "txt"],
  ["text/tab-separated-values", "tsv"],
  ["video/mp4", "mp4"],
  ["video/mp2t", "ts"],
  ["video/mpeg", "mpeg"],
  ["video/ogg", "ogv"],
  ["video/quicktime", "mov"],
  ["video/webm", "webm"],
  ["video/x-m4v", "m4v"],
  ["video/x-matroska", "mkv"],
]);

const savedExtensions = new Set([...fileExtensions.values(), "bin", "txt"]);

export function isExportedBodyFilename(name, direction) {
  const match = typeof name === "string" && /^(request|response)(?: ?\(\d+\))?\.([a-z0-9]+)$/i.exec(name);
  return Boolean(match && match[1].toLowerCase() === direction && savedExtensions.has(match[2].toLowerCase()));
}

const activeTypes = new Set([
  "application/ecmascript",
  "application/javascript",
  "application/xhtml+xml",
  "image/svg+xml",
  "text/ecmascript",
  "text/html",
  "text/javascript",
]);

const binarySignatures = [
  ["image/png", [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]],
  ["image/jpeg", [0xff, 0xd8, 0xff]],
  ["application/gzip", [0x1f, 0x8b, 0x08]],
  ["application/zip", [0x50, 0x4b, 0x03, 0x04]],
  ["application/zip", [0x50, 0x4b, 0x05, 0x06]],
];

function detectMediaType(bytes) {
  if (!(bytes instanceof Uint8Array)) {
    return undefined;
  }

  const match = binarySignatures.find(([, signature]) =>
    signature.every((byte, index) => bytes[index] === byte)
  );
  if (match) {
    return match[0];
  }

  const header = String.fromCharCode(...bytes.subarray(0, 12));
  if (header.startsWith("GIF87a") || header.startsWith("GIF89a")) return "image/gif";
  if (header.startsWith("%PDF-")) return "application/pdf";
  if (header.startsWith("fLaC")) return "audio/flac";
  if (header.startsWith("RIFF") && header.slice(8) === "WEBP") return "image/webp";
  if (header.startsWith("RIFF") && header.slice(8) === "WAVE") return "audio/wav";
  if (header.length === 12 && header.slice(4, 8) === "ftyp") {
    const brand = header.slice(8);
    if (brand === "M4A ") return "audio/mp4";
    if (["isom", "iso2", "iso4", "iso5", "iso6", "mp41", "mp42", "M4V "].includes(brand)) {
      return "video/mp4";
    }
  }
  return undefined;
}

function bodyStatus(status, data) {
  return { status, data };
}

function requestBody(request) {
  const encoded = request.headers?.some(({ name, value }) =>
    name.toLowerCase() === "content-encoding" && value.trim().toLowerCase() !== "identity"
  );
  if (encoded) {
    return bodyStatus("unavailable");
  }
  if (typeof request.postData?.text === "string") {
    return bodyStatus("saved", request.postData.text);
  }
  return bodyStatus(request.bodySize === 0 ? "absent" : "unavailable");
}

async function responseBody(entry, readResponseContent) {
  if (entry.request.method === "HEAD" || [204, 205, 304].includes(entry.response.status)) {
    return bodyStatus("absent");
  }

  let timer;
  const unavailable = (reason) => ({ ...bodyStatus("unavailable"), reason });
  try {
    return await new Promise((resolve) => {
      timer = setTimeout(() => resolve(unavailable("DevTools did not provide the response body in time.")), 5000);
      readResponseContent(entry, (content, encoding) => {
        if (typeof content !== "string" || (content.length === 0 && entry.response.content?.size > 0)) {
          resolve(unavailable("DevTools did not retain the response body."));
        } else if (!encoding) {
          resolve(bodyStatus("saved", content));
        } else if (encoding === "base64") {
          try {
            resolve(bodyStatus("saved", Uint8Array.from(atob(content), (byte) => byte.charCodeAt(0))));
          } catch {
            resolve(unavailable("DevTools returned an invalid base64 response body."));
          }
        } else {
          resolve(unavailable("DevTools returned an unsupported response encoding."));
        }
      });
    });
  } catch {
    return unavailable("DevTools could not read the response body.");
  } finally {
    clearTimeout(timer);
  }
}

export async function capturePayload(entry, metadata, readResponseContent) {
  const request = requestBody(entry.request);
  const requestMediaType = entry.request.postData?.mimeType ||
    entry.request.headers?.find(({ name }) => name.toLowerCase() === "content-type")?.value;
  const response = await responseBody(entry, readResponseContent);
  return { metadata, request, response, requestMediaType };
}

function safeComponent(value) {
  // Chrome rejects edge tildes. Escape literal exclamation marks along with other punctuation.
  const safe = value.replace(/[^a-z0-9._-]/gi, (character) =>
    `!${character.charCodeAt(0).toString(16)}!`
  ).replace(/^\.+|\.+$/g, (dots) => "!2e!".repeat(dots.length))
    .replace(/\.(local|lnk|scf|url)$/i, "!2e!$1");
  if (/^(con|prn|aux|nul|com[1-9]|lpt[1-9])(?:\.|$)|^(desktop\.ini|thumbs\.db)$/i.test(safe)) {
    return `!reserved!${safe}`;
  }
  return safe || "!empty!";
}

function exchangePath(url) {
  const segments = url.pathname === "/" ? ["!root!"] : url.pathname.slice(1).split("/").map(safeComponent);
  const path = segments.join("/");
  // Keep paths usable on local filesystems. exchange.json keeps the complete URL path.
  if (path.length > 96) {
    return `${path.slice(0, 80).replace(/[/.]+$/, "")}!more!`;
  }
  return path;
}

async function saveBody(saveFile, base, name, body, mediaType) {
  if (body.status !== "saved") {
    return null;
  }
  const text = typeof body.data === "string";
  const declaredType = mediaType?.split(";", 1)[0].trim().toLowerCase();
  const normalizedType = declaredType?.startsWith("application/") && declaredType.endsWith("+json")
    ? "application/json"
    : declaredType;
  const knownType = fileExtensions.has(normalizedType) ? normalizedType
    : activeTypes.has(normalizedType) ? undefined : detectMediaType(body.data);
  const knownExtension = fileExtensions.get(knownType);
  const extension = knownExtension ?? (text ? "txt" : "bin");
  const type = knownExtension ? knownType : (text ? "text/plain;charset=utf-8" : "application/octet-stream");
  const filename = `${name}.${extension}`;
  return saveFile(`${base}/${filename}`, new Blob([body.data], { type }));
}

export async function exportPayloads(writeFile, researchId, exchanges, date) {
  const folder = exportFolder(researchId, date);
  const batch = crypto.randomUUID().slice(0, 18);
  const result = { saved: 0, errors: [], records: [] };
  async function saveFile(filename, data) {
    try {
      const savedName = await writeFile(filename, data);
      result.saved += 1;
      return savedName;
    } catch (error) {
      result.errors.push({
        target: filename,
        reason: error instanceof DownloadError ? error.message : "The file could not be saved.",
      });
      return null;
    }
  }
  for (const [index, exchange] of exchanges.entries()) {
    const { metadata, request, response, requestMediaType } = exchange;
    const url = new URL(metadata.url);
    const id = `${batch}-${index + 1}`;
    const base = `${folder}/${safeComponent(url.host)}/${exchangePath(url)}/${id}`;
    const requestFile = await saveBody(saveFile, base, "request", request, requestMediaType);
    const responseFile = await saveBody(saveFile, base, "response", response, metadata.mediaType);
    const indexFile = await saveFile(`${base}/exchange.json`, jsonFile({
      ...metadata,
      requestBody: request.status === "saved" && !requestFile ? "download-failed" : request.status,
      responseBody: response.status === "saved" && !responseFile ? "download-failed" : response.status,
      responseUnavailableReason: response.reason,
      responseSource: response.source,
      responseRetryError: response.retryError,
      requestFile,
      responseFile,
    }));
    const savedPath = (name) => name ? `${base}/${name}` : null;
    result.records.push({
      metadata,
      indexPath: savedPath(indexFile),
      request: { status: request.status, path: savedPath(requestFile) },
      response: {
        status: response.status,
        path: savedPath(responseFile),
        source: response.source,
      },
    });
  }
  return result;
}
