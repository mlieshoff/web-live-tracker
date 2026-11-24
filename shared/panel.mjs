import { validateResearchId } from "./export.mjs";
import { createLiveCapture } from "./live-capture.mjs";
import { networkMonitorTip, openCaptureReport, readResponseContent, requestFinished, saveCaptureReport, saveExtensionFile } from "../browser/browser-api.mjs";

const form = document.querySelector("#capture-form");
const researchId = document.querySelector("#research-id");
const chooseEarlier = document.querySelector("#choose-earlier");
const earlierResult = document.querySelector("#earlier-result");
const runtime = (globalThis.browser ?? globalThis.chrome).runtime;
let earlier;
let importUrl;
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
  chooseEarlier.hidden = busy;
  start.disabled = busy;
  stop.disabled = !active;

  status.dataset.state = active ? "active" : busy ? "finishing" : "stopped";
  const message = active ? "Capturing."
    : pending > 0 ? "Finishing file saves."
    : busy ? "Saving the capture report."
    : report?.state === "ready" ? "Capture complete. Your report is ready." : "Capture stopped.";
  showText(status, message);
  if (displayedReport !== report) {
    displayedReport = report;
    readyReport = report?.state === "ready" ? report : undefined;
    openReport.hidden = !readyReport;
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
  requestFinished, writeFile: saveExtensionFile, writeReport: saveCaptureReport, readResponseContent, onStatus,
});

openReport.addEventListener("click", async () => {
  const report = readyReport;
  try {
    await openCaptureReport(report.id);
    if (readyReport === report) showText(reportError, "");
  } catch {
    if (readyReport === report) {
      showText(reportError, `Could not open the report. Open ${report.filename} from your browser’s Downloads.`);
    }
  }
});

function showResearchIdError(error) {
  idError.textContent = error.message;
  researchId.setAttribute("aria-invalid", "true");
  researchId.focus();
}

chooseEarlier.addEventListener("click", (event) => {
  try {
    validateResearchId(researchId.value);
    const url = new URL("import.html", location.href);
    url.search = new URLSearchParams({ researchId: researchId.value, capture: crypto.randomUUID() });
    importUrl = chooseEarlier.href = url.href;
  } catch (error) {
    event.preventDefault();
    showResearchIdError(error);
  }
});

runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (!importUrl || sender.url !== importUrl || message?.action !== "includeEarlierCaptures") return;
  if (researchId.disabled || message.researchId !== researchId.value) return;

  importUrl = undefined;
  earlier = message.earlier;
  const size = earlier.records.length;
  const skipped = earlier.unreadable ? ` (${earlier.unreadable} unreadable)` : "";
  showText(earlierResult, `${size} earlier ${size === 1 ? "record" : "records"} selected${skipped}.`);
  sendResponse(true);
});

form.addEventListener("submit", (event) => {
  event.preventDefault();
  try {
    capture.start(researchId.value, earlier);
    importUrl = undefined;
    earlier = undefined;
    showText(earlierResult, "");
    idError.textContent = "";
    researchId.removeAttribute("aria-invalid");
    if (!stop.disabled) stop.focus();
  } catch (error) {
    showResearchIdError(error);
  }
});

researchId.addEventListener("input", () => {
  idError.textContent = "";
  importUrl = undefined;
  earlier = undefined;
  showText(earlierResult, "");
  researchId.removeAttribute("aria-invalid");
});
stop.addEventListener("click", () => {
  capture.stop();
  (researchId.disabled ? status : researchId).focus();
});
start.disabled = false;
