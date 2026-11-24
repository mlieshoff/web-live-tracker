const downloads = (globalThis.browser ?? globalThis.chrome).downloads;
const button = document.querySelector("#open-report");
const showButton = document.querySelector("#show-report");
const message = document.querySelector("#report-message");
const value = new URLSearchParams(location.search).get("id");
const id = Number(value);

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
      message.textContent = `Open ${filename} from the folder.`;
    } catch {
      message.textContent = `Could not show the file. Open ${filename} from your browser’s Downloads.`;
    }
  });
  button.addEventListener("click", async () => {
    try {
      await downloads.open(id);
      message.textContent = "Your browser asked your system to open the report. If it didn’t open, select Show report in folder.";
    } catch {
      message.textContent = "Could not open the report. Select Show report in folder.";
    }
  });
} catch {
  message.textContent = "Could not find the report. Check your browser’s Downloads.";
}
