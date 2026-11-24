import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { pathToFileURL } from 'node:url';

export function storyIssueNumbers(pullRequest, repository) {
  const story = /^story\/([1-9]\d*)-.+$/.exec(pullRequest.head.ref);
  if (!story) {
    throw new Error('Expected a story/<issue-number>-<slug> branch.');
  }

  const issueSection = (pullRequest.body ?? '')
    .split(/^##[ \t]+/m)
    .find((section) => /^Related issues[ \t]*\r?\n/i.test(section))
    ?.replace(/<!--[\s\S]*?-->/g, '') ?? '';
  const references = new Set([story[1]]);
  for (const match of issueSection.matchAll(
    /(?<![\w/#])#([1-9]\d*)\b|https:\/\/github\.com\/([\w.-]+\/[\w.-]+)\/issues\/([1-9]\d*)\b/g,
  )) {
    if (match[1] || match[2]?.toLowerCase() === repository.toLowerCase()) {
      references.add(match[1] ?? match[3]);
    }
  }
  return [...references];
}

export function releaseNotes(issues) {
  return issues.map(({ title, url }) => {
    const escapedTitle = title.replace(/[\\\x60*_[\]{}<>~!|&]/g, '\\$&');
    return `- [${escapedTitle}](${url})`;
  }).join('\n') + '\n';
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const { GITHUB_EVENT_PATH, GITHUB_REPOSITORY } = process.env;
  const { pull_request: pullRequest } = JSON.parse(readFileSync(GITHUB_EVENT_PATH, 'utf8'));
  const issues = storyIssueNumbers(pullRequest, GITHUB_REPOSITORY).map((number) => JSON.parse(
    execFileSync('gh', ['issue', 'view', number, '--repo', GITHUB_REPOSITORY, '--json', 'title,url'],
      { encoding: 'utf8' }),
  ));
  process.stdout.write(releaseNotes(issues));
}
