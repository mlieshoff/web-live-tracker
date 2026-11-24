# Web Live Tracker

[![Tests](https://github.com/mlieshoff/web-live-tracker/actions/workflows/tests.yml/badge.svg?branch=main&event=push)](https://github.com/mlieshoff/web-live-tracker/actions/workflows/tests.yml?query=branch%3Amain)
[![Release workflow](https://github.com/mlieshoff/web-live-tracker/actions/workflows/story-release.yml/badge.svg)](https://github.com/mlieshoff/web-live-tracker/actions/workflows/story-release.yml)

Web Live Tracker is a desktop browser extension for Chrome and Firefox. It captures requests and responses from the tab you inspect and saves available files locally, organized by research ID, date, and URL.

| Browser | Installation and usage |
| --- | --- |
| Chrome | [Chrome guide](chrome/README.md) |
| Firefox | [Firefox guide](firefox/README.md) |

Download the Chrome and Firefox ZIPs from [GitHub Releases](https://github.com/mlieshoff/web-live-tracker/releases). Each release uses the version from the merged story PR as its title and tag (for example, `v0.1.1`). The release notes list the story and task titles. Both editions use the same capture code.

[Deutsch](README_DE.md)

## Updating the extension version

Update [VERSION](VERSION) and the `version` fields in both browser manifests in the same commit. Use `MAJOR.MINOR.PATCH`, with major bumps for breaking changes, minor bumps for compatible features, and patch bumps for compatible fixes.

With Node.js available, run `sh scripts/package-extension.sh chrome` or `sh scripts/package-extension.sh firefox` to build the ZIPs in `dist/`. Packaging reads the version and manifests from the current commit and rejects a mismatch in either manifest.
