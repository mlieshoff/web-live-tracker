import { createCapture } from "./capture.mjs";
import { exportCapture, exportFilename } from "./export.mjs";
import { capturePayload, exportPayloads } from "./payload.mjs";

const start = document.querySelector("#start");
const stop = document.querySelector("#stop");
const status = document.querySelector("#capture-status");
const exportForm = document.querySelector("#export-form");
const researchId = document.querySelector("#research-id");
const datedFolders = document.querySelector("#dated-folders");
const save = document.querySelector("#save");
const recordBodies = document.querySelector("#record-bodies");
const saveBodies = document.querySelector("#save-bodies");
const exportStatus = document.querySelector("#export-status");
const payloads = [];
let count = 0;

function showCaptureStatus() {
  const state = start.disabled ? "Capturing." : "Capture stopped.";
  const label = count === 1 ? "request" : "requests";
  status.textContent = `${state} ${count} ${label} captured.`;
}

const capture = createCapture(chrome.devtools.network.onRequestFinished, (total, entry, metadata) => {
  if (recordBodies.checked) {
    payloads.push(capturePayload(entry, metadata));
  }
  count = total;
  showCaptureStatus();
});

start.addEventListener("click", () => {
  capture.start();
  start.disabled = true;
  stop.disabled = false;
  save.disabled = true;
  saveBodies.disabled = true;
  recordBodies.disabled = true;
  exportStatus.textContent = "";
  showCaptureStatus();
});

stop.addEventListener("click", () => {
  capture.stop();
  start.disabled = false;
  stop.disabled = true;
  save.disabled = count === 0;
  saveBodies.disabled = payloads.length === 0;
  recordBodies.disabled = false;
  showCaptureStatus();
});

exportForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  const exportBodies = event.submitter === saveBodies;
  if (exportBodies ? saveBodies.disabled : save.disabled) {
    return;
  }

  const id = researchId.value;
  const exportDate = exportBodies || datedFolders.checked ? new Date() : undefined;
  try {
    exportFilename(id);
  } catch (error) {
    exportStatus.textContent = error.message;
    researchId.focus();
    return;
  }

  start.disabled = true;
  save.disabled = true;
  saveBodies.disabled = true;
  recordBodies.disabled = true;
  researchId.disabled = true;
  datedFolders.disabled = true;
  exportStatus.textContent = "Exporting…";
  try {
    if (exportBodies) {
      await exportPayloads(chrome.downloads, id, await Promise.all(payloads), exportDate);
    } else {
      await exportCapture(chrome.downloads, id, capture.getRecords(), exportDate);
    }
    exportStatus.textContent = "Export saved. See Chrome downloads for the file.";
  } catch {
    exportStatus.textContent = exportBodies
      ? "Payload export failed. Some files may already be in Chrome downloads."
      : "Export failed. Check Chrome downloads and try again.";
  } finally {
    start.disabled = false;
    save.disabled = false;
    saveBodies.disabled = payloads.length === 0;
    recordBodies.disabled = false;
    researchId.disabled = false;
    datedFolders.disabled = false;
  }
});

start.disabled = false;
