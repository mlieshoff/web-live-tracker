# web-live-tracker

Chrome plugin to track and persist web traffic.

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