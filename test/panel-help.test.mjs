import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const panelUrl = new URL("../shared/panel.mjs", import.meta.url);
const markup = readFileSync(new URL("../shared/panel.html", import.meta.url), "utf8");

test("the question-mark button targets a named modal with a native close control", () => {
  assert.match(markup, /<button id="open-help"[^>]*type="button" aria-label="Help" aria-haspopup="dialog">\?<\/button>[\s\S]*<dialog id="help-dialog" aria-labelledby="help-title">[\s\S]*<h2 id="help-title"[\s\S]*<form method="dialog">\s*<button type="submit"[^>]*autofocus>/);
});

for (const browserName of ["chrome", "firefox"]) {
  test(`the ${browserName} panel switches its help, validation and active capture labels together`, () =>
    verifyPanelSwitching(browserName));
}

async function verifyPanelSwitching(browserName) {
  const { document, elements, labels, tooltips } = panelDocument();
  const storage = new Map([["panel-language", "de"]]);
  const requestFinished = new Set();
  const browser = {
    runtime: { getManifest: () => ({ version: "1.2.3" }), onMessage: { addListener() {} } },
    devtools: { network: { onRequestFinished: {
      addListener: (listener) => requestFinished.add(listener),
      removeListener: (listener) => requestFinished.delete(listener),
    } } },
  };
  const globals = {
    chrome: browserName === "chrome" ? browser : undefined,
    browser: browserName === "firefox" ? browser : undefined,
    document,
    localStorage: {
      getItem: (key) => storage.get(key),
      setItem: (key, value) => storage.set(key, value),
    },
  };
  for (const [key, value] of Object.entries(globals)) {
    Object.defineProperty(globalThis, key, { configurable: true, value });
  }

  // The package places the selected browser adapter at browser/browser-api.mjs.
  const source = readFileSync(panelUrl, "utf8").replace(
    /from "([^"]+)";/g,
    (_, path) => `from "${new URL(path.replace("../browser/", `../${browserName}/`), panelUrl)}";`,
  );
  await import(`data:text/javascript,${encodeURIComponent(source)}`);

  assert.equal(elements.get("extension-version").textContent, "v1.2.3");
  const field = elements.get("research-id");
  const language = elements.get("panel-language");
  const help = elements.get("open-help");
  const dialog = elements.get("help-dialog");
  const status = elements.get("capture-status");
  const error = elements.get("research-id-error");
  const networkTip = elements.get("network-monitor-tip");
  assert.equal(networkTip.hidden, false);
  assert.match(networkTip.textContent, browserName === "firefox"
    ? /Firefox.*Netzwerkanalyse.*HTTP-Cache deaktivieren/
    : /Chrome.*Netzwerk.*Cache deaktivieren/);

  help.dispatchEvent(new Event("click"));
  assert.deepEqual([
    document.documentElement.lang, dialog.open, help.getAttribute("aria-label"),
    labels.get("helpTitle").textContent, labels.get("helpClose").textContent,
  ], ["de", true, "Hilfe", "Kurzanleitung zur Aufzeichnung", "Schließen"]);
  dialog.open = false;
  assert.equal(tooltips.size, 12);
  const germanTooltips = new Map([...tooltips].map(([key, element]) => [key, element.getAttribute("title")]));

  field.value = "";
  elements.get("capture-form").dispatchEvent(new Event("submit"));
  assert.match(error.textContent, /^Verwende 1–64/);
  language.value = "en";
  language.dispatchEvent(new Event("change"));
  assert.match(error.textContent, /^Use 1–64/);
  assert.match(networkTip.textContent, browserName === "firefox"
    ? /Firefox.*Network tab.*Disable HTTP Cache/
    : /Chrome.*Network tab.*Disable cache/);
  assert.deepEqual(
    [...tooltips].filter(([key, element]) => {
      const title = element.getAttribute("title");
      return !germanTooltips.get(key) || !title || title === germanTooltips.get(key)
        || title !== element.getAttribute("aria-description");
    }).map(([key]) => key),
    [],
  );

  field.value = "qa-capture";
  elements.get("capture-form").dispatchEvent(new Event("submit"));
  assert.equal(status.textContent, "Capturing.");
  language.value = "de";
  language.dispatchEvent(new Event("change"));
  assert.deepEqual([
    document.documentElement.lang, status.textContent, requestFinished.size,
    elements.get("save-path").textContent, storage.get("panel-language"),
  ], ["de", "Aufzeichnung läuft.", 1, "Downloads/web-live-tracker/qa-capture/", "de"]);

  language.value = "en";
  language.dispatchEvent(new Event("change"));
  help.dispatchEvent(new Event("click"));
  assert.deepEqual([
    labels.get("helpTitle").textContent, labels.get("helpClose").textContent,
    help.getAttribute("aria-label"), status.textContent, dialog.open,
  ], ["Capture guide", "Close", "Help", "Capturing.", true]);
}

function panelDocument() {
  const elements = new Map();
  const labels = new Map();
  const tooltips = new Map();
  const document = {
    documentElement: {},
    createElement: () => new PanelElement(),
    querySelector: (selector) => elements.get(selector.slice(1)),
    querySelectorAll: (selector) => [...(selector === "[data-tooltip]" ? tooltips : labels).values()],
  };

  for (const [tag] of markup.matchAll(/<[^>]+>/g)) {
    const id = tag.match(/\bid="([^"]+)"/)?.[1];
    const message = tag.match(/\bdata-message="([^"]+)"/)?.[1];
    const tooltip = tag.match(/\bdata-tooltip="([^"]+)"/)?.[1];
    const element = new PanelElement();
    element.focus = () => { document.activeElement = element; };
    if (id) elements.set(id, element);
    if (message) {
      element.dataset.message = message;
      labels.set(message, element);
    }
    if (tooltip) {
      element.dataset.tooltip = tooltip;
      tooltips.set(tooltip, element);
    }
  }
  return { document, elements, labels, tooltips };
}

class PanelElement extends EventTarget {
  dataset = {};
  attributes = new Map();
  getAttribute(name) { return this.attributes.get(name); }
  setAttribute(name, value) { this.attributes.set(name, value); }
  removeAttribute(name) { this.attributes.delete(name); }
  replaceChildren() {}
  showModal() { this.open = true; }
}
