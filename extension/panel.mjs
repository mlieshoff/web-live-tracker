import { createLiveCapture } from "./live-capture.mjs";

const form = document.querySelector("#capture-form");
const researchId = document.querySelector("#research-id");
const start = document.querySelector("#start");
const stop = document.querySelector("#stop");
const status = document.querySelector("#capture-status");
const idError = document.querySelector("#research-id-error");
const saveErrors = document.querySelector("#save-errors");
const saveErrorCount = document.querySelector("#save-error-count");
const saveErrorLimit = document.querySelector("#save-error-limit");
const saveErrorList = document.querySelector("#save-error-list");
const capturedCount = document.querySelector("#captured-count");
const savedCount = document.querySelector("#saved-count");
const pendingCount = document.querySelector("#pending-count");
let displayedErrors;

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
  showText(saveErrorCount, `(${errorCount} in ${failed} ${label})`);
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

const capture = createLiveCapture(chrome.devtools.network.onRequestFinished, chrome.downloads, ({
  active, captured, pending, saved, failed, errorCount, errors,
}) => {
  const busy = active || pending > 0;
  researchId.disabled = busy;
  start.disabled = busy;
  stop.disabled = !active;

  status.dataset.state = active ? "active" : pending > 0 ? "finishing" : "stopped";
  showText(status, { active: "Capturing.", finishing: "Finishing queued saves.", stopped: "Capture stopped." }[status.dataset.state]);
  showText(capturedCount, String(captured));
  showText(savedCount, String(saved));
  showText(pendingCount, String(pending));
  showSaveErrors(failed, errorCount, errors);

  if (!busy && document.activeElement === status) {
    researchId.focus();
  }
});

form.addEventListener("submit", (event) => {
  event.preventDefault();
  try {
    capture.start(researchId.value);
    idError.textContent = "";
    researchId.removeAttribute("aria-invalid");
    if (!stop.disabled) {
      stop.focus();
    }
  } catch (error) {
    idError.textContent = error.message;
    researchId.setAttribute("aria-invalid", "true");
    researchId.focus();
  }
});

researchId.addEventListener("input", () => {
  idError.textContent = "";
  researchId.removeAttribute("aria-invalid");
});
stop.addEventListener("click", () => {
  capture.stop();
  (researchId.disabled ? status : researchId).focus();
});
start.disabled = false;
