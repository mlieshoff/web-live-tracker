import { DownloadError, downloadFile } from "./export.mjs";

const gecko = globalThis.browser?.runtime?.getManifest()?.browser_specific_settings?.gecko;

export const isFirefox = Boolean(gecko);
export const extensionApi = isFirefox ? globalThis.browser : globalThis.chrome;

export function readResponseContent(entry, callback, firefox = isFirefox) {
  if (!firefox) {
    return entry.getContent(callback);
  }

  return entry.getContent().then(
    ([content]) => callback(content, entry.response.content?.encoding),
    () => callback(undefined),
  );
}
export async function saveExtensionFile(filename, data) {
  if (!isFirefox) {
    return downloadFile(extensionApi.downloads, filename, data);
  }

  const result = await extensionApi.runtime.sendMessage({ action: "saveCaptureFile", filename, data });
  if (!result?.filename) {
    throw new DownloadError(result?.error ?? "Firefox could not save the file.");
  }
  return result.filename;
}
