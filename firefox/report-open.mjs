const button = document.querySelector("#open-report");
const message = document.querySelector("#report-message");
const value = new URLSearchParams(location.search).get("id");
const id = Number(value);

try {
  const [item] = value && Number.isSafeInteger(id) ? await browser.downloads.search({ id }) : [];
  const filename = item?.filename.split(/[\\/]/).at(-1);
  if (item?.state !== "complete" || !/^capture-.*\.html$/i.test(filename)) {
    throw new Error("Report unavailable.");
  }

  message.textContent = filename;
  button.hidden = false;
  button.addEventListener("click", async () => {
    try {
      await browser.downloads.open(id);
      message.textContent = filename;
    } catch {
      message.textContent = `Could not open the report. Try opening ${filename} from Firefox Downloads.`;
    }
  });
} catch {
  message.textContent = "Could not find the report. Check Firefox Downloads.";
}
