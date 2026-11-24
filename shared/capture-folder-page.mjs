import { preferredCaptureDirectory, readCaptureDirectory, readSelectedCaptureFiles, rememberCaptureDirectory } from "./capture-folder.mjs";
import { validateResearchId } from "./export.mjs";

const api = globalThis.browser ?? globalThis.chrome;
const researchId = new URLSearchParams(location.search).get("researchId");
const expectedFolder = document.querySelector("#expected-folder");
const choose = document.querySelector("#choose-folder");
const files = document.querySelector("#folder-files");
const status = document.querySelector("#folder-status");
let startIn = "downloads";

try {
  validateResearchId(researchId);
  expectedFolder.textContent = `Downloads/web-live-tracker/${researchId}`;
  const supportsDirectoryHandles = typeof globalThis.showDirectoryPicker === "function";
  choose.hidden = !supportsDirectoryHandles;
  files.hidden = supportsDirectoryHandles;
  if (supportsDirectoryHandles) {
    preferredCaptureDirectory(researchId).then((directory) => { startIn = directory; }).catch(() => {});
  }
} catch {
  status.textContent = "Open this page from Web Live Tracker.";
}

async function sendEntries(entries) {
  const accepted = await api.runtime.sendMessage({ action: "openReportFromFolder", researchId, entries });
  if (!accepted) throw new Error("Return to Web Live Tracker and open the report again.");
  status.textContent = "The capture report is ready.";
  try {
    const tab = await api.tabs.getCurrent();
    await api.tabs.remove(tab.id);
  } catch {
    // The report can be opened from the capture panel if the browser keeps this tab.
  }
}

choose.addEventListener("click", async () => {
  choose.disabled = true;
  try {
    const handle = await showDirectoryPicker({ id: "web-live-tracker", startIn, mode: "read" });
    status.textContent = "Reading saved capture files…";
    const entries = await readCaptureDirectory(handle, researchId);
    await rememberCaptureDirectory(handle, researchId).catch(() => {});
    await sendEntries(entries);
  } catch (error) {
    if (["AbortError", "NotAllowedError", "NotSupportedError", "SecurityError"].includes(error.name)) {
      files.hidden = false;
      status.textContent = "You can also select your research folder using the file chooser.";
    } else {
      status.textContent = error.message;
    }
  } finally {
    choose.disabled = false;
  }
});

files.addEventListener("change", async () => {
  if (!files.files.length) return;
  files.disabled = true;
  status.textContent = "Reading saved capture files…";
  try {
    await sendEntries(await readSelectedCaptureFiles(files.files, researchId));
  } catch (error) {
    status.textContent = error.message;
    files.value = "";
    files.disabled = false;
  }
});
