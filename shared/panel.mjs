import { readGrantedCaptureDirectory } from "./capture-folder.mjs";
import { validateResearchId } from "./export.mjs";
import { createLiveCapture } from "./live-capture.mjs";
import { panelMessages, readPanelLanguage, savePanelLanguage, translateDiagnostic } from "./panel-language.mjs";
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
let lastStatus;
let reportMessage;
let hasResearchIdError = false;
let displayedResearchId;
const languageSelect = document.querySelector("#panel-language");
const helpButton = document.querySelector("#open-help");
const helpDialog = document.querySelector("#help-dialog");
let language = readPanelLanguage(localStorage);
let messages;
const networkTip = document.querySelector("#network-monitor-tip");
networkTip.hidden = !networkMonitorTip;

function showText(element, value) {
  if (element.textContent !== value) {
    element.textContent = value;
  }
}

function showSavePath(id) {
  displayedResearchId = id;
  showText(savePath, `Downloads/web-live-tracker/${id ?? messages.researchIdPlaceholder}/`);
}

function showReportMessage(key, detail) {
  reportMessage = key ? { key, detail } : undefined;
  renderReportMessage();
}

function renderReportMessage() {
  if (!reportMessage) {
    showText(reportError, "");
    return;
  }
  const { key, detail } = reportMessage;
  const message = messages[key];
  const argument = key === "reportSaveFailed" ? translateDiagnostic(language, detail) : detail;
  showText(reportError, typeof message === "function" ? message(argument) : message);
}

function applyLanguage() {
  messages = panelMessages[language];
  document.documentElement.lang = language;
  languageSelect.value = language;
  helpButton.setAttribute("aria-label", messages.helpButton);
  for (const element of document.querySelectorAll("[data-message]")) {
    showText(element, messages[element.dataset.message]);
  }
  showText(networkTip, networkMonitorTip ? messages.networkMonitorTip : "");
  showText(idError, hasResearchIdError ? messages.invalidResearchId : "");
  showSavePath(displayedResearchId);
  if (lastStatus) {
    displayedErrors = undefined;
    renderCaptureMessages(lastStatus);
  } else {
    showText(status, messages.stopped);
  }
  renderReportMessage();
}

languageSelect.addEventListener("change", () => {
  language = languageSelect.value;
  applyLanguage();
  savePanelLanguage(localStorage, language);
});
helpButton.addEventListener("click", () => helpDialog.showModal());
applyLanguage();

function showSaveErrors(failed, errorCount, errors) {
  saveErrors.hidden = failed === 0;
  if (failed === 0) {
    saveErrors.open = false;
  }
  showText(saveErrorSummary, messages.saveErrors(errorCount, failed));
  if (errors === displayedErrors) {
    return;
  }

  displayedErrors = errors;
  saveErrorLimit.hidden = errors.length === errorCount;
  showText(saveErrorLimit, messages.saveErrorLimit(errors.length, errorCount));
  saveErrorList.replaceChildren(...errors.map(({ target, reason }) => {
    const row = document.createElement("li");
    const path = document.createElement("code");
    const message = document.createElement("p");
    path.textContent = target;
    message.textContent = translateDiagnostic(language, reason);
    row.append(path, message);
    return row;
  }));
}

function renderCaptureMessages({ active, pending, failed, errorCount, errors, report }) {
  const message = active ? "active"
    : pending > 0 ? "finishing"
    : report?.state === "saving" ? "savingReport"
    : report?.state === "ready" ? "reportReady" : "stopped";
  showText(status, messages[message]);
  showSaveErrors(failed, errorCount, errors);
}

function onStatus(snapshot) {
  lastStatus = snapshot;
  const { active, captured, pending, saved, report } = snapshot;
  const busy = active || pending > 0 || report?.state === "saving";
  researchId.disabled = busy;
  start.disabled = busy;
  stop.disabled = !active;
  openReport.disabled = busy || !researchId.value;

  status.dataset.state = active ? "active" : busy ? "finishing" : "stopped";
  renderCaptureMessages(snapshot);
  if (displayedReport !== report) {
    displayedReport = report;
    readyReport = report?.state === "ready" ? report : undefined;
    showReportMessage(report?.state === "failed" ? "reportSaveFailed" : undefined, report?.error);
  }
  showText(capturedCount, String(captured));
  showText(savedCount, String(saved));
  showText(pendingCount, String(pending));

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
    if (readyReport === report) showReportMessage();
    return true;
  } catch {
    if (readyReport === report) {
      showReportMessage("reportOpenFailed", report.filename);
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
  } catch {
    showResearchIdError();
    return;
  }

  showSavePath(id);
  clearResearchIdError();
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
    showReportMessage("pickerOpenFailed");
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

function showResearchIdError() {
  hasResearchIdError = true;
  showText(idError, messages.invalidResearchId);
  researchId.setAttribute("aria-invalid", "true");
  researchId.focus();
}

function clearResearchIdError() {
  hasResearchIdError = false;
  showText(idError, "");
  researchId.removeAttribute("aria-invalid");
}

form.addEventListener("submit", (event) => {
  event.preventDefault();
  try {
    pickerUrl = undefined;
    capture.start(researchId.value);
    showSavePath(researchId.value);
    clearResearchIdError();
    if (!stop.disabled) stop.focus();
  } catch {
    showResearchIdError();
  }
});

researchId.addEventListener("input", () => {
  pickerUrl = undefined;
  clearResearchIdError();
  showReportMessage();
  openReport.disabled = !researchId.value;
  showSavePath();
});
stop.addEventListener("click", () => {
  capture.stop();
  (researchId.disabled ? status : researchId).focus();
});
start.disabled = false;
