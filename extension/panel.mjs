import { createLiveCapture } from "./live-capture.mjs";

const form = document.querySelector("#capture-form");
const researchId = document.querySelector("#research-id");
const start = document.querySelector("#start");
const stop = document.querySelector("#stop");
const status = document.querySelector("#capture-status");
const idError = document.querySelector("#research-id-error");

const capture = createLiveCapture(chrome.devtools.network.onRequestFinished, chrome.downloads, ({
  active, captured, pending, saved, failed, reason,
}) => {
  const busy = active || pending > 0;
  researchId.disabled = busy;
  start.disabled = busy;
  stop.disabled = !active;

  const state = active ? "Capturing." : pending > 0 ? "Finishing queued saves." : "Capture stopped.";
  const failure = failed ? ` ${failed} exchanges had save errors. ${reason}` : "";
  status.textContent = `${state} Requests captured ${captured}. Files saved ${saved}. Pending exchanges ${pending}.${failure}`;
});

form.addEventListener("submit", (event) => {
  event.preventDefault();
  try {
    capture.start(researchId.value);
    idError.textContent = "";
    researchId.removeAttribute("aria-invalid");
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
stop.addEventListener("click", () => capture.stop());
start.disabled = false;
