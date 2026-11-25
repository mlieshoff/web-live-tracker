import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const projectRoot = fileURLToPath(new URL('..', import.meta.url));

function readCommittedFile(revision, path) {
  try {
    return execFileSync('git', ['show', `${revision}:${path}`], {
      cwd: projectRoot,
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'ignore'],
    });
  } catch {
    throw new Error(`Cannot read ${path} from commit ${revision}.`);
  }
}

function readVersion(revision) {
  const version = readCommittedFile(revision, 'VERSION').replace(/\r?\n$/, '');
  if (!/^(0|[1-9][0-9]*)(\.(0|[1-9][0-9]*)){2}$/.test(version)) {
    throw new Error(`VERSION must contain one MAJOR.MINOR.PATCH version without leading zeroes (commit ${revision}).`);
  }
  return version;
}

function checkManifests(revision, version) {
  for (const browser of ['chrome', 'firefox']) {
    const path = `${browser}/manifest.json`;
    const contents = readCommittedFile(revision, path);
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
}

function isVersionIncrease(version, baseVersion) {
  const components = version.split('.').map(BigInt);
  const baseComponents = baseVersion.split('.').map(BigInt);
  const difference = components.findIndex((component, index) => component !== baseComponents[index]);
  return difference !== -1 && components[difference] > baseComponents[difference];
}

try {
  const [revision, baseRevision] = process.argv.slice(2);
  if (!revision) {
    throw new Error('Usage: node scripts/check-extension-version.mjs <commit> [base-commit]');
  }

  const version = readVersion(revision);
  checkManifests(revision, version);

  if (baseRevision) {
    const baseVersion = readVersion(baseRevision);
    if (!isVersionIncrease(version, baseVersion)) {
      throw new Error(`VERSION (${version}) must be higher than the base version (${baseVersion}). Update VERSION and both browser manifests together.`);
    }
  }
} catch (error) {
  console.error(error.message);
  process.exitCode = 1;
}
