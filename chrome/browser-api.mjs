import { downloadFile, downloadWithDetails } from "../shared/export.mjs";

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

export function saveCaptureReport(filename, data) {
  return downloadWithDetails(globalThis.chrome.downloads, filename, data, { saveAs: false });
}

export async function openCaptureReport(id) {
  const { downloads, runtime, tabs } = globalThis.chrome;
  try {
    await downloads.open(id);
  } catch {
    const url = runtime.getURL(`shared/report-open.html?id=${id}`);
    await tabs.create({ url });
  }
}

export function openCaptureFolderPicker(url) {
  return globalThis.chrome.tabs.create({ url });
}
