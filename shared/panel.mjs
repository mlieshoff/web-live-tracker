import { readGrantedCaptureDirectory } from "./capture-folder.mjs";
import { validateResearchId } from "./export.mjs";
import { createLiveCapture } from "./live-capture.mjs";
import { networkMonitorTip, openCaptureFolderPicker, openCaptureReport, readResponseContent, requestFinished, saveCaptureReport, saveExtensionFile } from "../browser/browser-api.mjs";

const form = document.querySelector("#capture-form");
const researchId = document.querySelector("#research-id");
const savePath = document.querySelector("#save-path");
const start = document.querySelector("#start");
const stop = document.querySelector("#stop");
const status = document.querySelector("#capture-status");
const idError = document.querySelector("#research-id-error");
const saveErrors = document.querySelector("#save-errors");
const saveErrorSummary = document.querySelector("#save-error-summary");
const saveErrorLimit = document.querySelector("#save-error-limit");
const saveErrorList = document.querySelector("#save-error-list");
const capturedCount = document.querySelector("#captured-count");
const savedCount = document.querySelector("#saved-count");
const pendingCount = document.querySelector("#pending-count");
const openReport = document.querySelector("#open-report");
const reportError = document.querySelector("#report-error");
const runtime = (globalThis.browser ?? globalThis.chrome).runtime;
let pickerUrl;
let readyReport;
let displayedReport;
let displayedErrors;
const networkTip = document.querySelector("#network-monitor-tip");
networkTip.textContent = networkMonitorTip;
networkTip.hidden = !networkMonitorTip;

function showText(element, value) {
  if (element.textContent !== value) {
    element.textContent = value;
  }
}

function showSaveErrors(failed, errorCount, errors) {
  saveErrors.hidden = failed === 0;
  if (failed === 0) {
    saveErrors.open = false;
  }
  if (errors === displayedErrors) {
    return;
  }

  displayedErrors = errors;
  const label = failed === 1 ? "exchange" : "exchanges";
  showText(saveErrorSummary, `Save errors (${errorCount} in ${failed} ${label})`);
  saveErrorLimit.hidden = errors.length === errorCount;
  showText(saveErrorLimit, `Showing the latest ${errors.length} of ${errorCount} errors.`);
  saveErrorList.replaceChildren(...errors.map(({ target, reason }) => {
    const row = document.createElement("li");
    const path = document.createElement("code");
    const message = document.createElement("p");
    path.textContent = target;
    message.textContent = reason;
    row.append(path, message);
    return row;
  }));
}

function onStatus({
  active, captured, pending, saved, failed, errorCount, errors, report,
}) {
  const busy = active || pending > 0 || report?.state === "saving";
  researchId.disabled = busy;
  start.disabled = busy;
  stop.disabled = !active;
  openReport.disabled = busy || !researchId.value;

  status.dataset.state = active ? "active" : busy ? "finishing" : "stopped";
  const message = active ? "Capturing."
    : pending > 0 ? "Finishing file saves."
    : busy ? "Saving the capture report."
    : report?.state === "ready" ? "Your report is ready." : "Capture stopped.";
  showText(status, message);
  if (displayedReport !== report) {
    displayedReport = report;
    readyReport = report?.state === "ready" ? report : undefined;
    showText(reportError, report?.state === "failed" ? `The report could not be saved. ${report.error}` : "");
  }
  showText(capturedCount, String(captured));
  showText(savedCount, String(saved));
  showText(pendingCount, String(pending));
  showSaveErrors(failed, errorCount, errors);

  if (!busy && document.activeElement === status) {
    (readyReport ? openReport : researchId).focus();
  }
}

const capture = createLiveCapture({
  requestFinished, writeFile: saveExtensionFile, writeReport: saveCaptureReport,
  readEarlierFolder: readGrantedCaptureDirectory, readResponseContent, onStatus,
});

async function showReport(report) {
  if (report?.state !== "ready") return false;
  try {
    await openCaptureReport(report.id);
    if (readyReport === report) showText(reportError, "");
    return true;
  } catch {
    if (readyReport === report) {
      showText(reportError, `Could not open the report. Open ${report.filename} from your browser’s Downloads.`);
    }
    return false;
  }
}

async function prepareSelectedReport(id, entries) {
  const prepared = capture.prepareReport(id, entries);
  if (prepared) status.focus();
  return showReport(await prepared);
}

openReport.addEventListener("click", async () => {
  const id = researchId.value;
  if (readyReport?.researchId === id && !readyReport.needsFolder) {
    await showReport(readyReport);
    return;
  }
  try {
    validateResearchId(id);
  } catch (error) {
    showResearchIdError(error);
    return;
  }

  showText(savePath, `Downloads/web-live-tracker/${id}/`);
  showText(idError, "");
  researchId.removeAttribute("aria-invalid");
  openReport.disabled = true;
  try {
    const entries = await readGrantedCaptureDirectory(id).catch(() => null);
    if (researchId.value !== id || researchId.disabled) return;
    if (entries !== null) {
      await prepareSelectedReport(id, entries);
    } else {
      const url = new URL("capture-folder.html", location.href);
      url.search = new URLSearchParams({ researchId: id, request: crypto.randomUUID() });
      pickerUrl = url.href;
      await openCaptureFolderPicker(pickerUrl);
    }
  } catch {
    showText(reportError, "Could not open the research folder picker. Try again.");
  } finally {
    openReport.disabled = researchId.disabled || !researchId.value;
  }
});

runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (!pickerUrl || sender.url !== pickerUrl || message?.action !== "openReportFromFolder" ||
      researchId.disabled || message.researchId !== researchId.value || !Array.isArray(message.entries)) return;

  pickerUrl = undefined;
  prepareSelectedReport(message.researchId, message.entries).then(sendResponse, () => sendResponse(false));
  return true;
});

function showResearchIdError(error) {
  idError.textContent = error.message;
  researchId.setAttribute("aria-invalid", "true");
  researchId.focus();
}

form.addEventListener("submit", (event) => {
  event.preventDefault();
  try {
    pickerUrl = undefined;
    capture.start(researchId.value);
    showText(savePath, `Downloads/web-live-tracker/${researchId.value}/`);
    idError.textContent = "";
    researchId.removeAttribute("aria-invalid");
    if (!stop.disabled) stop.focus();
  } catch (error) {
    showResearchIdError(error);
  }
});

researchId.addEventListener("input", () => {
  pickerUrl = undefined;
  idError.textContent = "";
  showText(reportError, "");
  openReport.disabled = !researchId.value;
  showText(savePath, "Downloads/web-live-tracker/<research ID>/");
  researchId.removeAttribute("aria-invalid");
});
stop.addEventListener("click", () => {
  capture.stop();
  (researchId.disabled ? status : researchId).focus();
});
start.disabled = false;
