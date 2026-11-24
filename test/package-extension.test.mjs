import assert from 'node:assert/strict';
import { execFileSync, spawnSync } from 'node:child_process';
import { copyFileSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';
import { inflateRawSync } from 'node:zlib';

const projectRoot = fileURLToPath(new URL('..', import.meta.url));
const packageScript = 'scripts/package-extension.sh';

function readPackagedManifest(archive) {
  const zip = readFileSync(archive);
  // Git writes a ZIP archive with no comment when archiving a tree.
  const endRecord = zip.length - 22;
  const directoryOffset = zip.readUInt32LE(endRecord + 16);
  for (let offset = directoryOffset; offset < endRecord;) {
    const nameLength = zip.readUInt16LE(offset + 28);
    const extraLength = zip.readUInt16LE(offset + 30);
    const commentLength = zip.readUInt16LE(offset + 32);
    if (zip.toString('utf8', offset + 46, offset + 46 + nameLength) === 'manifest.json') {
      const localHeader = zip.readUInt32LE(offset + 42);
      const dataStart = localHeader + 30 + zip.readUInt16LE(localHeader + 26)
        + zip.readUInt16LE(localHeader + 28);
      const contents = zip.subarray(dataStart, dataStart + zip.readUInt32LE(offset + 20));
      const method = zip.readUInt16LE(offset + 10);
      return JSON.parse(method === 8 ? inflateRawSync(contents) : contents);
    }
    offset += 46 + nameLength + extraLength + commentLength;
  }
  assert.fail('The ZIP does not contain manifest.json');
}

function createRepository(t) {
  const directory = mkdtempSync(join(projectRoot, '.package-extension-test-'));
  t.after(() => rmSync(directory, { recursive: true, force: true }));
  const git = (...args) => execFileSync('git', args, { cwd: directory });
  const write = (path, contents) => writeFileSync(join(directory, path), contents);
  const commit = () => {
    git('add', '.');
    git('-c', 'user.name=Packaging Test', '-c', 'user.email=packaging@example.invalid',
      'commit', '--no-gpg-sign', '-m', 'Fixture');
  };

  git('init', '--quiet', '--template=');
  for (const folder of ['scripts', 'shared', 'chrome', 'firefox']) {
    mkdirSync(join(directory, folder));
  }
  copyFileSync(join(projectRoot, packageScript), join(directory, packageScript));
  write('.gitignore', '/dist/\n');
  write('VERSION', '1.2.3\n');
  write('shared/panel.html', '<title>Fixture</title>');
  for (const browser of ['chrome', 'firefox']) {
    write(`${browser}/manifest.json`, '{"version":"1.2.3"}');
    write(`${browser}/browser-api.mjs`, 'export {};\n');
  }
  commit();

  return {
    write,
    commit,
    remove: (path) => rmSync(join(directory, path)),
    package: (browser) => spawnSync('sh', [packageScript, browser], {
      cwd: directory,
      encoding: 'utf8',
    }),
    archive: (browser) => join(directory, 'dist', `web-live-tracker-${browser}.zip`),
  };
}

test('both browser ZIPs use the committed version despite working tree edits', (t) => {
  const repository = createRepository(t);
  repository.write('VERSION', '2.0.0\n');
  repository.write('chrome/manifest.json', '{"version":"2.0.0"}');

  for (const browser of ['chrome', 'firefox']) {
    const result = repository.package(browser);
    assert.equal(result.status, 0, result.stderr);
    assert.equal(readPackagedManifest(repository.archive(browser)).version, '1.2.3');
  }
});

test('packaging rejects a missing committed VERSION', (t) => {
  const repository = createRepository(t);
  repository.remove('VERSION');
  repository.commit();

  const result = repository.package('chrome');
  assert.equal(result.status, 1);
  assert.match(result.stderr, /Cannot read VERSION from commit/);
});

test('packaging rejects invalid version formats', (t) => {
  const repository = createRepository(t);

  for (const version of ['1.2', '01.2.3', '1.2.3-rc.1', '1.2.3\n\n']) {
    repository.write('VERSION', version);
    repository.commit();
    const result = repository.package('firefox');
    assert.equal(result.status, 1);
    assert.match(result.stderr, /VERSION must contain one MAJOR\.MINOR\.PATCH version/);
  }
});

for (const [manifestBrowser, packageBrowser] of [['chrome', 'firefox'], ['firefox', 'chrome']]) {
  test(`a ${manifestBrowser} version mismatch preserves the existing ${packageBrowser} ZIP`, (t) => {
    const repository = createRepository(t);
    const initialResult = repository.package(packageBrowser);
    assert.equal(initialResult.status, 0, initialResult.stderr);
    const archive = repository.archive(packageBrowser);
    const original = readFileSync(archive);

    repository.write(`${manifestBrowser}/manifest.json`, '{"version":"1.2.4"}');
    repository.commit();

    const result = repository.package(packageBrowser);
    assert.equal(result.status, 1);
    assert.ok(result.stderr.includes(`${manifestBrowser}/manifest.json version must match VERSION`));
    assert.deepEqual(readFileSync(archive), original);
  });
}
