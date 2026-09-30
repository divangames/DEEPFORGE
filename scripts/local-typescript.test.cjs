'use strict';
// Тесты разрешения CLI используют фиктивные метаданные пакетов, не подменяют
// проверку реального ядра и не утверждают, что установлен TypeScript 7.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const { createRequire } = require('node:module');
const { compilerCommand, runCompiler, localPackage, nodeTypeRoot } = require('./local-typescript.cjs');
function fixture(t) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'df-compiler-'));
  const root = path.join(dir, 'Программирование !!!GAMES (test)'); fs.mkdirSync(root);
  t.after(() => fs.rmSync(dir, { recursive: true, force: true })); return root;
}
function write(root, name, content) { const f = path.join(root, name); fs.mkdirSync(path.dirname(f), { recursive: true }); fs.writeFileSync(f, content); return f; }
function pkg(root, location = '', data = {}) {
  const folder = path.join(location, 'node_modules/typescript');
  write(root, path.join(folder, 'package.json'), JSON.stringify({ name: 'typescript', version: 'test-fixture', bin: { tsc: './launcher.cjs' }, exports: { '.': './api.cjs' }, ...data }));
  write(root, path.join(folder, 'api.cjs'), 'module.exports = {};');
  return write(root, path.join(folder, 'launcher.cjs'), 'process.exit(0);');
}

test('reproduces ERR_PACKAGE_PATH_NOT_EXPORTED and resolves tsc via declared bin', t => {
  const root = fixture(t), file = pkg(root);
  write(root, 'package.json', '{"name":"test"}');
  const requireProject = createRequire(path.join(root, 'package.json'));
  assert.throws(() => requireProject.resolve('typescript/bin/tsc'), { code: 'ERR_PACKAGE_PATH_NOT_EXPORTED' });
  assert.throws(() => requireProject.resolve('typescript/package.json'), { code: 'ERR_PACKAGE_PATH_NOT_EXPORTED' });
  const resolved = compilerCommand(root, ['--version'], { env: {} });
  assert.equal(resolved.command, process.execPath); assert.equal(resolved.args[0], file);
  assert.equal(resolved.args[1], '--version');
});
test('executes declared local launcher with spaces, Cyrillic and literal exclamation marks', t => {
  const root = fixture(t), file = pkg(root);
  fs.writeFileSync(file, "require('fs').writeFileSync(process.argv[2], 'executed');");
  const output = path.join(root, 'some ! output.txt');
  runCompiler(root, [output], { env: {} });
  assert.equal(fs.readFileSync(output, 'utf8'), 'executed');
});
test('workspace-specific compiler selection works without a hoisted root dependency', t => {
  const root = fixture(t), server = pkg(root, 'server'), client = pkg(root, 'client');
  assert.equal(compilerCommand(root, [], { env: {} }).file, server);
  assert.equal(compilerCommand(root, [], { env: {}, workspaces: ['client', 'server'] }).file, client);
});
test('extensionless Node shebang launcher and string bin are supported', t => {
  const root = fixture(t); pkg(root, '', { bin: './bin/tsc' });
  const file = write(root, 'node_modules/typescript/bin/tsc', '#!/usr/bin/env node\nprocess.exit(0);');
  assert.equal(compilerCommand(root, [], { env: {} }).file, file);
  assert.equal(compilerCommand(root, [], { env: {} }).command, process.execPath);
});
test('native executable is dispatched directly, not through node', t => {
  const root = fixture(t); pkg(root, '', { bin: { tsc: './bin/tsc.exe' } });
  const file = write(root, 'node_modules/typescript/bin/tsc.exe', Buffer.from([0x4d,0x5a,0,0]));
  const result = compilerCommand(root, ['-p', 'config.json'], { env: {} });
  assert.equal(result.command, file); assert.deepEqual(result.args, ['-p', 'config.json']);
});
test('compiler error is propagated, not converted into a passing test', t => {
  const root = fixture(t), file = pkg(root); fs.writeFileSync(file, 'process.exit(2);');
  assert.throws(() => runCompiler(root, [], { env: {} }), error => error.exitCode === 2 && /NOT run/.test(error.message));
});
test('missing local compiler stops rather than using a global compiler or npx', t => {
  const root = fixture(t);
  assert.throws(() => compilerCommand(root, [], { env: {} }), /Local dependency typescript is missing/);
});
test('missing tsc bin and escaping bin fail clearly', t => {
  const root = fixture(t); pkg(root, '', { bin: { other: 'launcher.cjs' } });
  assert.throws(() => compilerCommand(root, [], { env: {} }), /does not declare a tsc CLI/);
  pkg(root, '', { bin: { tsc: '../outside.js' } });
  assert.throws(() => compilerCommand(root, [], { env: {} }), /outside its package/);
});
test('node typings are found in workspace even when package exports blocks imports', t => {
  const root = fixture(t);
  write(root, 'server/node_modules/@types/node/package.json', '{"name":"@types/node","exports":{}}');
  assert.equal(nodeTypeRoot(root, { env: {} }), path.join(root, 'server/node_modules/@types'));
});
test('explicit compiler override remains available for isolated QA without version changes', t => {
  const root = fixture(t); write(root, 'custom.cjs', 'process.exit(0);');
  assert.equal(compilerCommand(root, [], { env: { DF_TSC_PATH: './custom.cjs' } }).file, path.join(root, 'custom.cjs'));
  assert.throws(() => compilerCommand(root, [], { env: { DF_TSC_PATH: './missing.cjs' } }), /does not exist/);
});
