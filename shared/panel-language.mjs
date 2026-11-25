export const panelMessages = {
  en: {
    language: "Language",
    helpButton: "Help",
    helpTitle: "Capture guide",
    helpStart: "Enter a research ID and choose Start capture. Use the inspected tab to generate the requests you want to save.",
    helpStop: "Choose Stop capture and wait for the files and report to finish saving.",
    helpFiles: "Find your files in your browser’s Downloads folder under web-live-tracker, then your research ID. Capture files are grouped by date.",
    helpReport: "Choose Open capture report. If prompted, select your research folder to include earlier captures.",
    helpClose: "Close",
    researchId: "Research ID",
    start: "Start capture",
    stop: "Stop capture",
    openReport: "Open capture report",
    saveLocation: "Find your files and reports under ",
    researchIdPlaceholder: "<research ID>",
    capturedCount: "Requests captured",
    savedCount: "Files saved",
    pendingCount: "Pending exchanges",
    stopped: "Capture stopped.",
    active: "Capturing.",
    finishing: "Finishing file saves.",
    savingReport: "Saving the capture report.",
    reportReady: "Your report is ready.",
    invalidResearchId: "Use 1–64 letters, numbers, hyphens or underscores. Begin with a letter or number and avoid reserved names such as CON.",
    reportSaveFailed: (detail) => `The report could not be saved. ${detail}`,
    reportOpenFailed: (filename) => `Could not open the report. Open ${filename} from your browser’s Downloads.`,
    pickerOpenFailed: "Could not open the research folder picker. Try again.",
    networkMonitorTip: {
      chrome: "Open Chrome’s Network tab, then return here to start capture. For a more complete recording, enable Disable cache in the Network tab.",
      firefox: "Open Firefox’s Network tab once, then return here to start capture. For a more complete recording, enable Disable HTTP Cache in the Network tab.",
    },
    saveErrors: (count, failed) => `Save errors (${count} in ${failed} ${failed === 1 ? "exchange" : "exchanges"})`,
    saveErrorLimit: (shown, total) => `Showing the latest ${shown} of ${total} errors.`,
  },
  de: {
    language: "Sprache",
    helpButton: "Hilfe",
    helpTitle: "Kurzanleitung zur Aufzeichnung",
    helpStart: "Gib eine Recherche-ID ein und wähle „Aufzeichnung starten“. Führe im untersuchten Tab die Aktionen aus, deren Anfragen du speichern möchtest.",
    helpStop: "Wähle „Aufzeichnung stoppen“ und warte, bis die Dateien und der Bericht gespeichert sind.",
    helpFiles: "Die Dateien liegen im Download-Ordner deines Browsers unter web-live-tracker und deiner Recherche-ID. Die Aufzeichnungsdateien sind nach Datum sortiert.",
    helpReport: "Wähle „Aufzeichnungsbericht öffnen“. Wenn du dazu aufgefordert wirst, wähle deinen Rechercheordner aus, um frühere Aufzeichnungen einzubeziehen.",
    helpClose: "Schließen",
    researchId: "Recherche-ID",
    start: "Aufzeichnung starten",
    stop: "Aufzeichnung stoppen",
    openReport: "Aufzeichnungsbericht öffnen",
    saveLocation: "Dateien und Berichte findest du unter ",
    researchIdPlaceholder: "<Recherche-ID>",
    capturedCount: "Erfasste Anfragen",
    savedCount: "Gespeicherte Dateien",
    pendingCount: "Ausstehende Vorgänge",
    stopped: "Aufzeichnung gestoppt.",
    active: "Aufzeichnung läuft.",
    finishing: "Dateien werden noch gespeichert.",
    savingReport: "Der Aufzeichnungsbericht wird gespeichert.",
    reportReady: "Der Bericht ist fertig.",
    invalidResearchId: "Verwende 1–64 Buchstaben, Ziffern, Bindestriche oder Unterstriche. Beginne mit einem Buchstaben oder einer Ziffer und vermeide reservierte Namen wie CON.",
    reportSaveFailed: (detail) => `Der Bericht konnte nicht gespeichert werden. ${detail}`,
    reportOpenFailed: (filename) => `Der Bericht konnte nicht geöffnet werden. Öffne ${filename} über die Downloads deines Browsers.`,
    pickerOpenFailed: "Die Auswahl des Rechercheordners konnte nicht geöffnet werden. Versuche es erneut.",
    networkMonitorTip: {
      chrome: "Öffne in Chrome den Reiter „Netzwerk“ und kehre zum Starten der Aufzeichnung hierher zurück. Aktiviere dort „Cache deaktivieren“, um mehr Anfragen zu erfassen.",
      firefox: "Öffne in Firefox einmal den Reiter „Netzwerkanalyse“ und kehre zum Starten der Aufzeichnung hierher zurück. Aktiviere dort „HTTP-Cache deaktivieren“, um mehr Anfragen zu erfassen.",
    },
    saveErrors: (count, failed) => `Speicherfehler (${count} in ${failed} ${failed === 1 ? "Vorgang" : "Vorgängen"})`,
    saveErrorLimit: (shown, total) => `Die letzten ${shown} von ${total} Fehlern werden angezeigt.`,
  },
};

export const captureFolderMessages = {
  en: {
    title: "Choose research folder",
    instructionStart: "Select ",
    instructionEnd: " or the web-live-tracker folder that contains it.",
    choose: "Choose folder",
    invalidLink: "Open this page from Web Live Tracker.",
    reopen: "Return to Web Live Tracker and open the report again.",
    ready: "The capture report is ready.",
    reading: "Reading saved capture files…",
    fallback: "Choose the folder again to use the file chooser.",
    wrongFolder: (path) => `Choose ${path} or its web-live-tracker folder.`,
    readFailed: "Could not read the saved capture files. Check the folder and try again.",
  },
  de: {
    title: "Rechercheordner auswählen",
    instructionStart: "Wähle ",
    instructionEnd: " oder den übergeordneten Ordner web-live-tracker aus.",
    choose: "Ordner auswählen",
    invalidLink: "Öffne diese Seite über Web Live Tracker.",
    reopen: "Kehre zu Web Live Tracker zurück und öffne den Bericht erneut.",
    ready: "Der Aufzeichnungsbericht ist fertig.",
    reading: "Gespeicherte Aufzeichnungsdateien werden gelesen…",
    fallback: "Wähle den Ordner erneut aus, um die Dateiauswahl zu verwenden.",
    wrongFolder: (path) => `Wähle ${path} oder den übergeordneten Ordner web-live-tracker aus.`,
    readFailed: "Die gespeicherten Aufzeichnungsdateien konnten nicht gelesen werden. Prüfe den Ordner und versuche es erneut.",
  },
};

const languageKey = "panel-language";

export function readPanelLanguage(storage) {
  return storage.getItem(languageKey) === "de" ? "de" : "en";
}

export function savePanelLanguage(storage, language) {
  storage.setItem(languageKey, language);
}

// Capture records retain their original diagnostic text for standalone reports.
const germanDiagnostics = new Map([
  ["The browser could not write to the download destination.", "Der Browser konnte nicht in den Download-Ordner schreiben."],
  ["The download path is too long.", "Der Download-Pfad ist zu lang."],
  ["The download destination is out of space.", "Im Download-Ziel ist kein Speicherplatz mehr verfügbar."],
  ["The browser blocked the file.", "Der Browser hat die Datei blockiert."],
  ["The browser could not create the file. Check the downloads folder and its permissions.", "Der Browser konnte die Datei nicht anlegen. Prüfe den Download-Ordner und seine Berechtigungen."],
  ["The file did not pass the browser’s download security check.", "Die Datei hat die Download-Sicherheitsprüfung des Browsers nicht bestanden."],
  ["The download was canceled.", "Der Download wurde abgebrochen."],
  ["The download was interrupted.", "Der Download wurde unterbrochen."],
  ["The browser could not find the download.", "Der Browser konnte den Download nicht finden."],
  ["The browser rejected the download filename.", "Der Browser hat den Dateinamen des Downloads abgelehnt."],
  ["The download failed to start. Check your browser’s downloads.", "Der Download konnte nicht gestartet werden. Prüfe die Downloads deines Browsers."],
  ["The browser could not save the file. Check your browser’s downloads.", "Der Browser konnte die Datei nicht speichern. Prüfe die Downloads deines Browsers."],
  ["The files could not be prepared for saving.", "Die Dateien konnten nicht zum Speichern vorbereitet werden."],
  ["This exchange could not be prepared for saving.", "Dieser Vorgang konnte nicht zum Speichern vorbereitet werden."],
  ["The capture report could not be saved.", "Der Aufzeichnungsbericht konnte nicht gespeichert werden."],
  ["The file could not be saved.", "Die Datei konnte nicht gespeichert werden."],
  ["Firefox received an invalid capture file.", "Firefox hat eine ungültige Aufzeichnungsdatei erhalten."],
  ["Firefox could not save the file.", "Firefox konnte die Datei nicht speichern."],
]);

export function translateDiagnostic(language, detail) {
  return language === "de" ? germanDiagnostics.get(detail) ?? detail : detail;
}

export const panelTooltips = {
  en: {
    language: "Changes the language of the panel, guide, and reports opened from the panel.",
    help: "Read the quick guide to capturing requests, finding files, and opening reports.",
    researchId: "Names the download folder for this project. Reuse the same ID to group related captures.",
    start: "Begin saving requests and responses from the inspected tab for this research ID.",
    stop: "Stop taking new requests. Pending files finish saving before the report is created.",
    openReport: "Open a report for this research ID. You may be asked to select its download folder.",
    captureStatus: "Shows whether capture is running, downloads are finishing, or the report is ready.",
    saveLocation: "Capture files go into dated subfolders. Reports are saved directly in the research folder.",
    capturedCount: "Requests recorded since this capture started.",
    savedCount: "Files successfully saved for this capture, excluding the HTML report.",
    pendingCount: "Captured requests whose files have not finished processing.",
    saveErrors: "Expand to see which files or requests could not be saved and why.",
  },
  de: {
    language: "Ändert die Sprache des Panels, der Kurzanleitung und der Berichte, die du über das Panel öffnest.",
    help: "Lies, wie du Anfragen aufzeichnest, Dateien findest und Berichte öffnest.",
    researchId: "Legt den Namen des Download-Ordners fest. Verwende dieselbe ID für zusammengehörige Aufzeichnungen.",
    start: "Speichert ab jetzt Anfragen und Antworten aus dem untersuchten Tab für diese Recherche-ID.",
    stop: "Erfasst keine neuen Anfragen mehr. Ausstehende Dateien werden noch vor dem Bericht gespeichert.",
    openReport: "Öffnet den Bericht für diese Recherche-ID. Möglicherweise musst du den zugehörigen Download-Ordner auswählen.",
    captureStatus: "Zeigt an, ob die Aufzeichnung läuft, Dateien noch gespeichert werden oder der Bericht fertig ist.",
    saveLocation: "Aufzeichnungsdateien liegen in Unterordnern nach Datum. Berichte liegen direkt im Rechercheordner.",
    capturedCount: "Seit Beginn dieser Aufzeichnung erfasste Anfragen.",
    savedCount: "Erfolgreich gespeicherte Dateien dieser Aufzeichnung. Der HTML-Bericht wird separat gespeichert.",
    pendingCount: "Erfasste Anfragen, deren Dateien noch verarbeitet werden.",
    saveErrors: "Zeigt beim Aufklappen, welche Dateien oder Anfragen nicht gespeichert werden konnten und warum.",
  },
};
