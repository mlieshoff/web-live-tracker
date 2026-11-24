import { rawRecordName } from "./capture-folder.mjs";
import { validateResearchId } from "./export.mjs";
import { isExportedBodyFilename } from "./payload.mjs";

const dateFolder = /^\d{4}-\d{2}-\d{2}$/;
const exchangeFolder = /^[\da-f]{8}-[\da-f]{4}-[\da-f]{4}-[1-9]\d*$/i;
const bodyStates = new Set(["absent", "unavailable", "saved", "download-failed"]);

function decodeComponent(part) {
  if (part === "!root!" || part === "!empty!") return "";
  return part.replace(/^!reserved!/, "").replace(/!([\da-f]{1,4})!/gi, (_, code) =>
    String.fromCharCode(Number.parseInt(code, 16))
  );
}

function archiveBody(direction, data, folder, names) {
  const status = data?.[`${direction}Body`];
  const name = data?.[`${direction}File`];
  const onDisk = isExportedBodyFilename(name, direction) && names.includes(name);
  const found = onDisk ? name : names.find((candidate) => isExportedBodyFilename(candidate, direction));

  if (found) return {
    status: "saved",
    path: `${folder}/${found}`,
    source: direction === "response" ? data?.responseSource : undefined,
  };

  return {
    status: status === "saved" ? "missing-from-folder"
      : status === "download-failed" ? "saved"
      : bodyStates.has(status) ? status : "unknown",
    path: null,
  };
}

function parseMetadata(index) {
  if (!index || !rawRecordName.test(index.name) || typeof index.text !== "string") return null;
  const data = JSON.parse(index.text);
  const url = new URL(data.url);
  if (!["http:", "https:"].includes(url.protocol) ||
      !Number.isFinite(Date.parse(data.timestamp)) || typeof data.method !== "string" ||
      !Number.isInteger(data.status)) return null;

  return { data, url: url.origin + url.pathname };
}

export function earlierCaptureRecords(entries, researchId, currentRecords) {
  validateResearchId(researchId);
  const prefix = `web-live-tracker/${researchId}/`;
  const currentFolders = new Set(currentRecords.flatMap(({ indexPath, request, response }) =>
    [indexPath, request?.path, response?.path].filter(Boolean).map((path) => path.slice(0, path.lastIndexOf("/")))
  ));
  const records = [];
  let unreadable = 0;

  for (const { directory, files, index } of entries) {
    if (typeof directory !== "string" || !Array.isArray(files)) continue;
    const parts = directory.split("/");
    if (parts.length < 4 || !dateFolder.test(parts[0]) || !exchangeFolder.test(parts.at(-1)) ||
        parts.some((part) => !part || part === "." || part === ".." || part.includes("\\"))) continue;

    const folder = prefix + directory;
    if (currentFolders.has(folder)) continue;

    let parsed = null;
    try {
      if (index && files.includes(index.name)) parsed = parseMetadata(index);
    } catch {
      // Saved payloads can still be listed when an older record is malformed.
    }
    if (!parsed && files.some((name) => rawRecordName.test(name))) unreadable += 1;

    const request = archiveBody("request", parsed?.data, folder, files);
    const response = archiveBody("response", parsed?.data, folder, files);
    if (!parsed && !request.path && !response.path) continue;

    records.push({
      earlier: true,
      host: decodeComponent(parts[1]),
      name: decodeComponent(parts.at(-2)),
      capturedAt: Date.parse(parsed?.data.timestamp ?? `${parts[0]}T00:00:00`),
      indexPath: parsed ? `${folder}/${index.name}` : null,
      metadata: parsed ? {
        timestamp: parsed.data.timestamp, method: parsed.data.method, status: parsed.data.status, url: parsed.url,
      } : null,
      request,
      response,
    });
  }
  return { records: records.sort((a, b) => a.capturedAt - b.capturedAt), unreadable };
}
