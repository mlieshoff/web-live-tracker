import { DownloadError } from "../shared/export.mjs";

export const requestFinished = globalThis.browser?.devtools?.network?.onRequestFinished;
export const networkMonitorTip = "In Firefox, open the Network tab once, then return here to start capture.";

export function createPanel() {
  globalThis.browser.devtools.panels.create("Web Live Tracker", "", "shared/panel.html");
}

export function readResponseContent(entry, callback) {
  return entry.getContent().then(
    ([content]) => callback(content, entry.response.content?.encoding),
    () => callback(undefined),
  );
}

export async function saveExtensionFile(filename, data) {
  const result = await globalThis.browser.runtime.sendMessage({ action: "saveCaptureFile", filename, data });
  if (!result?.filename) {
    throw new DownloadError(result?.error ?? "Firefox could not save the file.");
  }
  return result.filename;
}
