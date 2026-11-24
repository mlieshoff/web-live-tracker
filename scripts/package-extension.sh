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
node - "$project_root" "$revision" <<'NODE'
const { execFileSync } = require('node:child_process');

const [projectRoot, revision] = process.argv.slice(2);

function readCommittedFile(path) {
  try {
    return execFileSync('git', ['-C', projectRoot, 'show', `${revision}:${path}`], {
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'ignore'],
    });
  } catch {
    throw new Error(`Cannot read ${path} from commit ${revision}.`);
  }
}

try {
  const version = readCommittedFile('VERSION').replace(/\r?\n$/, '');
  if (!/^(0|[1-9][0-9]*)(\.(0|[1-9][0-9]*)){2}$/.test(version)) {
    throw new Error('VERSION must contain one MAJOR.MINOR.PATCH version without leading zeroes.');
  }

  for (const browser of ['chrome', 'firefox']) {
    const path = `${browser}/manifest.json`;
    const contents = readCommittedFile(path);
    let manifest;
    try {
      manifest = JSON.parse(contents);
    } catch {
      throw new Error(`${path} must contain valid JSON.`);
    }
    if (manifest?.version !== version) {
      throw new Error(`${path} version must match VERSION (${version}).`);
    }
  }
} catch (error) {
  console.error(error.message);
  process.exitCode = 1;
}
NODE

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
