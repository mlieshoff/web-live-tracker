import { readPanelLanguage } from "./panel-language.mjs";
import { reportMessages } from "./report-language.mjs";

const downloads = (globalThis.browser ?? globalThis.chrome).downloads;
const button = document.querySelector("#open-report");
const showButton = document.querySelector("#show-report");
const message = document.querySelector("#report-message");
const value = new URLSearchParams(location.search).get("id");
const id = Number(value);
const language = readPanelLanguage(localStorage);
const messages = reportMessages[language];
document.documentElement.lang = language;
document.title = messages.openTitle;
document.querySelector("h1").textContent = messages.title;
message.textContent = messages.finding;
button.textContent = messages.openDownload;
showButton.textContent = messages.showInFolder;

try {
  const [item] = value && Number.isSafeInteger(id) ? await downloads.search({ id }) : [];
  const filename = item?.filename.split(/[\\/]/).at(-1);
  if (item?.state !== "complete" || !/^capture-.*\.html$/i.test(filename)) {
    throw new Error("Report unavailable.");
  }

  message.textContent = filename;
  button.hidden = false;
  showButton.hidden = false;
  showButton.addEventListener("click", async () => {
    try {
      await downloads.show(id);
      message.textContent = messages.openFromFolder(filename);
    } catch {
      message.textContent = messages.showFailed(filename);
    }
  });
  button.addEventListener("click", async () => {
    try {
      await downloads.open(id);
      message.textContent = messages.openRequested;
    } catch {
      message.textContent = messages.openFailed;
    }
  });
} catch {
  message.textContent = messages.notFound;
}
