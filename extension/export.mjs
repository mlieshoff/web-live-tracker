const reservedName = /^(con|prn|aux|nul|com[1-9]|lpt[1-9])$/i;

export function exportFilename(researchId, exportDate) {
  if (
    !/^[a-z0-9][a-z0-9_-]{0,63}$/i.test(researchId) ||
    reservedName.test(researchId)
  ) {
    throw new Error("Use 1–64 letters, numbers, hyphens or underscores. Begin with a letter or number and avoid reserved names such as CON.");
  }

  const folder = `web-live-tracker/${researchId}`;
  if (exportDate === undefined) {
    return `${folder}/traffic.json`;
  }

  const year = String(exportDate.getFullYear()).padStart(4, "0");
  const month = String(exportDate.getMonth() + 1).padStart(2, "0");
  const day = String(exportDate.getDate()).padStart(2, "0");
  return `${folder}/${year}-${month}-${day}/traffic.json`;
}

function waitForDownload(downloads, id) {
  return new Promise((resolve, reject) => {
    function fail(error) {
      downloads.onChanged.removeListener(onChanged);
      reject(error);
    }

    function complete(state) {
      if (state === "complete") {
        downloads.onChanged.removeListener(onChanged);
        resolve();
      } else if (state === "interrupted") {
        fail(new Error("The download was interrupted."));
      }
    }

    function onChanged(change) {
      if (change.id === id) {
        complete(change.state?.current);
      }
    }

    downloads.onChanged.addListener(onChanged);
    // A small export may finish before the download ID reaches this listener.
    downloads.search({ id }).then(([item]) => {
      if (item) {
        complete(item.state);
      } else {
        fail(new Error("Chrome could not find the download."));
      }
    }, fail);
  });
}

export async function exportCapture(downloads, researchId, records, exportDate) {
  const filename = exportFilename(researchId, exportDate);
  const data = new Blob([JSON.stringify({ researchId, requests: records }, null, 2) + "\n"], {
    type: "application/json",
  });
  const url = URL.createObjectURL(data);
  try {
    const id = await downloads.download({ url, filename, conflictAction: "uniquify" });
    await waitForDownload(downloads, id);
  } finally {
    URL.revokeObjectURL(url);
  }
}
