# Web Live Tracker for Chrome

Web Live Tracker saves the network requests and responses your browser makes available for the tab you’re inspecting. Enter a research ID, start capture, and browse as usual. Completed exchanges are saved to disk as you go.

For a German walkthrough with a real website example, see the [German installation and usage guide](README_DE.md).

## Install in Chrome

1. Get `web-live-tracker-chrome.zip` from the project’s `chrome` folder and extract it into its own folder. You can also use a copy of that ZIP someone shared with you.
2. Type `chrome://extensions` into Chrome’s address bar and press Enter.
3. Turn on **Developer mode** and select **Load unpacked**.
4. Select the extracted folder that contains `manifest.json`. Confirm that **Web Live Tracker** appears in the extensions list and is enabled.

Chrome loads the extension from that folder, so keep it in place. After updating the files, use the reload button on the extension’s card and reopen DevTools.

## Capture a tab

1. Open the website in Chrome. Right-click the page and select **Inspect** to open Chrome DevTools.
2. Select **Web Live Tracker** in the DevTools tab bar. If it’s hidden, open the **»** overflow menu.
3. Enter a **Research ID**, such as `my-first-capture`. Start with a letter or number and use up to 64 letters, numbers, hyphens, or underscores. Reserved folder names such as `CON` are rejected.
4. Select **Start capture**, reload the page to include its initial requests, and interact with it as usual. **Files saved** increases as Chrome writes files.
5. Select **Stop capture** when finished. Keep DevTools open until the capture report is ready. You can change the research ID after the report finishes saving.

Starting capture saves any available raw request and response bodies. These files can contain private information. Use a public page without signing in for a first test and review files before sharing them.

## Find and read the files

After selecting **Stop capture**, keep DevTools open until the panel says your report is ready. Select **Open capture report**. The report groups saved files by type and links to the files and raw records. **What needs attention** explains missing files and partial media.

You can reopen the report from Downloads or find `capture-*.html` in `web-live-tracker/<research-id>/`. Keep it in that folder so the file links work.

To continue a capture, enter the same **Research ID**. After the capture saves a new file, the report automatically links earlier files found in this browser’s Downloads history under `Downloads/web-live-tracker/<research-id>/`. Open the raw records for the earlier capture details. If the browser’s download history was cleared, look for the earlier files in that folder.

The base folder is Chrome’s configured download location. To find it, open `chrome://downloads` and use the folder icon next to a saved file, or check the location at `chrome://settings/downloads`.

```text
web-live-tracker/<research-id>/<YYYY-MM-DD>/<host>/<URL-path>/<exchange-id>/
  exchange.json
  request.json
  response.png
```

The filenames above are examples. Each exchange has its own folder, so repeated requests to the same URL stay separate. The date is the browser’s local date when the request started. A URL path may be escaped or shortened to make a valid folder name. The full captured URL origin and path remain in `exchange.json`.

- **`exchange.json`** records the request time, method, URL, response status and media type, and the names and availability of the body files. Open it in a text editor. The recorded URL omits the query string and fragment.
- **`request.*`** contains data the browser sent when Chrome provides the body. A request that sends no body has no request file.
- **`response.*`** contains data the website sent back when Chrome provides the body. Open a `.png` or `.jpg` in an image viewer and a `.json` or `.txt` in a text editor.

Audio and video can arrive as byte ranges. For HTTP 206 responses, `responseRange` in `exchange.json` records the range when the server provides it. A saved range can be only part of a media file. When Chrome withholds a body, `responseUnavailableReason` records why the file is missing. Streams that never finish do not produce a completed exchange.

For an unavailable complete audio or video GET, the tracker can make one anonymous request to an eligible public URL. It skips URLs with query strings, private addresses, and authenticated requests. The retry uses no cookies or referrer, follows no redirects, and requires the server to allow cross-origin access. It is limited to 30 seconds and 64 MiB. The metadata marks a recovered file with `responseSource: "refetched"` because it comes from a second request. If the retry fails, `responseRetryError` records why.

The tracker uses the declared media type or a recognizable binary signature to choose a file extension. Unidentified and active content uses `.txt` or `.bin`. Chrome decodes HTTP compression such as gzip for responses. Downloadable archive files are saved as archives. Compressed uploads and other bodies Chrome cannot provide are marked unavailable.

## Troubleshooting

| What you see | What to check |
| --- | --- |
| **Web Live Tracker** is missing | Check that the extension is enabled at `chrome://extensions`. Reopen DevTools in the website tab and look under **»**. |
| The request count stays at zero | Check that the panel says **Capturing.** and reload the website while capture is active. |
| Chrome prompts for each file | Check **Ask where to save each file before downloading** at `chrome://settings/downloads`. Turning it off lets Chrome use its configured download folder automatically. |
| Some files fail to save | Read the error in the panel and check `chrome://downloads` for the download status. Other exchanges may still save. |
| A folder contains only `exchange.json` | Look at `requestBody` and `responseBody` to see whether the body was absent, unavailable, or failed to save. |

## Development

Run the automated tests from the repository root with `node --test`.

To create an installable ZIP, run this from the project root in a shell with Git available. On Windows, use Git Bash.

```sh
sh scripts/package-extension.sh chrome
```

The command writes `chrome/web-live-tracker-chrome.zip` from the committed sources and guides.
