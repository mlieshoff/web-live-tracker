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
  return (await saveFile("saveCaptureFile", filename, data)).filename;
}

export function saveCaptureReport(filename, data) {
  return saveFile("saveReportFile", filename, data);
}

async function saveFile(action, filename, data) {
  const result = await globalThis.browser.runtime.sendMessage({ action, filename, data });
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

export async function openCaptureFolderPicker(url) {
  const opened = await globalThis.browser.runtime.sendMessage({ action: "openCaptureFolderPicker", url });
  if (!opened) throw new Error("Could not open the research folder picker.");
}
