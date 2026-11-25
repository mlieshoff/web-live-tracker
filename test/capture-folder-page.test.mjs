import assert from "node:assert/strict";
import test from "node:test";

for (const [language, title, button, wrongFolder] of [
  ["en", "Choose research folder", "Choose folder", /^Choose Downloads\/web-live-tracker\/sample/],
  ["de", "Rechercheordner auswählen", "Ordner auswählen", /^Wähle Downloads\/web-live-tracker\/sample/],
]) {
  test(`the folder page localizes the file input fallback and its errors in ${language}`, async (context) => {
    const elements = new Map();
    const document = {
      documentElement: {},
      querySelector(selector) {
        if (!elements.has(selector)) {
          elements.set(selector, {
            hidden: true,
            addEventListener(event, listener) { this[event] = listener; },
          });
        }
        return elements.get(selector);
      },
    };
    const globals = {
      document,
      location: { search: "?researchId=sample" },
      localStorage: { getItem: () => language },
      showDirectoryPicker: undefined,
    };
    for (const [key, value] of Object.entries(globals)) {
      const previous = Object.getOwnPropertyDescriptor(globalThis, key);
      Object.defineProperty(globalThis, key, { configurable: true, value });
      context.after(() => {
        if (previous) Object.defineProperty(globalThis, key, previous);
        else delete globalThis[key];
      });
    }
    await import(`../shared/capture-folder-page.mjs?${language}`);

    const choose = elements.get("#choose-folder");
    const input = elements.get("#folder-files");
    input.click = context.mock.fn();
    await choose.click();
    input.files = [{ webkitRelativePath: "wrong/file.json" }];
    await input.change();

    assert.deepEqual(
      [document.documentElement.lang, document.title, choose.textContent, choose.hidden, input.hidden, input.click.mock.callCount()],
      [language, title, button, false, true, 1],
    );
    assert.match(elements.get("#folder-status").textContent, wrongFolder);
  });
}
