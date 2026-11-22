#!/bin/sh
set -eu

project_root=$(CDPATH= cd -- "$(dirname -- "$0")/.." && pwd)
archive="$project_root/web-live-tracker.zip"

if [ -d "$archive" ]; then
  printf '%s\n' 'web-live-tracker.zip is already a directory.' >&2
  exit 1
fi

temporary_archive=$(mktemp "$project_root/.web-live-tracker.XXXXXX")
trap 'rm -f -- "$temporary_archive"' EXIT
trap 'exit 1' HUP INT TERM

git -C "$project_root" archive --format=zip --prefix=web-live-tracker/ \
  --output="$temporary_archive" HEAD README.md README_DE.md extension
mv -f -- "$temporary_archive" "$archive"
printf '%s\n' 'Created web-live-tracker.zip in the project root.'
