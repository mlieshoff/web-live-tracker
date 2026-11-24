import { DownloadError, downloadWithDetails } from "../shared/export.mjs";

browser.runtime.onMessage.addListener((message, sender) => {
  if (sender.id !== browser.runtime.id ||
      sender.url !== browser.runtime.getURL("shared/panel.html")) {
    return undefined;
  }

  if (message?.action === "openCaptureFolderPicker" &&
      typeof message.url === "string" && message.url.startsWith(browser.runtime.getURL("shared/capture-folder.html?"))) {
    return browser.tabs.create({ url: message.url }).then(() => true);
  }
  if (message?.action === "showCaptureReport" && Number.isSafeInteger(message.id)) {
    const url = browser.runtime.getURL(`shared/report-open.html?id=${message.id}`);
    return browser.tabs.create({ url }).then(() => true);
  }
  const isReport = message?.action === "saveReportFile";
  if (!isReport && message?.action !== "saveCaptureFile") return undefined;

  const { filename, data } = message;
  if (typeof filename !== "string" || !filename.startsWith("web-live-tracker/") ||
      filename.split("/").some((part) => !part || part === ".." || part === ".") ||
      filename.includes("\\") || !(data instanceof Blob)) {
    return Promise.resolve({ error: "Firefox received an invalid capture file." });
  }

  return downloadWithDetails(browser.downloads, filename, data, isReport ? { saveAs: false } : {}).catch(
    (error) => ({ error: error instanceof DownloadError ? error.message : "Firefox could not save the file." }),
  );
});
