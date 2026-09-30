'use strict';

// Публикация DEEPFORGE: сначала резервная копия и локальный коммит,
// затем объединение историй, проверки и обычный push. Зависимости не нужны.
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const { spawnSync } = require('node:child_process');

const TARGETS = [
  'https://github.com/divangames/deepforge.git',
  'https://github.com/divangames/deepforge',
  'git@github.com:divangames/deepforge.git',
  'ssh://git@github.com/divangames/deepforge.git',
];
const split0 = value => value.split('\0').filter(Boolean);
const unique = values => [...new Set(values)].sort();

// Локальные секреты и сборочные файлы не добавляются в публичный коммит.
// Проверка имён не заменяет полноценный поиск секретов в содержимом файлов.
function excluded(name) {
  const p = name.replace(/\\/g, '/');
  const parts = p.toLowerCase().split('/');
  const base = parts.at(-1);
  if (parts.some(s => ['.git', 'node_modules', 'dist', '.rift-tests', '.ui-fixtures', '.idea', '.vscode'].includes(s))) return true;
  if (p.startsWith('qa/uiux/results/')) return true;
  if (base === '.env' || (base.startsWith('.env.') && !/\.(example|sample|template)$/.test(base))) return true;
  if (['.npmrc', '.netrc', '.git-credentials', 'id_rsa', 'id_ed25519'].includes(base)) return true;
  return /\.(zip|rar|7z|log|tsbuildinfo|pem|key|p12|pfx|sqlite|sqlite3|db|bundle|bak)$/i.test(base);
}

function askYesNo(message) {
  process.stdout.write(message + ' [Y/N]: ');
  const byte = Buffer.alloc(1);
  let line = '';
  while (fs.readSync(0, byte, 0, 1, null) > 0) {
    const ch = byte.toString();
    if (ch === '\n') break;
    if (ch !== '\r') line += ch;
  }
  return /^y(es)?$/i.test(line.trim());
}

class Publisher {
  constructor(options = {}) {
    this.cwd = path.resolve(options.cwd || process.cwd());
    this.message = String(options.message || '').trim() || 'auto: DEEPFORGE update';
    this.allowedRemotes = options.allowedRemotes || TARGETS;
    this.confirm = options.confirm || askYesNo;
    this.print = options.print || console.log;
    this.validateOption = options.validate;
    this.validate = options.validate || (() => this.runChecks());
    this.allowRecovery = options.allowRecovery !== false;
    this.recoveredFolder = null;
    this.recoveryPrepared = false;
    this.env = { ...process.env, LC_ALL: 'C', LANG: 'C', GIT_TERMINAL_PROMPT: '1' };
    this.id = new Date().toISOString().replace(/[^0-9]/g, '') + '-' + crypto.randomBytes(3).toString('hex');
    this.logFile = null;
    this.backup = null;
    this.integration = null;
    this.pushed = false;
  }

  log(text) {
    const clean = String(text).replace(/(https?:\/\/)[^\s/@]+:[^\s/@]+@/g, '$1[redacted]@');
    this.print(clean);
    if (this.logFile) fs.appendFileSync(this.logFile, clean + '\n', 'utf8');
  }

  git(args, { cwd = this.cwd, allowFailure = false, input, show = false } = {}) {
    const result = spawnSync('git', ['-c', 'core.quotepath=false', ...args], {
      cwd, env: this.env, encoding: 'utf8', input, maxBuffer: 64 * 1024 * 1024,
      // stdin остаётся доступным Git Credential Manager при сетевых операциях.
      stdio: [input === undefined ? 'inherit' : 'pipe', 'pipe', 'pipe'],
    });
    const out = result.stdout || '';
    const err = result.stderr || '';
    const code = result.status === null ? 1 : result.status;
    if (show || (code !== 0 && !allowFailure)) {
      if (out.trim()) this.log(out.trimEnd());
      if (err.trim()) this.log(err.trimEnd());
    }
    if (!allowFailure && (result.error || code !== 0)) {
      throw new Error(result.error ? `Git could not run: ${result.error.message}` : `Git failed: ${args[0]} (exit ${code}).`);
    }
    return { out, err, code };
  }

  text(args, opts) { return this.git(args, opts).out.trim(); }
  gitPath(name) { return path.resolve(this.cwd, this.text(['rev-parse', '--git-path', name])); }
  hasAncestor(a, b) {
    const r = this.git(['merge-base', '--is-ancestor', a, b], { allowFailure: true });
    if (r.code > 1) throw new Error('Cannot inspect commit ancestry.');
    return r.code === 0;
  }

  preflight() {
    if (Number(process.versions.node.split('.')[0]) < 22) throw new Error('Node.js 22 or newer is required by this project.');
    for (const p of ['package.json', 'client/package.json', 'server/package.json', '.git']) {
      if (!fs.existsSync(path.join(this.cwd, p))) throw new Error(`Wrong folder: missing ${p}. Use the existing project folder, not a new extracted directory.`);
    }
    // Не применяем переменные от внешней Git-операции к другому репозиторию.
    for (const key of ['GIT_DIR', 'GIT_WORK_TREE', 'GIT_INDEX_FILE', 'GIT_COMMON_DIR']) {
      if (process.env[key]) throw new Error(`${key} is set. Open a normal terminal in the project folder.`);
    }
    const expected = [['package.json', 'deepforge-idle-empire'], ['client/package.json', '@deepforge/client'], ['server/package.json', '@deepforge/server']];
    for (const [file, name] of expected) {
      const data = JSON.parse(fs.readFileSync(path.join(this.cwd, file), 'utf8'));
      if (data.name !== name) throw new Error(`Wrong project: ${file} must belong to ${name}. No repository changes were made.`);
    }
    this.log(`[PROJECT FOLDER] ${this.cwd}`);
    this.log(`[PROJECT VERSION] ${JSON.parse(fs.readFileSync(path.join(this.cwd, 'package.json'), 'utf8')).version || 'unspecified'}`);
    this.log('[1/8] Checking DEEPFORGE repository and branch...');
    let probe = this.git(['rev-parse', '--show-toplevel'], { allowFailure: true });
    if (probe.code && /dubious ownership/i.test(probe.err)) {
      this.log(`[WARN] Different repository owner. Folder: ${this.cwd}`);
      if (!this.confirm('Trust ONLY this exact DEEPFORGE folder?')) throw new Error('Cancelled. No trust exception was added.');
      this.git(['config', '--global', '--add', 'safe.directory', this.cwd.replace(/\\/g, '/')]);
      probe = this.git(['rev-parse', '--show-toplevel'], { allowFailure: true });
    }
    if (probe.code) throw new Error(probe.err.trim() || 'Git is unavailable or the repository cannot be opened.');
    const equalPath = p => process.platform === 'win32' ? p.toLowerCase() : p;
    if (equalPath(fs.realpathSync(probe.out.trim())) !== equalPath(fs.realpathSync(this.cwd))) throw new Error('This is a nested folder. Run publish.bat from the repository root.');
    this.gitDir = this.text(['rev-parse', '--absolute-git-dir']);
    this.stateDir = path.join(this.gitDir, 'deepforge-publish');
    fs.mkdirSync(this.stateDir, { recursive: true });
    this.logFile = path.join(this.stateDir, `run-${this.id}.log`);
    fs.writeFileSync(this.logFile, `DEEPFORGE publisher 2.1\n${new Date().toISOString()}\n`, 'utf8');
    this.diagnostics();
    const previousRecovery = path.join(this.stateDir, 'recovery.json');
    if (fs.existsSync(previousRecovery)) {
      const previous = JSON.parse(fs.readFileSync(previousRecovery, 'utf8'));
      this.recoveredFolder = previous.destination;
      this.recoveryPrepared = true;
      throw new Error(`This old folder already has a recovery copy. Use publish.bat inside: ${previous.destination}. No new copy or push was attempted.`);
    }
    for (const p of ['rebase-merge', 'rebase-apply', 'MERGE_HEAD', 'CHERRY_PICK_HEAD', 'REVERT_HEAD', 'BISECT_LOG', 'index.lock']) {
      if (fs.existsSync(this.gitPath(p))) throw new Error(`Unfinished Git operation or lock: ${p}. It was NOT aborted or deleted automatically. See the diagnostic log.`);
    }
    if (this.text(['symbolic-ref', '--quiet', '--short', 'HEAD']) !== 'main') throw new Error('The current branch must be main. No branch was switched or renamed.');
    this.text(['rev-parse', '--verify', 'HEAD']);
    if (this.text(['diff', '--name-only', '--diff-filter=U'])) throw new Error('Unresolved file conflicts exist. No commit or push was attempted.');
    for (const flag of [[], ['--push']]) {
      const urls = this.text(['remote', 'get-url', ...flag, '--all', 'origin']).split('\n');
      if (!urls.length || urls.some(url => !this.allowedRemotes.some(want => url.toLowerCase() === want.toLowerCase()))) {
        throw new Error('origin does not point ONLY to divangames/DEEPFORGE. The remote was not changed.');
      }
    }
    if (/^160000 /m.test(this.git(['ls-files', '--stage']).out)) throw new Error('Submodules need a manual publish review.');
    for (const [key, fallback] of [['user.name', 'divangames'], ['user.email', '61680664+divangames@users.noreply.github.com']]) {
      if (!this.git(['config', '--get', key], { allowFailure: true }).out.trim()) this.git(['config', '--local', key, fallback]);
    }
  }

  diagnostics() {
    if (!this.logFile) return;
    const commands = [
      ['status', '--short', '--branch', '--untracked-files=all'],
      ['log', '-6', '--oneline', '--decorate'],
      ['stash', 'list'],
    ];
    for (const args of commands) {
      const r = this.git(args, { allowFailure: true });
      fs.appendFileSync(this.logFile, `\n$ git ${args.join(' ')}\n${r.out}${r.err}`, 'utf8');
    }
  }

  snapshotFiles() {
    this.log('[2/8] Backing up tracked files and new source files...');
    this.backup = path.join(this.stateDir, 'backups', this.id);
    const filesDir = path.join(this.backup, 'files');
    fs.mkdirSync(filesDir, { recursive: true });
    const tracked = split0(this.git(['ls-files', '-z']).out);
    const fresh = split0(this.git(['ls-files', '--others', '--exclude-standard', '-z']).out);
    const files = unique([...tracked, ...fresh.filter(p => !excluded(p))]);
    const manifest = { head: this.text(['rev-parse', 'HEAD']), files: [], missing: [], omittedUntracked: fresh.filter(excluded) };
    for (const rel of files) {
      const from = path.resolve(this.cwd, rel);
      if (path.relative(this.cwd, from).startsWith('..') || path.isAbsolute(rel)) throw new Error('Unexpected path in Git index.');
      if (!fs.existsSync(from) && !fs.lstatSync(from, { throwIfNoEntry: false })) { manifest.missing.push(rel); continue; }
      const to = path.join(filesDir, rel);
      fs.mkdirSync(path.dirname(to), { recursive: true });
      const st = fs.lstatSync(from);
      if (st.isSymbolicLink()) {
        // Не разыменовываем ссылки на чужие файлы за пределами проекта.
        fs.symlinkSync(fs.readlinkSync(from), to);
      } else if (st.isFile()) {
        fs.copyFileSync(from, to, fs.constants.COPYFILE_EXCL);
      } else throw new Error(`Unsupported source entry: ${rel}`);
      manifest.files.push(rel);
    }
    fs.writeFileSync(path.join(this.backup, 'manifest.json'), JSON.stringify(manifest, null, 2));
    fs.writeFileSync(path.join(this.backup, 'unstaged.patch'), this.git(['diff', '--binary']).out);
    fs.writeFileSync(path.join(this.backup, 'staged.patch'), this.git(['diff', '--cached', '--binary']).out);
    const index = this.gitPath('index');
    if (fs.existsSync(index)) fs.copyFileSync(index, path.join(this.backup, 'index.copy'));
    // bundle и копии лежат внутри .git и не попадают в git add / push.
    this.git(['bundle', 'create', path.join(this.backup, 'history.bundle'), '--all']);
    this.log(`[BACKUP] ${this.backup}`);
  }

  changedPaths() {
    return unique([
      ...split0(this.git(['diff', '--name-only', '-z', 'HEAD']).out),
      ...split0(this.git(['ls-files', '--others', '--exclude-standard', '-z']).out),
    ]);
  }

  stageAndCommit(message) {
    const existing = split0(this.git(['diff', '--cached', '--name-only', '-z']).out).filter(p => excluded(p) && fs.existsSync(path.join(this.cwd, p)));
    if (existing.length) throw new Error(`Private/generated files are already staged: ${existing.join(', ')}. Review the index; they were not published.`);
    const paths = this.changedPaths().filter(p => !excluded(p) || !fs.existsSync(path.join(this.cwd, p)));
    if (paths.length) {
      this.git(['--literal-pathspecs', 'add', '-A', '--pathspec-from-file=-', '--pathspec-file-nul'], { input: paths.join('\0') + '\0' });
    }
    const diff = this.git(['diff', '--cached', '--quiet'], { allowFailure: true });
    if (diff.code > 1) throw new Error('Cannot inspect staged changes.');
    if (diff.code === 1) this.git(['commit', '-m', message], { show: true });
    else this.log('[INFO] No new source changes to commit.');
    if (this.git(['diff', '--quiet'], { allowFailure: true }).code !== 0) {
      throw new Error('Some tracked files are still modified (possibly local/generated files). No sync or push was attempted.');
    }
  }

  integrate() {
    this.log('[4/8] Fetching origin/main and merging in an isolated worktree...');
    this.git(['fetch', '--no-tags', 'origin', 'refs/heads/main:refs/remotes/origin/main'], { show: true });
    let remote = this.text(['rev-parse', 'origin/main']);
    const local = this.text(['rev-parse', 'HEAD']);
    let base = this.git(['merge-base', local, remote], { allowFailure: true });
    if (base.code > 1) throw new Error('Git could not inspect history. Recovery was not attempted.');
    // Неглубокий clone не означает независимые истории: сначала догружаем предков.
    if ((base.code === 1 || !base.out.trim()) && this.text(['rev-parse', '--is-shallow-repository']) === 'true') {
      this.log('[INFO] Fetching complete history before checking ancestry again...');
      this.git(['fetch', '--unshallow', '--no-tags', 'origin', 'refs/heads/main:refs/remotes/origin/main'], { show: true });
      remote = this.text(['rev-parse', 'origin/main']);
      base = this.git(['merge-base', local, remote], { allowFailure: true });
      if (base.code > 1) throw new Error('Git could not inspect complete history. Recovery was not attempted.');
    }
    if (base.code === 1 || !base.out.trim()) {
      if (!this.allowRecovery) throw new Error('Local and remote histories have no common ancestor. Recovery is disabled in this run.');
      return { recovery: this.recoverUnrelated(remote, local) };
    }
    if (this.hasAncestor(remote, local)) { this.log('[INFO] Remote commits are already included.'); return; }
    let candidate = remote;
    if (!this.hasAncestor(local, remote)) {
      this.integration = path.join(this.stateDir, 'integrations', this.id);
      fs.mkdirSync(path.dirname(this.integration), { recursive: true });
      this.git(['worktree', 'add', '--detach', this.integration, local], { show: true });
      const merged = this.git([
        '-c', 'rerere.enabled=false', 'merge', '--ff', '--no-edit', '--no-autostash',
        '--no-overwrite-ignore', '-m', 'chore: merge origin/main before verified publish', remote,
      ], { cwd: this.integration, allowFailure: true, show: true });
      if (merged.code) {
        const conflicts = this.git(['diff', '--name-only', '--diff-filter=U'], { cwd: this.integration, allowFailure: true }).out.trim();
        if (conflicts) this.log(`[CONFLICT FILES]\n${conflicts}`);
        this.log(`[REVIEW WORKTREE] ${this.integration}`);
        throw new Error('Merge needs review. The main working folder is unchanged by this merge. Local snapshot and remote history are preserved; nothing was pushed.');
      }
      candidate = this.text(['rev-parse', 'HEAD'], { cwd: this.integration });
    }
    this.git(['merge', '--ff-only', '--no-autostash', '--no-overwrite-ignore', candidate], { show: true });
    if (this.integration) {
      // Только штатное удаление ЧИСТОЙ служебной worktree, без --force.
      const r = this.git(['worktree', 'remove', this.integration], { allowFailure: true });
      if (r.code) this.log(`[INFO] Integration worktree retained: ${this.integration}`);
    }
  }

  // Независимую историю НЕ сливаем. Переносим проверяемые файлы на новый clone
  // только после явного согласия. Старый каталог, HEAD и .git не заменяются.
  recoverUnrelated(remote, local) {
    const destination = path.join(path.dirname(this.cwd), `DEEPFORGE-recovered-${this.id}`);
    this.log('[WARN] Local and remote histories have no common ancestor.');
    this.log(`[SOURCE] ${this.cwd}`);
    this.log(`[NEW FOLDER] ${destination}`);
    this.log('[INFO] This creates a separate clone of origin/main, then shows a file transfer plan.');
    this.log('[INFO] The old folder is kept. Its .git, node_modules and private files are NOT copied.');
    if (!this.confirm('Create a separate DEEPFORGE recovery copy?')) throw new Error('Local and remote histories have no common ancestor. Recovery cancelled; nothing was pushed.');
    if (fs.existsSync(destination)) throw new Error('Recovery folder already exists. It was not overwritten.');
    const origin = this.text(['remote', 'get-url', 'origin']);
    this.git(['clone', '--single-branch', '--branch', 'main', '--no-tags', '--', origin, destination], { show: true });
    this.recoveredFolder = destination;
    const cloneHead = this.text(['rev-parse', 'HEAD'], { cwd: destination });
    // clone мог увидеть более свежий коммит: перенос всегда поверх его истории.
    const expected = [['package.json', 'deepforge-idle-empire'], ['client/package.json', '@deepforge/client'], ['server/package.json', '@deepforge/server']];
    for (const [file, name] of expected) {
      const data = JSON.parse(fs.readFileSync(path.join(destination, file), 'utf8'));
      if (data.name !== name) throw new Error(`Remote clone does not contain the expected DEEPFORGE project (${file}). Nothing was copied or pushed.`);
    }
    const roots = new Set(['client', 'server', 'scripts', 'docs', 'tests', 'qa', '.agents', '.cursor', '.github']);
    const names = new Set(['package.json', 'package-lock.json', 'README.md', 'CHANGELOG.md', '.gitignore', '.gitattributes', '.env.example', 'docker-compose.yml', 'Dockerfile', '.dockerignore', 'AGENTS.md']);
    const safePath = rel => {
      if (excluded(rel)) return false;
      const bits = rel.split('/');
      if (bits.some(part => !part || part === '.' || part === '..') || path.isAbsolute(rel)) return false;
      return roots.has(bits[0]) || names.has(rel) || (bits.length === 1 && /^(publish|build|dev|deploy|repair|authorize|fix)[a-z0-9_-]*\.bat$/i.test(rel));
    };
    const digest = file => crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex');
    const assertPlain = (root, rel, requireFile = false) => {
      const parts = rel.split('/'); let p = root;
      for (let i = 0; i < parts.length; i++) {
        p = path.join(p, parts[i]);
        const st = fs.lstatSync(p, { throwIfNoEntry: false });
        if (!st) { if (requireFile) throw new Error(`Source file disappeared: ${rel}`); return; }
        if (st.isSymbolicLink() || (i < parts.length - 1 && !st.isDirectory()) || (i === parts.length - 1 && !st.isFile())) throw new Error(`Unsafe or non-regular transfer path: ${rel}. Nothing was pushed.`);
      }
    };
    const tracked = split0(this.git(['ls-files', '-z']).out);
    const plan = { source: this.cwd, destination, localHead: local, fetchedRemoteHead: remote, baseHead: cloneHead, files: [], omitted: [], remoteOnlyPreserved: [] };
    for (const rel of tracked) {
      if (!safePath(rel)) { plan.omitted.push(rel); continue; }
      assertPlain(this.cwd, rel, true); assertPlain(destination, rel);
      const from = path.join(this.cwd, rel), to = path.join(destination, rel);
      const sha256 = digest(from);
      const status = !fs.existsSync(to) ? 'add' : digest(to) === sha256 ? 'same' : 'replace';
      plan.files.push({ path: rel, status, sha256 });
    }
    const fileSet = new Set(plan.files.map(f => f.path));
    plan.remoteOnlyPreserved = split0(this.git(['ls-files', '-z'], { cwd: destination }).out).filter(p => !fileSet.has(p));
    const planPath = path.join(this.backup, 'recovery-plan.json');
    fs.writeFileSync(planPath, JSON.stringify(plan, null, 2));
    for (const item of plan.files.filter(p => p.status !== 'same')) this.log(`[${item.status.toUpperCase()}] ${item.path}`);
    this.log(`[PLAN] ${planPath}`);
    this.log(`[INFO] ${plan.files.filter(f => f.status !== 'same').length} file changes; ${plan.remoteOnlyPreserved.length} remote-only files are kept. No source deletions are inferred.`);
    if (plan.omitted.length) this.log(`[OMITTED PATHS] ${plan.omitted.join(', ')}`);
    if (!this.confirm('Apply these local DEEPFORGE files to the NEW folder, run all checks and push?')) throw new Error('Transfer cancelled. The clone and the original folder are kept; nothing was copied or pushed.');
    // Сначала проверяем ВСЕ исходные хеши, затем копируем. Параллельное редактирование
    // не должно незаметно изменить подтверждённый набор файлов.
    for (const f of plan.files) {
      assertPlain(this.cwd, f.path, true); assertPlain(destination, f.path);
      if (digest(path.join(this.cwd, f.path)) !== f.sha256) throw new Error(`Source changed after review: ${f.path}. Nothing was pushed.`);
    }
    for (const f of plan.files.filter(f => f.status !== 'same')) {
      const to = path.join(destination, f.path);
      fs.mkdirSync(path.dirname(to), { recursive: true });
      fs.copyFileSync(path.join(this.cwd, f.path), to);
    }
    for (const [file, name] of expected) {
      if (JSON.parse(fs.readFileSync(path.join(destination, file), 'utf8')).name !== name) throw new Error('Transferred project identity changed unexpectedly.');
    }
    for (const key of ['user.name', 'user.email']) {
      const value = this.text(['config', '--get', key]);
      this.git(['config', '--local', key, value], { cwd: destination });
    }
    const marker = { destination, sourceHead: local, createdAt: new Date().toISOString(), plan: planPath };
    fs.writeFileSync(path.join(this.stateDir, 'recovery.json'), JSON.stringify(marker, null, 2));
    this.recoveryPrepared = true;
    this.log(`[WORKING FOLDER] ${destination}`);
    this.log('[INFO] Continue future development from this NEW folder. The original folder remains a backup.');
    const next = new Publisher({ cwd: destination, message: this.message, allowedRemotes: this.allowedRemotes, confirm: this.confirm, print: this.print, validate: this.validateOption, allowRecovery: false });
    next.env = { ...this.env };
    const result = next.run();
    if (process.platform === 'win32') spawnSync('explorer.exe', [destination], { stdio: 'ignore', shell: false });
    return { ...result, recoveredFolder: destination, originalBackup: this.backup };
  }

  findNpmCli() {
    const nodeDir = path.dirname(process.execPath);
    const candidates = [path.join(nodeDir, 'node_modules/npm/bin/npm-cli.js'), path.resolve(nodeDir, '../lib/node_modules/npm/bin/npm-cli.js')];
    const found = spawnSync(process.platform === 'win32' ? 'where.exe' : 'which', ['npm'], { encoding: 'utf8' });
    for (const line of (found.stdout || '').trim().split(/\r?\n/).filter(Boolean)) {
      const dir = path.dirname(line);
      candidates.push(path.join(dir, 'node_modules/npm/bin/npm-cli.js'));
      try { if (fs.realpathSync(line).endsWith('npm-cli.js')) candidates.push(fs.realpathSync(line)); } catch { /* Проверим следующий стандартный путь. */ }
    }
    const cli = candidates.find(p => fs.existsSync(p));
    if (!cli) throw new Error('npm-cli.js was not found. Repair the Node.js/npm installation; no push was attempted.');
    return cli;
  }

  runChecks() {
    const cli = this.findNpmCli();
    for (const args of [['install', '--no-audit', '--no-fund'], ['run', 'typecheck'], ['test'], ['run', 'build']]) {
      this.log(`\n$ npm ${args.join(' ')}`);
      const r = spawnSync(process.execPath, [cli, ...args], { cwd: this.cwd, stdio: 'inherit', env: this.env });
      if (r.error || r.status !== 0) throw new Error(`npm ${args.join(' ')} failed. Source snapshot is saved locally. Nothing was pushed.`);
    }
  }

  finishValidation() {
    this.log('[5/8] Installing dependencies, checking types, tests and production build...');
    const headBefore = this.text(['rev-parse', 'HEAD']);
    this.validate();
    if (this.text(['symbolic-ref', '--quiet', '--short', 'HEAD']) !== 'main' || this.text(['rev-parse', 'HEAD']) !== headBefore) {
      throw new Error('The branch changed during validation. Stop other Git operations and retry.');
    }
    this.log('[6/8] Checking the verified working tree...');
    const dirty = split0(this.git(['diff', '--name-only', '-z', 'HEAD']).out);
    const unexpected = dirty.filter(p => p !== 'package-lock.json');
    const newSource = split0(this.git(['ls-files', '--others', '--exclude-standard', '-z']).out).filter(p => !excluded(p) && p !== 'package-lock.json');
    if (unexpected.length || newSource.length) throw new Error(`Files changed during validation: ${unique([...unexpected, ...newSource]).join(', ')}. Review them and run publish again.`);
    this.stageAndCommit('chore: update dependency lock after successful checks');
    const forbidden = split0(this.git(['diff', '--name-only', '-z', 'origin/main', 'HEAD']).out).filter(p => excluded(p) && fs.existsSync(path.join(this.cwd, p)));
    if (forbidden.length) throw new Error(`Local commits include private/generated paths: ${forbidden.join(', ')}. Review before publishing.`);
  }

  push() {
    this.log('[7/8] Verifying remote did not change during the build...');
    this.git(['fetch', '--no-tags', 'origin', 'refs/heads/main:refs/remotes/origin/main'], { show: true });
    if (!this.hasAncestor('origin/main', 'HEAD')) throw new Error('GitHub main advanced during validation. Run publish again to merge and recheck. No force-push was used.');
    if (this.text(['symbolic-ref', '--quiet', '--short', 'HEAD']) !== 'main' || this.git(['diff', '--quiet', 'HEAD'], { allowFailure: true }).code || this.changedPaths().some(p => !excluded(p))) {
      throw new Error('Working tree changed before push. Run publish again.');
    }
    const sha = this.text(['rev-parse', 'HEAD']);
    this.log('[8/8] Pushing the checked commit to origin/main...');
    const r = this.git(['-c', 'push.followTags=false', 'push', 'origin', `${sha}:refs/heads/main`], { allowFailure: true, show: true });
    if (r.code) {
      if (/workflow.*scope|without.*workflow/i.test(r.err)) this.log('[AUTH] GitHub refused a workflow change. Reauthorize the existing Git credential helper with workflow permission.');
      throw new Error('Push was rejected. Commits and backups remain local. No forced push or credential change was attempted.');
    }
    this.pushed = true;
    this.log('[OK] Push accepted. This does NOT yet mean Pages deployment succeeded.');
    this.log('[ACTIONS] https://github.com/divangames/DEEPFORGE/actions');
    this.log('[GAME] https://divangames.github.io/DEEPFORGE/');
  }

  run() {
    let lock = null;
    try {
      this.preflight();
      lock = path.join(this.stateDir, 'publish.lock');
      try { fs.writeFileSync(lock, `${process.pid}\n`, { flag: 'wx' }); }
      catch { lock = null; throw new Error('Another publish is running, or a publish.lock remains after interruption. Nothing was changed.'); }
      this.snapshotFiles();
      this.log('[3/8] Saving local source changes BEFORE synchronization...');
      this.stageAndCommit(this.message);
      this.backupRef = `df-backup/publish-${this.id}`;
      this.git(['branch', this.backupRef, 'HEAD']);
      this.log(`[LOCAL BACKUP BRANCH] ${this.backupRef}`);
      const integration = this.integrate();
      if (integration?.recovery) return integration.recovery;
      this.finishValidation();
      this.push();
      return { ok: true, backup: this.backup, backupRef: this.backupRef, logFile: this.logFile };
    } catch (e) {
      this.log(`\n[ERROR] ${e.message}`);
      this.log('[STOPPED] No git clean, hard reset or force-push was used.');
      if (this.backup) this.log(`[BACKUP] ${this.backup}`);
      return { ok: false, error: e.message, backup: this.backup, backupRef: this.backupRef, integration: this.integration, recoveredFolder: this.recoveredFolder, logFile: this.logFile };
    } finally {
      if (this.logFile) {
        try {
          this.diagnostics();
          fs.copyFileSync(this.logFile, path.join(this.stateDir, 'last-run.log'));
          this.log(`[DIAGNOSTIC] ${path.join(this.stateDir, 'last-run.log')}`);
        } catch { /* Сохраняем исходную причину остановки. */ }
      }
      if (this.recoveredFolder) this.log(`[${this.recoveryPrepared ? 'WORKING FOLDER' : 'REVIEW COPY'}] ${this.recoveredFolder}`);
      if (lock) { try { fs.unlinkSync(lock); } catch { /* Не удаляем чужие файлы блокировки. */ } }
    }
  }
}

module.exports = { Publisher, excluded, split0 };
if (require.main === module) {
  const result = new Publisher({ message: process.argv.slice(2).join(' ') }).run();
  process.exitCode = result.ok ? 0 : 1;
}
