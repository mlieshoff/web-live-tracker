import { createCapture } from "./capture.mjs";
import { exportCapture, exportFilename } from "./export.mjs";

const start = document.querySelector("#start");
const stop = document.querySelector("#stop");
const status = document.querySelector("#capture-status");
const exportForm = document.querySelector("#export-form");
const researchId = document.querySelector("#research-id");
const datedFolders = document.querySelector("#dated-folders");
const save = document.querySelector("#save");
const exportStatus = document.querySelector("#export-status");
let count = 0;

function showCaptureStatus() {
  const state = start.disabled ? "Capturing." : "Capture stopped.";
  const label = count === 1 ? "request" : "requests";
  status.textContent = `${state} ${count} ${label} captured.`;
}

const capture = createCapture(chrome.devtools.network.onRequestFinished, (total) => {
  count = total;
  showCaptureStatus();
});

start.addEventListener("click", () => {
  capture.start();
  start.disabled = true;
  stop.disabled = false;
  save.disabled = true;
  exportStatus.textContent = "";
  showCaptureStatus();
});

stop.addEventListener("click", () => {
  capture.stop();
  start.disabled = false;
  stop.disabled = true;
  save.disabled = count === 0;
  showCaptureStatus();
});

exportForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  if (save.disabled) {
    return;
  }

  const id = researchId.value;
  const exportDate = datedFolders.checked ? new Date() : undefined;
  try {
    exportFilename(id);
  } catch (error) {
    exportStatus.textContent = error.message;
    researchId.focus();
    return;
  }

  start.disabled = true;
  save.disabled = true;
  researchId.disabled = true;
  datedFolders.disabled = true;
  exportStatus.textContent = "Exporting…";
  try {
    await exportCapture(chrome.downloads, id, capture.getRecords(), exportDate);
    exportStatus.textContent = "Export saved. See Chrome downloads for the file.";
  } catch {
    exportStatus.textContent = "Export failed. Check Chrome downloads and try again.";
  } finally {
    start.disabled = false;
    save.disabled = false;
    researchId.disabled = false;
    datedFolders.disabled = false;
  }
});
