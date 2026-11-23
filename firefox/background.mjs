import { DownloadError, downloadFile } from "../shared/export.mjs";

browser.runtime.onMessage.addListener((message, sender) => {
  if (message?.action !== "saveCaptureFile" ||
      sender.id !== browser.runtime.id ||
      sender.url !== browser.runtime.getURL("shared/panel.html")) {
    return undefined;
  }

  const { filename, data } = message;
  if (typeof filename !== "string" || !filename.startsWith("web-live-tracker/") ||
      filename.split("/").some((part) => !part || part === ".." || part === ".") ||
      filename.includes("\\") || !(data instanceof Blob)) {
    return Promise.resolve({ error: "Firefox received an invalid capture file." });
  }

  return downloadFile(browser.downloads, filename, data).then(
    (savedName) => ({ filename: savedName }),
    (error) => ({ error: error instanceof DownloadError ? error.message : "Firefox could not save the file." }),
  );
});
