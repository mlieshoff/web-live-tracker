# Web Live Tracker

Web Live Tracker is a Chrome extension that saves the network requests and responses Chrome makes available for the tab you’re inspecting. Enter a research ID, start capture, and browse as usual. Completed exchanges are saved to disk as you go.

For a German walkthrough with a real website example, see the [German installation and usage guide](README_DE.md).

## Install in Chrome

1. Download and extract the project ZIP. If you already have a local copy, use that folder. [Download ZIP](https://github.com/mlieshoff/web-live-tracker/archive/refs/heads/main.zip)
2. Type `chrome://extensions` into Chrome’s address bar and press Enter.
3. Turn on **Developer mode** and select **Load unpacked**.
4. Select the `extension` folder inside the extracted project. It contains [manifest.json](extension/manifest.json). Confirm that **Web Live Tracker** appears in the extensions list and is enabled.

Chrome loads the extension from that folder, so keep it in place. After updating the files, use the reload button on the extension’s card and reopen DevTools.

## Capture a tab

1. Open the website in Chrome. Right-click the page and select **Inspect** to open Chrome DevTools.
2. Select **Web Live Tracker** in the DevTools tab bar. If it’s hidden, open the **»** overflow menu.
3. Enter a **Research ID**, such as `my-first-capture`. Start with a letter or number and use up to 64 letters, numbers, hyphens, or underscores. Reserved folder names such as `CON` are rejected.
4. Select **Start capture**, reload the page to include its initial requests, and interact with it as usual. **Files saved** increases as Chrome writes files.
5. Select **Stop capture** when finished. Keep DevTools open until **Pending exchanges** reaches **0**. The research ID can be changed once the pending saves finish.

Starting capture saves any available raw request and response bodies. These files can contain private information. Use a public page without signing in for a first test and review files before sharing them.

## Find and read the files

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

Run the automated tests from the repository root with `node --test`. The extension itself loads directly from `extension/`.
