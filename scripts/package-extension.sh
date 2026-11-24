#!/bin/sh
set -eu

project_root=$(CDPATH= cd -- "$(dirname -- "$0")/.." && pwd)
browser=${1:-chrome}

case "$browser" in
  chrome|firefox) ;;
  *)
    printf '%s\n' 'Usage: sh scripts/package-extension.sh [chrome|firefox]' >&2
    exit 1
    ;;
esac

archive="$project_root/$browser/web-live-tracker-$browser.zip"
if [ -d "$archive" ]; then
  printf '%s\n' 'The ZIP destination is already a directory.' >&2
  exit 1
fi

temporary_archive=$(mktemp "$project_root/.web-live-tracker.XXXXXX")
trap 'rm -f -- "$temporary_archive"' EXIT
trap 'exit 1' HUP INT TERM

shared_tree=$(git -C "$project_root" rev-parse HEAD:shared)
browser_files=$(git -C "$project_root" ls-tree "HEAD:$browser" browser-api.mjs background.mjs report-open.html report-open.mjs)
browser_tree=$(printf '%s\n' "$browser_files" | git -C "$project_root" mktree)
package_files=$(git -C "$project_root" ls-tree "HEAD:$browser" manifest.json README.md README_DE.md)
tree=$(
  {
    printf '%s\n' "$package_files"
    printf '040000 tree %s\tshared\n' "$shared_tree"
    printf '040000 tree %s\tbrowser\n' "$browser_tree"
  } | git -C "$project_root" mktree
)
git -C "$project_root" archive --format=zip --output="$temporary_archive" "$tree"
mv -f -- "$temporary_archive" "$archive"
printf 'Created %s\n' "${archive#"$project_root"/}"
