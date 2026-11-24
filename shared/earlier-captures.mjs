import { validateResearchId } from "./export.mjs";
import { isExportedBodyFilename } from "./payload.mjs";

const indexName = /^exchange(?: ?\(\d+\))?\.json$/i;
const captureDate = /^\d{4}-\d{2}-\d{2}$/;
const bodyStates = new Set(["absent", "unavailable", "saved", "download-failed"]);

function archiveBody(direction, data, folder, files) {
  const status = data[`${direction}Body`];
  if (!bodyStates.has(status)) throw new Error("Unrecognized body status.");

  const name = data[`${direction}File`];
  const path = status === "saved" && isExportedBodyFilename(name, direction) ? `${folder}/${name}` : null;

  return {
    status: status === "saved" && !path ? "invalid-file-name"
      : path && !files.has(path) ? "missing-from-folder"
      : status === "download-failed" ? "saved" : status,
    path: path && files.has(path) ? `web-live-tracker/${path}` : null,
    source: direction === "response" ? data.responseSource : undefined,
  };
}

export async function loadEarlierCaptures(selectedFiles, researchId) {
  validateResearchId(researchId);
  const files = new Map();
  for (const file of selectedFiles) {
    const parts = file.webkitRelativePath.split("/");
    if (parts[0] !== researchId) {
      throw new Error(`Choose the folder named "${researchId}" in web-live-tracker.`);
    }
    if (parts.length >= 6 && captureDate.test(parts[1]) &&
        parts.every((part) => part && part !== "." && part !== ".." && !part.includes("\\"))) {
      files.set(file.webkitRelativePath, file);
    }
  }

  const records = [];
  let unreadable = 0;
  for (const [path, file] of files) {
    if (!indexName.test(path.split("/").at(-1))) continue;
    try {
      if (file.size > 1024 * 1024) throw new Error("Record too large.");
      const data = JSON.parse(await file.text());
      const url = new URL(data.url);
      if ((url.protocol !== "http:" && url.protocol !== "https:") ||
          !Number.isFinite(Date.parse(data.timestamp)) || typeof data.method !== "string" ||
          !Number.isInteger(data.status)) {
        throw new Error("Invalid capture metadata.");
      }

      const folder = path.slice(0, path.lastIndexOf("/"));
      records.push({
        metadata: { url: url.origin + url.pathname, method: data.method, timestamp: data.timestamp, status: data.status },
        indexPath: `web-live-tracker/${path}`,
        request: archiveBody("request", data, folder, files),
        response: archiveBody("response", data, folder, files),
        earlier: true,
      });
    } catch {
      unreadable += 1;
    }
  }

  if (records.length === 0 && unreadable === 0) {
    throw new Error("This folder contains no earlier capture records.");
  }

  records.sort((first, second) => Date.parse(first.metadata.timestamp) - Date.parse(second.metadata.timestamp));
  return { records, unreadable };
}
