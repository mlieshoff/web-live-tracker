import { validateResearchId } from "./export.mjs";
import { isExportedBodyFilename } from "./payload.mjs";

const dateFolder = /^\d{4}-\d{2}-\d{2}$/;
const exchangeFolder = /^[\da-f]{8}-[\da-f]{4}-[\da-f]{4}-[1-9]\d*$/i;
const indexName = /^exchange(?: ?\(\d+\))?\.json$/i;

export function searchCaptureDownloads(downloads, researchId) {
  validateResearchId(researchId);
  const separator = String.raw`[/\\]`;
  return downloads.search({
    filenameRegex: `${separator}web-live-tracker${separator}${researchId}${separator}`,
    state: "complete",
    exists: true,
    orderBy: ["-startTime"],
  });
}

function captureDownload(item, researchId) {
  if (item.exists === false || item.state !== "complete" || typeof item.filename !== "string") return null;
  const filename = item.filename.replaceAll("\\", "/");
  const marker = `/web-live-tracker/${researchId}/`;
  const offset = filename.lastIndexOf(marker);
  if (offset < 0) return null;

  const path = filename.slice(offset + 1);
  const parts = filename.slice(offset + marker.length).split("/");
  if (parts.length < 5 || !dateFolder.test(parts[0]) || !exchangeFolder.test(parts.at(-2)) ||
      parts.some((part) => !part || part === "." || part === "..")) return null;

  const name = parts.at(-1);
  const kind = indexName.test(name) ? "index"
    : isExportedBodyFilename(name, "request") ? "request"
    : isExportedBodyFilename(name, "response") ? "response" : null;
  const timestamp = Date.parse(item.startTime);
  if (!kind || !Number.isFinite(timestamp)) return null;

  return {
    root: filename.slice(0, offset),
    path,
    directory: path.slice(0, path.lastIndexOf("/")),
    timestamp,
    kind,
    host: parts[1],
    name: parts.at(-3),
  };
}

function decodeComponent(part) {
  if (part === "!root!" || part === "!empty!") return "";
  return part.replace(/^!reserved!/, "").replace(/!([\da-f]{1,4})!/gi, (_, code) =>
    String.fromCharCode(Number.parseInt(code, 16))
  );
}

export function earlierCaptureRecords(items, researchId, startedAt, currentRecords, confirmedRoot) {
  const downloads = items.map((item) => captureDownload(item, researchId)).filter(Boolean);
  const currentPaths = new Set(currentRecords.flatMap(({ indexPath, request, response }) =>
    [indexPath, request?.path, response?.path].filter(Boolean)
  ));
  const earlier = downloads.filter(({ timestamp, path }) =>
    timestamp < startedAt.getTime() && !currentPaths.has(path)
  );
  const currentRoots = new Set(downloads.filter(({ path }) => currentPaths.has(path)).map(({ root }) => root));
  const root = confirmedRoot ?? (currentRoots.size === 1 ? [...currentRoots][0] : undefined);
  if (root === undefined) {
    return { records: [], locationUnconfirmed: earlier.length > 0 };
  }
  const records = new Map();
  for (const file of earlier) {
    if (file.root !== root) continue;
    let record = records.get(file.directory);
    if (!record) {
      record = {
        earlier: true,
        host: decodeComponent(file.host),
        name: decodeComponent(file.name),
        downloadedAt: file.timestamp,
        indexPath: null,
        request: { status: "unknown", path: null },
        response: { status: "unknown", path: null },
      };
      records.set(file.directory, record);
    }
    if (file.kind === "index") record.indexPath ??= file.path;
    else if (!record[file.kind].path) record[file.kind] = { status: "saved", path: file.path };
  }

  return {
    records: [...records.values()].sort((a, b) => a.downloadedAt - b.downloadedAt),
    locationUnconfirmed: false,
  };
}
