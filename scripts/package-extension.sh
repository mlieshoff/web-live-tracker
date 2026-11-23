#!/bin/sh
set -eu

project_root=$(CDPATH= cd -- "$(dirname -- "$0")/.." && pwd)
archive="$project_root/web-live-tracker.zip"
browser=${1:-chrome}

case "$browser" in
  chrome) ;;
  firefox) archive="$project_root/firefox/web-live-tracker-firefox.zip" ;;
  *)
    printf '%s\n' 'Usage: sh scripts/package-extension.sh [chrome|firefox]' >&2
    exit 1
    ;;
esac

if [ -d "$archive" ]; then
  printf '%s\n' 'The ZIP destination is already a directory.' >&2
  exit 1
fi

temporary_archive=$(mktemp "$project_root/.web-live-tracker.XXXXXX")
trap 'rm -f -- "$temporary_archive"' EXIT
trap 'exit 1' HUP INT TERM

if [ "$browser" = firefox ]; then
  shared_files=$(git -C "$project_root" ls-tree HEAD:extension)
  firefox_files=$(git -C "$project_root" ls-tree HEAD:firefox manifest.json README.md)
  tree=$(
    {
      printf '%s\n' "$shared_files" | awk -F '\t' '$2 != "manifest.json"'
      printf '%s\n' "$firefox_files"
    } | git -C "$project_root" mktree
  )
  git -C "$project_root" archive --format=zip --output="$temporary_archive" "$tree"
else
  git -C "$project_root" archive --format=zip --prefix=web-live-tracker/ \
    --output="$temporary_archive" HEAD README.md README_DE.md extension firefox/README.md
fi
mv -f -- "$temporary_archive" "$archive"
printf 'Created %s\n' "${archive#"$project_root"/}"
