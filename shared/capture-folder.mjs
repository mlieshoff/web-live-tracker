import { createSvgPreviewReader, isSvgMediaType } from "./svg-preview.mjs";
import { validateResearchId } from "./export.mjs";
import { isExportedBodyFilename } from "./payload.mjs";

const dateFolder = /^\d{4}-\d{2}-\d{2}$/;
const exchangeFolder = /^[\da-f]{8}-[\da-f]{4}-[\da-f]{4}-[1-9]\d*$/i;
export const rawRecordName = /^exchange(?: ?\(\d+\))?\.json$/i;
const maxRecordBytes = 256 * 1024;

function validPart(part) {
  return part && part !== "." && part !== ".." && !part.includes("\\");
}

function captureFilename(name) {
  return rawRecordName.test(name) || isExportedBodyFilename(name, "request") || isExportedBodyFilename(name, "response");
}

async function readExchange(directory, files, exchanges, readSvgPreview) {
  const names = [...files.keys()].sort();
  const indexName = names.find((name) => rawRecordName.test(name));
  let index;
  if (indexName) {
    try {
      const file = await files.get(indexName)();
      if (file.size <= maxRecordBytes) index = { name: indexName, text: await file.text() };
    } catch {
      // Keep the saved payloads when the raw record cannot be opened.
    }
  }
  const sizes = {};
  for (const name of names) {
    if (rawRecordName.test(name)) continue;
    try {
      sizes[name] = (await files.get(name)()).size;
    } catch {
      // The file may still be listed when its size is unavailable.
    }
  }
  const entry = { directory, files: names, index, sizes };
  if (!index) return entry;

  let metadata;
  try {
    metadata = JSON.parse(index.text);
  } catch {
    return entry;
  }

  const previews = {};
  for (const [kind, type] of [["request", metadata?.requestMediaType], ["response", metadata?.mediaType]]) {
    if (!isSvgMediaType(type)) continue;
    const ownName = metadata[`${kind}File`];
    const shared = kind === "response" ? metadata.responseFilePath : undefined;
    const parts = typeof shared === "string" ? shared.split("/") : [];
    const name = parts.length ? parts.at(-1) : ownName;
    const folder = parts.length ? parts.slice(0, -1).join("/") : directory;
    if (!isExportedBodyFilename(name, kind)) continue;

    const preview = await readSvgPreview(`${folder}/${name}`, exchanges.get(folder)?.get(name));
    if (preview) previews[kind] = preview;
  }
  return { ...entry, svgPreviews: previews };
}

async function readExchanges(exchanges) {
  const entries = [];
  const readSvgPreview = createSvgPreviewReader();
  for (const [directory, files] of exchanges) {
    entries.push(await readExchange(directory, files, exchanges, readSvgPreview));
  }
  return entries;
}

export async function readSelectedCaptureFiles(files, researchId) {
  validateResearchId(researchId);
  const exchanges = new Map();
  const selected = files[0]?.webkitRelativePath.split("/")[0];
  if (selected !== researchId && selected !== "web-live-tracker") {
    throw new Error(`Choose Downloads/web-live-tracker/${researchId} or its web-live-tracker folder.`);
  }

  const sameName = selected === researchId && researchId === "web-live-tracker";
  const projectSelected = selected === "web-live-tracker" &&
    (!sameName || Array.from(files).some((file) => file.webkitRelativePath.startsWith("web-live-tracker/web-live-tracker/")));

  for (const file of files) {
    const parts = file.webkitRelativePath.split("/");
    if (!parts.every(validPart) || parts.shift() !== selected) continue;
    if (projectSelected && parts.shift() !== researchId) continue;
    // With identical names, exclude dated research folders when recognizing a direct selection.
    if (sameName && !projectSelected && dateFolder.test(parts[1])) continue;
    const name = parts.pop();
    if (parts.length < 4 || !dateFolder.test(parts[0]) || !exchangeFolder.test(parts.at(-1)) ||
        !captureFilename(name)) continue;
    const directory = parts.join("/");
    if (!exchanges.has(directory)) exchanges.set(directory, new Map());
    exchanges.get(directory).set(name, () => file);
  }

  return readExchanges(exchanges);
}

async function childDirectory(handle, name) {
  return handle.getDirectoryHandle(name).catch((error) => {
    if (error.name !== "NotFoundError") throw error;
    return null;
  });
}

export async function readCaptureDirectory(handle, researchId) {
  validateResearchId(researchId);
  let sameNameSelection = false;
  if (handle.name === "web-live-tracker") {
    const child = await childDirectory(handle, researchId);
    if (child) handle = child;
    else if (researchId === handle.name) sameNameSelection = true;
    else return [];
  }
  if (handle.name !== researchId) {
    throw new Error(`Choose Downloads/web-live-tracker/${researchId} or its web-live-tracker folder.`);
  }

  const exchanges = new Map();
  async function walk(directory, path) {
    const files = new Map();
    for await (const entry of directory.values()) {
      if (!validPart(entry.name) || entry.name.includes("/")) continue;
      if (entry.kind === "directory" && (path.length || dateFolder.test(entry.name))) {
        if (sameNameSelection && path.length === 1 && dateFolder.test(entry.name)) continue;
        await walk(entry, [...path, entry.name]);
      } else if (entry.kind === "file" && path.length >= 4 && exchangeFolder.test(directory.name) &&
                 captureFilename(entry.name)) {
        files.set(entry.name, () => entry.getFile());
      }
    }
    if (files.size) exchanges.set(path.join("/"), files);
  }
  await walk(handle, []);
  return readExchanges(exchanges);
}

function directoryDatabase() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open("web-live-tracker-folders", 1);
    request.onupgradeneeded = () => request.result.createObjectStore("folders");
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

async function storedDirectory(operation, mode) {
  const db = await directoryDatabase();
  try {
    return await new Promise((resolve, reject) => {
      const transaction = db.transaction("folders", mode);
      const request = operation(transaction.objectStore("folders"));
      transaction.oncomplete = () => resolve(request.result);
      transaction.onabort = () => reject(transaction.error);
    });
  } finally {
    db.close();
  }
}

export async function rememberCaptureDirectory(handle, researchId) {
  const isProject = handle.name === "web-live-tracker" &&
    (researchId !== handle.name || await childDirectory(handle, researchId));
  const key = isProject ? "project" : `research:${researchId}`;
  return storedDirectory((store) => store.put(handle, key), "readwrite");
}

export async function readGrantedCaptureDirectory(researchId) {
  for (const name of [`research:${researchId}`, "project"]) {
    const handle = await storedDirectory((store) => store.get(name));
    if (typeof handle?.queryPermission !== "function" || await handle.queryPermission({ mode: "read" }) !== "granted") continue;
    try {
      return await readCaptureDirectory(handle, researchId);
    } catch (error) {
      if (error.name !== "NotFoundError" && error.name !== "NotAllowedError") throw error;
    }
  }
  return null;
}

export async function preferredCaptureDirectory(researchId) {
  validateResearchId(researchId);
  const research = await storedDirectory((store) => store.get(`research:${researchId}`));
  return research ?? await storedDirectory((store) => store.get("project")) ?? "downloads";
}
