import { preferredCaptureDirectory, readCaptureDirectory, readSelectedCaptureFiles, rememberCaptureDirectory, UnexpectedCaptureFolderError } from "./capture-folder.mjs";
import { validateResearchId } from "./export.mjs";

import { captureFolderMessages, readPanelLanguage } from "./panel-language.mjs";

const language = readPanelLanguage(localStorage);
const messages = captureFolderMessages[language];
const api = globalThis.browser ?? globalThis.chrome;
const researchId = new URLSearchParams(location.search).get("researchId");
const expectedFolder = document.querySelector("#expected-folder");
const choose = document.querySelector("#choose-folder");
const files = document.querySelector("#folder-files");
const status = document.querySelector("#folder-status");
let startIn = "downloads";
let useDirectoryPicker = typeof globalThis.showDirectoryPicker === "function";

document.documentElement.lang = language;
document.title = messages.title;
document.querySelector("h1").textContent = messages.title;
document.querySelector("#folder-instruction-start").textContent = messages.instructionStart;
document.querySelector("#folder-instruction-end").textContent = messages.instructionEnd;
choose.textContent = messages.choose;

try {
  validateResearchId(researchId);
  expectedFolder.textContent = `Downloads/web-live-tracker/${researchId}`;
  choose.hidden = false;
  if (useDirectoryPicker) {
    preferredCaptureDirectory(researchId).then((directory) => { startIn = directory; }).catch(() => {});
  }
} catch {
  status.textContent = messages.invalidLink;
}

async function sendEntries(entries) {
  const accepted = await api.runtime.sendMessage({ action: "openReportFromFolder", researchId, entries });
  if (!accepted) {
    status.textContent = messages.reopen;
    return;
  }
  status.textContent = messages.ready;
  try {
    const tab = await api.tabs.getCurrent();
    await api.tabs.remove(tab.id);
  } catch {
    // The report can be opened from the capture panel if the browser keeps this tab.
  }
}

function showReadError(error) {
  status.textContent = error instanceof UnexpectedCaptureFolderError
    ? messages.wrongFolder(expectedFolder.textContent)
    : messages.readFailed;
}

choose.addEventListener("click", async () => {
  if (!useDirectoryPicker) {
    files.click();
    return;
  }
  choose.disabled = true;
  try {
    const handle = await showDirectoryPicker({ id: "web-live-tracker", startIn, mode: "read" });
    status.textContent = messages.reading;
    const entries = await readCaptureDirectory(handle, researchId);
    await rememberCaptureDirectory(handle, researchId).catch(() => {});
    await sendEntries(entries);
  } catch (error) {
    if (["AbortError", "NotAllowedError", "NotSupportedError", "SecurityError"].includes(error.name)) {
      useDirectoryPicker = false;
      status.textContent = messages.fallback;
    } else {
      showReadError(error);
    }
  } finally {
    choose.disabled = false;
  }
});

files.addEventListener("change", async () => {
  if (!files.files.length) return;
  choose.disabled = true;
  status.textContent = messages.reading;
  try {
    await sendEntries(await readSelectedCaptureFiles(files.files, researchId));
  } catch (error) {
    showReadError(error);
  } finally {
    files.value = "";
    choose.disabled = false;
  }
});
