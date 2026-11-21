# web-live-tracker

Chrome plugin to track and persist web traffic.

## First version

1. Open `chrome://extensions`, enable **Developer mode**, then use **Load unpacked** to select the `extension` folder.
2. Open DevTools in the tab you want to observe and select **Web Live Tracker** from the DevTools tabs or overflow menu.
3. Select **Start capture**, then reload the page or perform the actions you want to observe. Select **Stop capture** when finished.
4. Enter a research ID and select **Export JSON**. By default Chrome saves the export in `web-live-tracker/<research-id>/traffic.json` under its configured downloads location. Chrome may prompt for a location depending on your download settings.

Select **Group exports by date** to save under `web-live-tracker/<research-id>/YYYY-MM-DD/traffic.json`. The folder uses the local date when you select **Export JSON**. This option starts off when you open a new DevTools session.

Captures are kept in memory until DevTools closes. Starting capture again appends to the same record. Exports contain the timestamp, method, URL origin and path, status code, and media type when available. URL paths may themselves contain information you do not want to share.

Run the regression tests with `node --test`.

## Idea

As a user I can install and start the plugin in Chrome, do some basic setup:

* where to download all the captured data (requests/ responses / media)
* a flag to tell the plugin to store unzipped gzip'ed data
* a flag to support storing somehow dated, so i can have a view on what and when something was changed between some days within the same research 

The plugin will handle these topics for me:

* storing will happen on my hard-disk
* depending on content / media type processable data will be stored
* unknown media types will be stored also regarding on a media type detection
* storing will happen in a human-logical folder structure where i can define a research id as a base folder to separate the work between different sites
