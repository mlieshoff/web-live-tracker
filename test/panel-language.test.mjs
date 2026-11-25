import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { panelMessages, readPanelLanguage, savePanelLanguage, translateDiagnostic } from "../shared/panel-language.mjs";

const panel = readFileSync(new URL("../shared/panel.html", import.meta.url), "utf8");

test("the panel falls back to English for a missing or obsolete language preference", () => {
  const storage = { getItem: () => "fr" };
  assert.deepEqual([readPanelLanguage(new MapStorage()), readPanelLanguage(storage)], ["en", "en"]);
});

test("the panel remembers German and can switch back to English", () => {
  const storage = new MapStorage();
  savePanelLanguage(storage, "de");
  const german = readPanelLanguage(storage);
  savePanelLanguage(storage, "en");
  assert.deepEqual([german, readPanelLanguage(storage)], ["de", "en"]);
});

test("each panel label has copy in both languages", () => {
  const keys = [...panel.matchAll(/data-message="([^"]+)"/g)].map(([, key]) => key);
  assert.deepEqual(
    keys.filter((key) => !panelMessages.en[key] || !panelMessages.de[key]),
    [],
  );
});

test("German capture diagnostics keep error counts and paths usable", () => {
  assert.deepEqual([
    panelMessages.de.active,
    panelMessages.de.saveErrors(2, 1),
    panelMessages.de.saveErrors(3, 2),
    translateDiagnostic("de", "The download path is too long."),
    panelMessages.de.reportOpenFailed("capture-2026.html"),
  ], [
    "Aufzeichnung läuft.",
    "Speicherfehler (2 in 1 Vorgang)",
    "Speicherfehler (3 in 2 Vorgängen)",
    "Der Download-Pfad ist zu lang.",
    "Der Bericht konnte nicht geöffnet werden. Öffne capture-2026.html über die Downloads deines Browsers.",
  ]);
});

class MapStorage {
  values = new Map();
  getItem(key) {
    return this.values.get(key) ?? null;
  }
  setItem(key, value) {
    this.values.set(key, value);
  }
}
