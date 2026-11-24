import { DownloadError } from "../shared/export.mjs";

export const requestFinished = globalThis.browser?.devtools?.network?.onRequestFinished;
export const networkMonitorTip = "In Firefox, open the Network tab once, then return here to start capture.";

export function createPanel() {
  // Firefox resolves the panel path relative to the DevTools page.
  globalThis.browser.devtools.panels.create("Web Live Tracker", "", "panel.html");
}

export function readResponseContent(entry, callback) {
  return entry.getContent().then(
    ([content]) => callback(content, entry.response.content?.encoding),
    () => callback(undefined),
  );
}

export async function saveExtensionFile(filename, data) {
  return (await saveCaptureReport(filename, data)).filename;
}

export async function saveCaptureReport(filename, data) {
  const result = await globalThis.browser.runtime.sendMessage({ action: "saveCaptureFile", filename, data });
  if (!result?.filename) {
    throw new DownloadError(result?.error ?? "Firefox could not save the file.");
  }
  return result;
}

export function openCaptureReport(id) {
  return globalThis.browser.runtime.sendMessage({ action: "showCaptureReport", id }).then((opened) => {
    if (!opened) throw new Error("Could not open the report page.");
  });
}

export async function findEarlierDownloads(researchId) {
  const items = await globalThis.browser.runtime.sendMessage({ action: "findEarlierDownloads", researchId });
  if (!Array.isArray(items)) throw new Error("Firefox could not read earlier downloads.");
  return items;
}
