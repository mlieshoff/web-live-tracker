import assert from 'node:assert/strict';
import test from 'node:test';
import { releaseNotes, storyIssueNumbers } from '../scripts/story-release-notes.mjs';

test('story and local task references appear once and in order', () => {
  const pullRequest = {
    head: { ref: 'story/56-browser-zips' },
    body: [
      '## Related issues',
      'Story #56, task #57, and https://github.com/owner/project/issues/58.',
      '#57, other/project#59, https://github.com/other/project/issues/60.',
      '<!-- example #61 -->',
      '## Verification and QA',
      'Unrelated reference #62.',
    ].join('\n'),
  };
  assert.deepEqual(storyIssueNumbers(pullRequest, 'owner/project'), ['56', '57', '58']);
});

test('a story branch without related issues still identifies the story', () => {
  assert.deepEqual(storyIssueNumbers({ head: { ref: 'story/56-browser-zips' } }, 'owner/project'), ['56']);
});

test('a release requires a numbered story branch', () => {
  assert.throws(
    () => storyIssueNumbers({ head: { ref: 'story/browser-zips' } }, 'owner/project'),
    /Expected a story/,
  );
});

test('issue titles are displayed as literal text in linked release notes', () => {
  assert.equal(
    releaseNotes([{ title: 'Build [Chrome] *ZIP*', url: 'https://github.com/owner/project/issues/57' }]),
    '- [Build \\[Chrome\\] \\*ZIP\\*](https://github.com/owner/project/issues/57)\n',
  );
});
