import { DownloadError, downloadWithDetails } from "../shared/export.mjs";

browser.runtime.onMessage.addListener((message, sender) => {
  if (sender.id !== browser.runtime.id ||
      sender.url !== browser.runtime.getURL("shared/panel.html")) {
    return undefined;
  }

  if (message?.action === "showCaptureReport" && Number.isSafeInteger(message.id)) {
    const url = browser.runtime.getURL(`browser/report-open.html?id=${message.id}`);
    return browser.tabs.create({ url }).then(() => true);
  }
  if (message?.action !== "saveCaptureFile") return undefined;

  const { filename, data } = message;
  if (typeof filename !== "string" || !filename.startsWith("web-live-tracker/") ||
      filename.split("/").some((part) => !part || part === ".." || part === ".") ||
      filename.includes("\\") || !(data instanceof Blob)) {
    return Promise.resolve({ error: "Firefox received an invalid capture file." });
  }

  return downloadWithDetails(browser.downloads, filename, data).catch(
    (error) => ({ error: error instanceof DownloadError ? error.message : "Firefox could not save the file." }),
  );
});
