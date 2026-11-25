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

revision=$(git -C "$project_root" rev-parse --verify HEAD)
node "$project_root/scripts/check-extension-version.mjs" "$revision"

output_directory="$project_root/dist"
mkdir -p -- "$output_directory"
archive="$output_directory/web-live-tracker-$browser.zip"
if [ -d "$archive" ]; then
  printf '%s\n' 'The ZIP destination is already a directory.' >&2
  exit 1
fi

temporary_archive=$(mktemp "$output_directory/.web-live-tracker.XXXXXX")
trap 'rm -f -- "$temporary_archive"' EXIT
trap 'exit 1' HUP INT TERM

shared_tree=$(git -C "$project_root" rev-parse "$revision:shared")
browser_files=$(git -C "$project_root" ls-tree "$revision:$browser" browser-api.mjs background.mjs)
browser_tree=$(printf '%s\n' "$browser_files" | git -C "$project_root" mktree)
package_files=$(git -C "$project_root" ls-tree "$revision:$browser" manifest.json README.md README_DE.md)
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
