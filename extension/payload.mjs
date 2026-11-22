import { downloadFile, exportFolder, jsonFile } from "./export.mjs";

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

async function responseBody(entry) {
  if (entry.request.method === "HEAD" || [204, 205, 304].includes(entry.response.status)) {
    return bodyStatus("absent");
  }

  let timer;
  try {
    return await new Promise((resolve) => {
      timer = setTimeout(() => resolve(bodyStatus("unavailable")), 5000);
      entry.getContent((content, encoding) => {
        if (typeof content !== "string") {
          resolve(bodyStatus("unavailable"));
        } else if (!encoding) {
          resolve(bodyStatus("saved", content));
        } else if (encoding === "base64") {
          try {
            resolve(bodyStatus("saved", Uint8Array.from(atob(content), (byte) => byte.charCodeAt(0))));
          } catch {
            resolve(bodyStatus("unavailable"));
          }
        } else {
          resolve(bodyStatus("unavailable"));
        }
      });
    });
  } catch {
    return bodyStatus("unavailable");
  } finally {
    clearTimeout(timer);
  }
}

export async function capturePayload(entry, metadata) {
  const request = requestBody(entry.request);
  const response = await responseBody(entry);
  return { metadata, request, response };
}

function safeComponent(value) {
  // Encode special characters and protect device names on Windows.
  const safe = value.replace(/[^a-z0-9._-]/gi, (character) =>
    `~${character.charCodeAt(0).toString(16)}~`
  ).replace(/^\.+|\.+$/g, (dots) => "~2e~".repeat(dots.length));
  if (/^(con|prn|aux|nul|com[1-9]|lpt[1-9])(?:\.|$)/i.test(safe)) {
    return `~reserved~${safe}`;
  }
  return safe || "~empty~";
}

function exchangePath(url) {
  const segments = url.pathname === "/" ? ["~root~"] : url.pathname.slice(1).split("/").map(safeComponent);
  const path = segments.join("/");
  // Keep paths usable on local filesystems. exchange.json keeps the complete URL path.
  if (path.length > 96) {
    return `${path.slice(0, 80).replace(/[/.]+$/, "")}~more~`;
  }
  return path;
}

async function saveBody(downloads, base, name, body) {
  if (body.status !== "saved") {
    return null;
  }
  const text = typeof body.data === "string";
  const filename = `${name}.${text ? "txt" : "bin"}`;
  const type = text ? "text/plain;charset=utf-8" : "application/octet-stream";
  await downloadFile(downloads, `${base}/${filename}`, new Blob([body.data], { type }));
  return filename;
}

export async function exportPayloads(downloads, researchId, exchanges, date) {
  const folder = exportFolder(researchId, date);
  const batch = crypto.randomUUID().slice(0, 18);
  for (const [index, exchange] of exchanges.entries()) {
    const { metadata, request, response } = exchange;
    const url = new URL(metadata.url);
    const id = `${batch}-${index + 1}`;
    const base = `${folder}/${safeComponent(url.host)}/${exchangePath(url)}/${id}`;
    const requestFile = await saveBody(downloads, base, "request", request);
    const responseFile = await saveBody(downloads, base, "response", response);
    await downloadFile(downloads, `${base}/exchange.json`, jsonFile({
      ...metadata,
      requestBody: request.status,
      responseBody: response.status,
      requestFile,
      responseFile,
    }));
  }
}
