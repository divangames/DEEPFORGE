'use strict';
// Интеграционные тесты используют временные локальные bare-репозитории, не GitHub.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const { Publisher, excluded } = require('./deepforge-publish.cjs');

function git(cwd, args, ok = true) {
  const r = spawnSync('git', args, { cwd, encoding: 'utf8', env: { ...process.env, GIT_CONFIG_NOSYSTEM: '1', GIT_CONFIG_GLOBAL: path.join(os.tmpdir(), 'deepforge-no-global-config'), GIT_TERMINAL_PROMPT: '0' } });
  if (ok) assert.equal(r.status, 0, `${args.join(' ')}\n${r.stderr}`);
  return { text: (r.stdout || '').trim(), error: r.stderr || '', code: r.status };
}
function write(dir, p, data) { fs.mkdirSync(path.dirname(path.join(dir, p)), { recursive: true }); fs.writeFileSync(path.join(dir, p), data); }
function fixture(t, { minimal = false } = {}) {
  const top = fs.mkdtempSync(path.join(os.tmpdir(), 'deepforge-publish-test-'));
  t.after(() => fs.rmSync(top, { recursive: true, force: true }));
  const bare = path.join(top, 'remote.git');
  const seed = path.join(top, 'seed');
  const local = path.join(top, 'Программирование !!!GAMES (тест)');
  fs.mkdirSync(seed);
  git(top, ['init', '--bare', '--initial-branch=main', bare]);
  git(seed, ['init', '--initial-branch=main']);
  git(seed, ['config', 'user.name', 'Fixture']); git(seed, ['config', 'user.email', 'fixture@example.test']);
  write(seed, 'README.md', 'Base README\n');
  write(seed, '.gitignore', 'node_modules/\ndist/\n*.log\n*.tsbuildinfo\n');
  if (!minimal) projectFiles(seed);
  git(seed, ['add', '.']); git(seed, ['commit', '-m', 'base']);
  git(seed, ['remote', 'add', 'origin', bare]); git(seed, ['push', '-u', 'origin', 'main']);
  git(top, ['clone', bare, local]);
  git(local, ['config', 'user.name', 'Fixture']); git(local, ['config', 'user.email', 'fixture@example.test']);
  const original = git(bare, ['rev-parse', 'main']).text;
  return { top, bare, seed, local, original };
}
function projectFiles(dir) {
  write(dir, 'package.json', JSON.stringify({ name: 'deepforge-idle-empire', version: '1.0.0', private: true, workspaces: ['client', 'server'], scripts: { typecheck: 'node -e "process.exit(0)"', test: 'node -e "process.exit(0)"', build: 'node -e "process.exit(0)"' } }, null, 2));
  write(dir, 'client/package.json', '{"name":"@deepforge/client","version":"1.0.0","private":true}\n');
  write(dir, 'server/package.json', '{"name":"@deepforge/server","version":"1.0.0","private":true}\n');
  write(dir, 'client/src/main.ts', 'export const stage = 15;\n');
}
function publish(f, options = {}) {
  const printed = [];
  const p = new Publisher({ cwd: f.local, allowedRemotes: [f.bare], print: s => printed.push(s), confirm: () => false, validate: () => {}, ...options });
  p.env.GIT_CONFIG_NOSYSTEM = '1';
  p.env.GIT_CONFIG_GLOBAL = path.join(f.top, 'absent-global');
  p.env.GIT_TERMINAL_PROMPT = '0';
  const result = p.run();
  return { ...result, printed, publisher: p };
}
function remoteEdit(f, p, text) {
  write(f.seed, p, text); git(f.seed, ['add', '.']); git(f.seed, ['commit', '-m', 'remote change']); git(f.seed, ['push', 'origin', 'main']);
}

test('dirty tracked and new files are saved and pushed; Cyrillic and !!! paths work', t => {
  const f = fixture(t);
  write(f.local, 'client/src/main.ts', 'export const stage = 16;\n');
  write(f.local, 'client/src/ui/new.ts', 'export const ui = 161;\n');
  const r = publish(f, { message: 'fix: "UI" & literal ! text' });
  assert.equal(r.ok, true, r.error);
  assert.equal(git(f.bare, ['show', 'main:client/src/ui/new.ts']).text, 'export const ui = 161;');
  assert.equal(git(f.local, ['status', '--porcelain']).text, '');
  assert.equal(fs.readFileSync(path.join(r.backup, 'files/client/src/ui/new.ts'), 'utf8'), 'export const ui = 161;\n');
  assert.equal(git(f.bare, ['log', '-1', '--format=%s']).text, 'fix: "UI" & literal ! text');
});

test('reproduces old could-not-detach-HEAD error; new publisher handles untracked collisions', t => {
  const f = fixture(t, { minimal: true });
  projectFiles(f.seed);
  git(f.seed, ['add', '.']); git(f.seed, ['commit', '-m', 'publish source']); git(f.seed, ['push', 'origin', 'main']);
  write(f.local, 'local-note.md', 'A local commit\n'); git(f.local, ['add', '.']); git(f.local, ['commit', '-m', 'local note']);
  projectFiles(f.local); // Файлы из архива пока не входят в локальный индекс.
  write(f.local, 'README.md', 'UI update readme\n');
  git(f.local, ['fetch', 'origin', 'main']);
  const failed = git(f.local, ['rebase', '--autostash', 'origin/main'], false);
  assert.notEqual(failed.code, 0);
  assert.match(failed.error, /untracked working tree files would be overwritten/);
  assert.match(failed.error, /could not detach HEAD/);
  const r = publish(f);
  assert.equal(r.ok, true, r.error);
  assert.equal(git(f.bare, ['show', 'main:README.md']).text, 'UI update readme');
  assert.equal(git(f.bare, ['show', 'main:client/src/main.ts']).text, 'export const stage = 15;');
});

test('non-conflicting divergence preserves both histories without rebase', t => {
  const f = fixture(t);
  remoteEdit(f, 'server/new.ts', 'remote server fix\n');
  write(f.local, 'client/new.ts', 'local UI fix\n');
  const r = publish(f);
  assert.equal(r.ok, true, r.error);
  assert.equal(fs.readFileSync(path.join(f.local, 'server/new.ts'), 'utf8'), 'remote server fix\n');
  assert.equal(git(f.bare, ['show', 'main:client/new.ts']).text, 'local UI fix');
  assert.equal(git(f.bare, ['rev-list', '--parents', '-n', '1', 'main']).text.split(' ').length, 3);
});

test('real content conflict stays in separate worktree and does not alter main source', t => {
  const f = fixture(t);
  remoteEdit(f, 'client/src/main.ts', 'export const stage = 99;\n');
  const remoteHead = git(f.bare, ['rev-parse', 'main']).text;
  write(f.local, 'client/src/main.ts', 'export const stage = 161;\n');
  const r = publish(f);
  assert.equal(r.ok, false);
  assert.match(r.error, /Merge needs review/);
  assert.equal(fs.readFileSync(path.join(f.local, 'client/src/main.ts'), 'utf8'), 'export const stage = 161;\n');
  assert.equal(git(f.local, ['status', '--porcelain']).text, '');
  assert.equal(git(f.bare, ['rev-parse', 'main']).text, remoteHead);
  assert(fs.existsSync(r.integration));
  assert.equal(git(f.local, ['show', `${r.backupRef}:client/src/main.ts`]).text, 'export const stage = 161;');
});

test('retries after fixing the conflicting source without losing either branch', t => {
  const f = fixture(t);
  remoteEdit(f, 'client/src/main.ts', 'export const stage = 99;\n');
  write(f.local, 'client/src/main.ts', 'export const stage = 161;\n');
  const failed = publish(f); assert.equal(failed.ok, false);
  write(f.local, 'client/src/main.ts', 'export const stage = 99;\n');
  write(f.local, 'client/src/ui.ts', 'new UI\n');
  const r = publish(f); assert.equal(r.ok, true, r.error);
  assert.equal(git(f.bare, ['show', 'main:client/src/ui.ts']).text, 'new UI');
});

test('typecheck/tests/build failure cannot push a snapshot', t => {
  const f = fixture(t); write(f.local, 'README.md', 'local new README\n');
  const r = publish(f, { validate: () => { throw new Error('TypeScript fixture failed'); } });
  assert.equal(r.ok, false);
  assert.match(r.error, /TypeScript/);
  assert.equal(git(f.bare, ['rev-parse', 'main']).text, f.original);
  assert.equal(git(f.local, ['show', `${r.backupRef}:README.md`]).text, 'local new README');
});

test('remote advancing during validation is not overwritten', t => {
  const f = fixture(t); write(f.local, 'README.md', 'local UI\n');
  const r = publish(f, { validate: () => remoteEdit(f, 'remote-later.md', 'A newer GitHub commit\n') });
  assert.equal(r.ok, false);
  assert.match(r.error, /advanced during validation/);
  assert.equal(git(f.bare, ['show', 'main:remote-later.md']).text, 'A newer GitHub commit');
  assert.equal(git(f.bare, ['show', 'main:README.md']).text, 'Base README');
});

test('ignored file cannot be overwritten by fetched tracked file', t => {
  const f = fixture(t);
  write(f.local, '.git/info/exclude', 'private-local.txt\n');
  write(f.local, 'private-local.txt', 'keep local bytes\n');
  remoteEdit(f, 'private-local.txt', 'remote tracked bytes\n');
  const r = publish(f);
  assert.equal(r.ok, false);
  assert.equal(fs.readFileSync(path.join(f.local, 'private-local.txt'), 'utf8'), 'keep local bytes\n');
});

test('untracked env secrets, zip, logs, build metadata and dist never get committed', t => {
  const f = fixture(t);
  for (const p of ['.env.local', '.npmrc', 'snapshot.zip', 'private.key', 'client/tsconfig.tsbuildinfo', 'dist/test.js', 'anything.log']) write(f.local, p, 'LOCAL ONLY\n');
  write(f.local, '.env.example', 'EXAMPLE=\n');
  write(f.local, 'README.md', 'publish this\n');
  const r = publish(f);
  assert.equal(r.ok, true, r.error);
  const files = git(f.bare, ['ls-tree', '--name-only', '-r', 'main']).text.split('\n');
  assert(files.includes('.env.example'));
  for (const p of ['.env.local', '.npmrc', 'snapshot.zip', 'private.key', 'client/tsconfig.tsbuildinfo', 'dist/test.js', 'anything.log']) {
    assert(!files.includes(p)); assert(fs.existsSync(path.join(f.local, p)));
  }
});

test('already staged env secret stops publication and remains local', t => {
  const f = fixture(t); write(f.local, '.env.local', 'SECRET=test\n'); git(f.local, ['add', '.env.local']);
  const r = publish(f); assert.equal(r.ok, false); assert.match(r.error, /already staged/);
  assert.equal(git(f.bare, ['rev-parse', 'main']).text, f.original);
  assert.equal(fs.readFileSync(path.join(r.backup, 'files/.env.local'), 'utf8'), 'SECRET=test\n');
});

test('no changes creates no needless new commit and succeeds', t => {
  const f = fixture(t); const r = publish(f); assert.equal(r.ok, true, r.error);
  assert.equal(git(f.bare, ['rev-parse', 'main']).text, f.original);
});

test('normal source deletion is backed up as missing and remains a deletion', t => {
  const f = fixture(t); fs.unlinkSync(path.join(f.local, 'client/src/main.ts'));
  const r = publish(f); assert.equal(r.ok, true, r.error);
  assert.equal(git(f.bare, ['cat-file', '-e', 'main:client/src/main.ts'], false).code !== 0, true);
  assert(JSON.parse(fs.readFileSync(path.join(r.backup, 'manifest.json'))).missing.includes('client/src/main.ts'));
});

test('unfinished rebase is not aborted or reset', t => {
  const f = fixture(t); fs.mkdirSync(path.join(f.local, '.git/rebase-merge'));
  const r = publish(f); assert.equal(r.ok, false); assert.match(r.error, /rebase-merge/);
  assert(fs.existsSync(path.join(f.local, '.git/rebase-merge')));
  assert.equal(git(f.local, ['rev-parse', 'HEAD']).text, f.original);
});

test('detached HEAD or another branch does not get renamed', t => {
  const f = fixture(t); git(f.local, ['switch', '-c', 'feature']);
  const r = publish(f); assert.equal(r.ok, false); assert.match(r.error, /branch must be main/);
  assert.equal(git(f.local, ['branch', '--show-current']).text, 'feature');
});

test('wrong origin is not silently replaced', t => {
  const f = fixture(t); git(f.local, ['remote', 'set-url', 'origin', path.join(f.top, 'another.git')]);
  const r = publish(f); assert.equal(r.ok, false); assert.match(r.error, /does not point/);
  assert.equal(git(f.local, ['remote', 'get-url', 'origin']).text, path.join(f.top, 'another.git'));
});

test('no shared ancestor does not trigger allow-unrelated-histories or force', t => {
  const f = fixture(t);
  git(f.local, ['checkout', '--orphan', 'other']); git(f.local, ['add', '.']); git(f.local, ['commit', '-m', 'unrelated']);
  git(f.local, ['branch', '-D', 'main']); git(f.local, ['branch', '-m', 'main']);
  const r = publish(f); assert.equal(r.ok, false); assert.match(r.error, /no common ancestor/);
  assert.equal(git(f.bare, ['rev-parse', 'main']).text, f.original);
});

test('source changed by a check must not be auto-published', t => {
  const f = fixture(t);
  const r = publish(f, { validate: () => write(f.local, 'client/src/main.ts', 'unexpected formatter change\n') });
  assert.equal(r.ok, false); assert.match(r.error, /Files changed during validation/);
  assert.equal(git(f.bare, ['rev-parse', 'main']).text, f.original);
});

test('new dependency lock can be committed only after checks succeed', t => {
  const f = fixture(t);
  const r = publish(f, { validate: () => write(f.local, 'package-lock.json', '{"lockfileVersion":3}\n') });
  assert.equal(r.ok, true, r.error);
  assert.equal(git(f.bare, ['show', 'main:package-lock.json']).text, '{"lockfileVersion":3}');
});

test('backup Git bundle can be verified', t => {
  const f = fixture(t); write(f.local, 'README.md', 'new copy\n');
  const r = publish(f); assert.equal(r.ok, true, r.error);
  assert.equal(git(f.local, ['bundle', 'verify', path.join(r.backup, 'history.bundle')]).code, 0);
});

test('stale lock stops instead of deleting another publish lock', t => {
  const f = fixture(t); write(f.local, '.git/deepforge-publish/publish.lock', '12345\n');
  const r = publish(f); assert.equal(r.ok, false); assert.match(r.error, /Another publish/);
  assert.equal(fs.readFileSync(path.join(f.local, '.git/deepforge-publish/publish.lock'), 'utf8'), '12345\n');
});

test('real npm runner executes install, typecheck, test and build on a dependency-free fixture', t => {
  const f = fixture(t); write(f.local, 'README.md', 'checked fixture\n');
  const r = publish(f, { validate: undefined });
  assert.equal(r.ok, true, r.error);
  for (const msg of ['$ npm install', '$ npm run typecheck', '$ npm test', '$ npm run build']) assert(r.printed.some(s => s.includes(msg)));
});

test('publisher command source has no rebase, clean, reset or forced-push operation', () => {
  const source = fs.readFileSync(path.join(__dirname, 'deepforge-publish.cjs'), 'utf8');
  for (const s of ["this.git(['reset'", "this.git(['clean'", "this.git(['rebase'", "'--force'", "'--force-with-lease'"]) assert(!source.includes(s));
  assert.equal(excluded('client/src/App.tsx'), false);
  assert.equal(excluded('client/.env.example'), false);
  assert.equal(excluded('client/.env.local'), true);
});

function unrelated(f) {
  git(f.local, ['checkout', '--orphan', 'detached-history']);
  git(f.local, ['add', '.']); git(f.local, ['commit', '-m', 'independent initial source']);
  git(f.local, ['branch', '-D', 'main']); git(f.local, ['branch', '-m', 'main']);
}

test('independent history recovers into new clone; old source, history and remote commits survive', t => {
  const f = fixture(t); unrelated(f);
  write(f.local, 'client/src/main.ts', 'export const stage = 161;\n');
  write(f.local, 'scripts/new-test.mjs', 'console.log("test");\n');
  write(f.local, '.env.local', 'PRIVATE_VALUE=do-not-copy\n');
  write(f.local, 'another-game.md', 'keep only in original\n');
  remoteEdit(f, 'server/remote-only.ts', 'remote-only content\n');
  const remoteHead = git(f.bare, ['rev-parse', 'main']).text;
  const oldRoots = git(f.local, ['rev-list', '--max-parents=0', 'HEAD']).text;
  const answers = [];
  const r = publish(f, { confirm: message => { answers.push(message); return true; } });
  assert.equal(r.ok, true, r.error); assert.equal(answers.length, 2);
  assert.notEqual(r.recoveredFolder, f.local);
  assert(fs.existsSync(path.join(f.local, '.git')));
  assert.equal(git(f.local, ['rev-list', '--max-parents=0', 'HEAD']).text, oldRoots);
  assert.equal(fs.readFileSync(path.join(f.local, 'client/src/main.ts'), 'utf8'), 'export const stage = 161;\n');
  assert.equal(git(f.bare, ['show', 'main:client/src/main.ts']).text, 'export const stage = 161;');
  assert.equal(git(f.bare, ['show', 'main:server/remote-only.ts']).text, 'remote-only content');
  assert.equal(git(r.recoveredFolder, ['merge-base', '--is-ancestor', remoteHead, 'HEAD']).code, 0);
  assert.equal(git(f.bare, ['show', 'main:another-game.md'], false).code !== 0, true);
  assert.equal(fs.existsSync(path.join(r.recoveredFolder, '.env.local')), false);
  assert.equal(git(f.bare, ['rev-list', '--max-parents=0', 'main']).text, f.original);
  const resumed = publish({ ...f, local: r.recoveredFolder });
  assert.equal(resumed.ok, true, resumed.error);
});

test('second confirmation refusal leaves clone unmodified and never pushes', t => {
  const f = fixture(t); unrelated(f); write(f.local, 'client/src/main.ts', 'new code\n');
  let count = 0;
  const r = publish(f, { confirm: () => ++count === 1 });
  assert.equal(r.ok, false); assert.match(r.error, /Transfer cancelled/);
  assert.equal(git(f.bare, ['rev-parse', 'main']).text, f.original);
  assert.equal(fs.readFileSync(path.join(r.recoveredFolder, 'client/src/main.ts'), 'utf8'), 'export const stage = 15;\n');
  assert.equal(fs.existsSync(path.join(f.local, '.git/deepforge-publish/recovery.json')), false);
});

test('failed checks in recovered folder preserve both folders and do not publish', t => {
  const f = fixture(t); unrelated(f); write(f.local, 'client/src/main.ts', 'new code\n');
  const r = publish(f, { confirm: () => true, validate: () => { throw new Error('fixture compile failure'); } });
  assert.equal(r.ok, false); assert.match(r.error, /fixture compile failure/);
  assert.equal(git(f.bare, ['rev-parse', 'main']).text, f.original);
  assert.equal(fs.readFileSync(path.join(r.recoveredFolder, 'client/src/main.ts'), 'utf8'), 'new code\n');
  assert.equal(fs.readFileSync(path.join(f.local, 'client/src/main.ts'), 'utf8'), 'new code\n');
});

test('old independent folder cannot silently overwrite a completed recovery', t => {
  const f = fixture(t); unrelated(f); const first = publish(f, { confirm: () => true });
  assert.equal(first.ok, true, first.error);
  write(f.local, 'client/src/main.ts', 'accidental stale-folder edit\n');
  const head = git(f.bare, ['rev-parse', 'main']).text;
  const next = publish(f, { confirm: () => true });
  assert.equal(next.ok, false); assert.match(next.error, /already has a recovery copy/);
  assert.equal(git(f.bare, ['rev-parse', 'main']).text, head);
  assert.equal(fs.readFileSync(path.join(f.local, 'client/src/main.ts'), 'utf8'), 'accidental stale-folder edit\n');
});

test('recovery does not infer deletes from local files absent in independent history', t => {
  const f = fixture(t); unrelated(f); fs.unlinkSync(path.join(f.local, 'client/src/main.ts'));
  const r = publish(f, { confirm: () => true });
  assert.equal(r.ok, true, r.error);
  assert.equal(git(f.bare, ['show', 'main:client/src/main.ts']).text, 'export const stage = 15;');
  assert.equal(fs.existsSync(path.join(f.local, 'client/src/main.ts')), false);
});

test('project identity mismatch stops before commit, config changes or copy', t => {
  const f = fixture(t); write(f.local, 'package.json', '{"name":"life-to-live"}');
  const r = publish(f, { confirm: () => true });
  assert.equal(r.ok, false); assert.match(r.error, /Wrong project/);
  assert.equal(git(f.local, ['rev-parse', 'HEAD']).text, f.original);
  assert.equal(git(f.bare, ['rev-parse', 'main']).text, f.original);
});

test('source modified after transfer review is not copied or pushed', t => {
  const f = fixture(t); unrelated(f); let count = 0;
  const r = publish(f, { confirm: () => { count++; if (count === 2) write(f.local, 'client/src/main.ts', 'concurrent changed source\n'); return true; } });
  assert.equal(r.ok, false); assert.match(r.error, /changed after review/);
  assert.equal(git(f.bare, ['rev-parse', 'main']).text, f.original);
  assert.equal(git(r.recoveredFolder, ['status', '--porcelain']).text, '');
});

test('recovering local symlinks does not read or overwrite files outside project', t => {
  if (process.platform === 'win32') return t.skip('Creating symlinks requires Windows developer mode.');
  const f = fixture(t); unrelated(f);
  write(f.top, 'outside.txt', 'PRIVATE\n');
  fs.symlinkSync(path.join(f.top, 'outside.txt'), path.join(f.local, 'client/linked.ts'));
  const r = publish(f, { confirm: () => true });
  assert.equal(r.ok, false); assert.match(r.error, /Unsafe or non-regular transfer path/);
  assert.equal(fs.readFileSync(path.join(f.top, 'outside.txt'), 'utf8'), 'PRIVATE\n');
  assert.equal(git(f.bare, ['rev-parse', 'main']).text, f.original);
});

test('remote racing during recovered verification is never overwritten', t => {
  const f = fixture(t); unrelated(f);
  const r = publish(f, { confirm: () => true, validate: () => remoteEdit(f, 'server/race.ts', 'newest\n') });
  assert.equal(r.ok, false); assert.match(r.error, /advanced during validation/);
  assert.equal(git(f.bare, ['show', 'main:server/race.ts']).text, 'newest');
});

test('shallow cloned history is completed, not incorrectly recovered as unrelated', t => {
  const f = fixture(t);
  // История до shallow boundary остаётся отдельно в old; shallow clone — новый seed.
  write(f.seed, 'README.md', 'next version\n'); git(f.seed, ['add', '.']); git(f.seed, ['commit', '-m', 'next']); git(f.seed, ['push', 'origin', 'main']);
  const shallow = path.join(f.top, 'shallow');
  const { pathToFileURL } = require('node:url');
  git(f.top, ['clone', '--depth=1', pathToFileURL(f.bare).href, shallow]);
  git(shallow, ['config', 'user.name', 'Fixture']); git(shallow, ['config', 'user.email', 'fixture@example.test']);
  git(shallow, ['fetch', f.local, 'main:refs/heads/old-local']);
  git(shallow, ['switch', 'old-local']); git(shallow, ['branch', '-D', 'main']); git(shallow, ['branch', '-m', 'main']);
  git(shallow, ['remote', 'set-url', 'origin', f.bare]);
  const r = publish({ ...f, local: shallow });
  assert.equal(r.ok, true, r.error); assert.equal(r.recoveredFolder, undefined);
  assert.equal(git(shallow, ['rev-parse', '--is-shallow-repository']).text, 'false');
  assert.equal(fs.readFileSync(path.join(shallow, 'README.md'), 'utf8'), 'next version\n');
});
