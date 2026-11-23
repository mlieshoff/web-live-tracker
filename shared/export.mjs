const reservedName = /^(con|prn|aux|nul|com[1-9]|lpt[1-9])$/i;

const downloadMessages = new Map([
  ["FILE_ACCESS_DENIED", "The browser could not write to the download destination."],
  ["FILE_NAME_TOO_LONG", "The download path is too long."],
  ["FILE_NO_SPACE", "The download destination is out of space."],
  ["FILE_BLOCKED", "The browser blocked the file."],
  ["FILE_FAILED", "The browser could not create the file. Check the downloads folder and its permissions."],
  ["FILE_SECURITY_CHECK_FAILED", "The file did not pass the browser’s download security check."],
  ["USER_CANCELED", "The download was canceled."],
]);

export class DownloadError extends Error {}

export function validateResearchId(researchId) {
  if (
    typeof researchId !== "string" ||
    !/^[a-z0-9][a-z0-9_-]{0,63}$/i.test(researchId) ||
    reservedName.test(researchId)
  ) {
    throw new Error("Use 1–64 letters, numbers, hyphens or underscores. Begin with a letter or number and avoid reserved names such as CON.");
  }
}

export function exportFolder(researchId, captureDate) {
  validateResearchId(researchId);
  const year = String(captureDate.getFullYear()).padStart(4, "0");
  const month = String(captureDate.getMonth() + 1).padStart(2, "0");
  const day = String(captureDate.getDate()).padStart(2, "0");
  return `web-live-tracker/${researchId}/${year}-${month}-${day}`;
}

function waitForDownload(downloads, id) {
  return new Promise((resolve, reject) => {
    function fail(error) {
      downloads.onChanged.removeListener(onChanged);
      reject(error);
    }

    function complete(state, reason, filename) {
      if (state === "complete") {
        downloads.onChanged.removeListener(onChanged);
        resolve(filename);
      } else if (state === "interrupted") {
        fail(new DownloadError(downloadMessages.get(reason) ?? "The download was interrupted."));
      }
    }

    function onChanged(change) {
      if (change.id === id) {
        complete(change.state?.current, change.error?.current);
      }
    }

    downloads.onChanged.addListener(onChanged);
    // A small export may finish before the download ID reaches this listener.
    downloads.search({ id }).then(([item]) => {
      if (item) {
        complete(item.state, item.error, item.filename);
      } else {
        fail(new DownloadError("The browser could not find the download."));
      }
    }, fail);
  });
}

export function jsonFile(data) {
  return new Blob([JSON.stringify(data, null, 2) + "\n"], {
    type: "application/json",
  });
}

export async function downloadFile(downloads, filename, data) {
  const url = URL.createObjectURL(data);
  try {
    const id = await downloads.download({ url, filename, conflictAction: "uniquify" });
    const completedPath = await waitForDownload(downloads, id);
    const actualPath = completedPath || (await downloads.search({ id }).catch(() => []))[0]?.filename;
    return (actualPath || filename).split(/[\\/]/).at(-1);
  } catch (error) {
    if (error instanceof DownloadError) {
      throw error;
    }
    const message = String(error?.message ?? "");
    if (/invalid filename/i.test(message)) {
      throw new DownloadError("The browser rejected the download filename.");
    }
    if (/failed to start/i.test(message)) {
      throw new DownloadError("The download failed to start. Check your browser’s downloads.");
    }
    throw new DownloadError("The browser could not save the file. Check your browser’s downloads.");
  } finally {
    URL.revokeObjectURL(url);
  }
}
