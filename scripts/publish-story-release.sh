#!/usr/bin/env bash
set -euo pipefail

# Packaging has already validated VERSION and both manifests at this commit.
version=$(git show "${MERGE_SHA}:VERSION")
tag="v${version%$'\r'}"
tag_ref="refs/tags/$tag"

# A pre-existing Git tag overrides --target when GitHub publishes a release.
remote_tags=$(git ls-remote origin "$tag_ref" "$tag_ref^{}")
while IFS=$'\t' read -r sha ref; do
  case "$ref" in
    "$tag_ref"|"$tag_ref^{}") tagged_commit=$sha ;;
  esac
done <<< "$remote_tags"

if [[ -n "${tagged_commit:-}" && "$tagged_commit" != "$MERGE_SHA" ]]; then
  printf 'Tag %s already points to a different commit.\n' "$tag" >&2
  exit 1
fi

if release=$(gh release view "$tag" --json isDraft,targetCommitish \
    --jq '[.isDraft, .targetCommitish] | @tsv'); then
  IFS=$'\t' read -r draft target <<< "$release"
  if [[ "$target" != "$MERGE_SHA" ]]; then
    printf 'Release %s already targets a different commit.\n' "$tag" >&2
    exit 1
  fi
  if [[ "$draft" == false ]]; then
    exit 0
  fi
else
  node scripts/story-release-notes.mjs > dist/release-notes.md
  gh release create "$tag" --draft --target "$MERGE_SHA" \
    --title "$tag" --notes-file dist/release-notes.md
fi

gh release upload "$tag" --clobber \
  dist/web-live-tracker-chrome.zip dist/web-live-tracker-firefox.zip
gh release edit "$tag" --draft=false --target "$MERGE_SHA"
