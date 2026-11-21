import { createCapture } from "./capture.mjs";

const start = document.querySelector("#start");
const stop = document.querySelector("#stop");
const status = document.querySelector("#capture-status");
let count = 0;

function showCaptureStatus() {
  const state = start.disabled ? "Capturing." : "Capture stopped.";
  status.textContent = `${state} ${count} requests captured.`;
}

const capture = createCapture(chrome.devtools.network.onRequestFinished, (total) => {
  count = total;
  showCaptureStatus();
});

start.addEventListener("click", () => {
  capture.start();
  start.disabled = true;
  stop.disabled = false;
  showCaptureStatus();
});

stop.addEventListener("click", () => {
  capture.stop();
  start.disabled = false;
  stop.disabled = true;
  showCaptureStatus();
});
