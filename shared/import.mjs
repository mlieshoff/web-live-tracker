import { loadEarlierCaptures } from "./earlier-captures.mjs";
import { validateResearchId } from "./export.mjs";

const api = globalThis.browser ?? globalThis.chrome;
const researchId = new URLSearchParams(location.search).get("researchId");
const help = document.querySelector("#import-help");
const folder = document.querySelector("#earlier-folder");
const status = document.querySelector("#import-status");
const returnButton = document.querySelector("#return");

try {
  validateResearchId(researchId);
  help.textContent = `Choose the "${researchId}" folder inside web-live-tracker in Downloads. The tracker reads its records locally.`;
  folder.disabled = false;
} catch {
  help.textContent = "Open this page from the Web Live Tracker panel.";
}

folder.addEventListener("change", async () => {
  if (!folder.files.length) return;
  folder.disabled = true;
  status.textContent = "Reading earlier captures.";

  try {
    const earlier = await loadEarlierCaptures(folder.files, researchId);
    const accepted = await api.runtime.sendMessage({ action: "includeEarlierCaptures", researchId, earlier }).catch(() => false);
    if (!accepted) throw new Error("Open Choose research folder again from the capture panel.");
    status.textContent = "Earlier captures are ready. Return to the panel and select Start capture.";
    returnButton.hidden = false;
    returnButton.focus();
  } catch (error) {
    status.textContent = error.message;
    folder.value = "";
    folder.disabled = false;
  }
});

returnButton.addEventListener("click", async () => {
  try {
    const tab = await api.tabs.getCurrent();
    await api.tabs.remove(tab.id);
  } catch {
    status.textContent = "Close this tab to return to your capture.";
  }
});
