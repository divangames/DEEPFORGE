// Реальная строгая компиляция UI-policy, затем проверки без DOM/React-заглушек.
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const { runCompiler } = require('./local-typescript.cjs');
const assert = require('node:assert/strict');
const { pathToFileURL } = require('node:url');
const root = path.resolve(__dirname, '..');
const out = fs.mkdtempSync(path.join(os.tmpdir(), 'deepforge-ui-'));
let passed = 0;
function check(name, action) { action(); passed++; console.log(`[PASS] ${name}`); }
async function main() {
try {
  const config = path.join(out, 'tsconfig.test.json');
  fs.writeFileSync(config, JSON.stringify({
    compilerOptions: {
      target: 'ES2022', module: 'NodeNext', moduleResolution: 'NodeNext', strict: true,
      lib: ['ES2022', 'DOM', 'DOM.Iterable'], types: [], noEmitOnError: true,
      rootDir: path.join(root, 'client/src'), outDir: out,
    },
    files: ['ui/platform/uiState.ts', 'ui/platform/dialogController.ts', 'ui/platform/viewport.ts', 'game/runtime/viewPerformance.ts'].map(name => path.join(root, 'client/src', name)),
  }, null, 2));
  runCompiler(root, ['--project', config, '--pretty', 'false'], { workspaces: ['client', 'server'] });

  fs.writeFileSync(path.join(out, 'package.json'), '{"type":"module"}');
  const { togglePanel, validateFriendId } = await import(pathToFileURL(path.join(out, 'ui/platform/uiState.js')).href);
  const { coverGameScene, isGameSceneCovered } = await import(pathToFileURL(path.join(out, 'game/runtime/viewPerformance.js')).href);
  check('open requested panel', () => assert.equal(togglePanel(null, 'team', true), 'team'));
  check('replace Events with Rift', () => assert.equal(togglePanel('events', 'rift', true), 'rift'));
  check('late close does not close another panel', () => assert.equal(togglePanel('rift', 'events', false), 'rift'));
  check('return to mine', () => assert.equal(togglePanel('research', 'research', false), null));
  check('coverage is reference counted and release is idempotent', () => { const a=coverGameScene(),b=coverGameScene();assert.ok(isGameSceneCovered());a();a();assert.ok(isGameSceneCovered());b();assert.equal(isGameSceneCovered(), false); });
  const self = 'DF-SELF-0001';
  check('invalid IDs explain the format', () => { for (const id of ['', 'wrong', 'DF-A-0001', 'DF-TEST-0001!!']) assert.match(validateFriendId(id, self, [], 20), /формате/); });
  check('self invite rejected', () => assert.match(validateFriendId(self, self, [], 20), /ваш/));
  check('duplicate invite rejected', () => assert.match(validateFriendId('DF-TEST-0001', self, ['DF-TEST-0001'], 20), /уже/));
  check('friend limit explained', () => assert.match(validateFriendId('DF-TEST-0001', self, Array(20).fill('DF-XXXX-XXXX'), 20), /20/));
  check('valid new ID accepted', () => assert.equal(validateFriendId('DF-TEST-0001', self, [], 20), null));
  console.log(`UI policy: ${passed}/10 passed. React, browser gestures and the full game build are NOT covered by this script.`);
} catch (error) {
  console.error(error); process.exitCode = 1;
} finally { fs.rmSync(out, { recursive: true, force: true }); }

}
main().catch(error => { console.error(error); process.exitCode = 1; });
