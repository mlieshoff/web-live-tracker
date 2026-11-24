import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';

const projectRoot = fileURLToPath(new URL('..', import.meta.url));
const releaseScript = join(projectRoot, 'scripts/publish-story-release.sh');
const assets = 'dist/web-live-tracker-chrome.zip dist/web-live-tracker-firefox.zip';

function publish(t, { release = '', remoteTags = '' } = {}) {
  const directory = mkdtempSync(join(projectRoot, '.publish-release-test-'));
  t.after(() => rmSync(directory, { recursive: true, force: true }));
  mkdirSync(join(directory, 'dist'));
  writeFileSync(join(directory, 'event.json'), JSON.stringify({
    pull_request: { head: { ref: 'story/65-release' } },
  }));
  writeFileSync(join(directory, 'git'), `#!/bin/bash
case "$*" in
  'show merge-sha:VERSION') printf '1.2.3\\r\\n' ;;
  'ls-remote origin refs/tags/v1.2.3 refs/tags/v1.2.3^{}') printf '%s' "$REMOTE_TAGS" ;;
  *) exit 2 ;;
esac
`, { mode: 0o700 });
  writeFileSync(join(directory, 'gh'), `#!/bin/bash
printf '%s\\n' "$*" >> commands.log
case "$1 $2" in
  'release view') if [[ -n "$RELEASE" ]]; then printf '%s\\n' "$RELEASE"; else exit 1; fi ;;
  'issue view') printf '%s\\n' '{"title":"Story title","url":"https://example.com/issues/65"}' ;;
  'release create'|'release upload'|'release edit') ;;
  *) exit 2 ;;
esac
`, { mode: 0o700 });
  mkdirSync(join(directory, 'scripts'));
  writeFileSync(join(directory, 'scripts/story-release-notes.mjs'),
    readFileSync(join(projectRoot, 'scripts/story-release-notes.mjs')));
  writeFileSync(join(directory, 'commands.log'), '');
  const result = spawnSync('bash', [releaseScript], {
    cwd: directory,
    env: {
      ...process.env,
      PATH: `${directory}:${process.env.PATH}`,
      GITHUB_EVENT_PATH: 'event.json',
      GITHUB_REPOSITORY: 'owner/project',
      MERGE_SHA: 'merge-sha',
      RELEASE: release,
      REMOTE_TAGS: remoteTags,
    },
    encoding: 'utf8',
  });
  return {
    status: result.status,
    stderr: result.stderr,
    commands: readFileSync(join(directory, 'commands.log'), 'utf8').trim().split('\n').filter(Boolean),
  };
}

const lookup = 'release view v1.2.3 --json isDraft,targetCommitish --jq [.isDraft, .targetCommitish] | @tsv';
const finish = [
  `release upload v1.2.3 --clobber ${assets}`,
  'release edit v1.2.3 --draft=false --target merge-sha',
];

test('creates a release with the committed version as its title and tag', (t) => {
  assert.deepEqual(publish(t), {
    status: 0,
    stderr: '',
    commands: [
      lookup,
      'issue view 65 --repo owner/project --json title,url',
      'release create v1.2.3 --draft --target merge-sha --title v1.2.3 --notes-file dist/release-notes.md',
      ...finish,
    ],
  });
});

test('resumes a draft for the same merge', (t) => {
  assert.deepEqual(publish(t, { release: 'true\tmerge-sha' }), {
    status: 0,
    stderr: '',
    commands: [lookup, ...finish],
  });
});

test('leaves the published release intact when rerun on the same merge', (t) => {
  assert.deepEqual(publish(t, {
    release: 'false\tmerge-sha',
    remoteTags: 'tag-object\trefs/tags/v1.2.3\nmerge-sha\trefs/tags/v1.2.3^{}\n',
  }), { status: 0, stderr: '', commands: [lookup] });
});

test('rejects a draft for a different merge before uploading assets', (t) => {
  assert.deepEqual(publish(t, { release: 'true\tother-sha' }), {
    status: 1,
    stderr: 'Release v1.2.3 already targets a different commit.\n',
    commands: [lookup],
  });
});

test('rejects a tag on a different commit before creating a release', (t) => {
  assert.deepEqual(publish(t, { remoteTags: 'other-sha\trefs/tags/v1.2.3\n' }), {
    status: 1,
    stderr: 'Tag v1.2.3 already points to a different commit.\n',
    commands: [],
  });
});
