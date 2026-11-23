import { downloadFile } from "../shared/export.mjs";

export const requestFinished = globalThis.chrome?.devtools?.network?.onRequestFinished;
export const networkMonitorTip = "";

export function createPanel() {
  globalThis.chrome.devtools.panels.create("Web Live Tracker", "", "shared/panel.html");
}

export function readResponseContent(entry, callback) {
  return entry.getContent(callback);
}

export function saveExtensionFile(filename, data) {
  return downloadFile(globalThis.chrome.downloads, filename, data);
}
