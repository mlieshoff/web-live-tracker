# Web Live Tracker for Firefox

This package shares the capture panel, payload handling, and file layout with the Chrome extension. Firefox DevTools determines which response bodies it can provide.

[German installation and usage guide](README_DE.md)

## Install in desktop Firefox

1. Save `web-live-tracker-firefox.zip` to your computer.
2. Open `about:debugging#/runtime/this-firefox` in Firefox.
3. Select **Load Temporary Add-on…** and choose the ZIP. You can also extract it and select the `manifest.json` at the root of the extracted files.

The temporary add-on stays loaded until Firefox restarts or you remove it. [Mozilla’s temporary installation guide](https://extensionworkshop.com/documentation/develop/temporary-installation-in-firefox/)

## Capture and find files

1. Open the page to capture. Right-click it and select **Inspect**.
2. Open **Network** once. To capture a fresh reload, enable **Disable Cache** in Firefox’s Network toolbar.
3. Switch to **Web Live Tracker**. Enter a **Research ID** and select **Start capture**.
4. Reload or use the page. When finished, select **Stop capture** and leave DevTools open until the panel says your report is ready. Select **Open capture report**, then **Open downloaded report** in the new tab. If your system does not open it, select **Show report in folder**.
5. Open Firefox’s downloads list or configured download folder. The files are under `web-live-tracker/<research-id>/<local-date>/<host>/<URL-path>/<exchange-id>/`.

Requests and responses that Firefox provides are saved automatically with their file types when known. `exchange.json` identifies the body files and records partial or unavailable responses. The media retry follows the same anonymous request rules as the Chrome version.

Identical response bytes within a capture share one saved file. Every exchange keeps its raw record. If it shares a response, `responseFilePath` points to that file relative to the research folder. Partial responses are shared only when their byte ranges are known and match.

The capture report groups saved files by type and links to the files and raw records. **What needs attention** explains missing files and partial media. Reopen the report from Downloads or find `capture-*.html` in `web-live-tracker/<research-id>/`. Keep it in that folder so the file links work.

The report shows small previews for supported images and videos using the capture files. SVGs are listed under **Images** and small SVGs appear as non-interactive image previews. Captured SVGs keep their original neutral export format. Select an SVG preview to open the full-size image in a new tab. File links also open in new tabs. Audio and media without a preview remain linked.

To review a previous capture, enter its **Research ID** and select **Open capture report** before or after recording. If asked, select the matching folder under `Downloads/web-live-tracker/` or pick the parent `web-live-tracker` folder. The report reads the files directly from the selected folder, so clearing download history has no effect. Firefox asks you to select the folder when a fresh read is needed.

## Build the ZIP

Run `sh scripts/package-extension.sh firefox` from the repository root. The command writes `firefox/web-live-tracker-firefox.zip` from the committed sources and guides.
