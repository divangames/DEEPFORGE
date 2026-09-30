// Строгая компиляция реального ядра. Ошибка компилятора всегда блокирует тесты/push.
import { spawnSync } from 'node:child_process';
import { mkdirSync, writeFileSync, rmSync, openSync, closeSync, unlinkSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import tools from './local-typescript.cjs';
const root = path.resolve(fileURLToPath(new URL('..', import.meta.url)));
const out = path.join(root, '.rift-tests');
const lock = path.join(out, '.runner.lock');
let locked = false;
try {
  mkdirSync(out, { recursive: true });
  try { closeSync(openSync(lock, 'wx')); locked = true; }
  catch { throw new Error('Another Rift test runner is active, or .rift-tests/.runner.lock remains from an interrupted run. Stop other test processes before retrying.'); }
  const config = path.join(out, 'tsconfig.test.json');
  writeFileSync(config, JSON.stringify({
    compilerOptions: {
      target: 'ES2022', module: 'NodeNext', moduleResolution: 'NodeNext',
      strict: true, skipLibCheck: true, noEmitOnError: true,
      types: ['node'], typeRoots: [tools.nodeTypeRoot(root)],
      rootDir: path.join(root, 'server/src/rift'), outDir: out,
    },
    files: ['protocol', 'engine', 'repository', 'service', 'validation'].map(name => path.join(root, `server/src/rift/${name}.ts`)),
  }, null, 2));
  // -p избегает неоднозначности явных файлов и tsconfig в разных версиях TS.
  tools.runCompiler(root, ['--project', config, '--pretty', 'false']);
  writeFileSync(path.join(out, 'package.json'), '{"type":"module"}');
  const test = spawnSync(process.execPath, ['--test', 'scripts/rift-tests.mjs', 'scripts/reactor-tests.mjs'], { cwd: root, stdio: 'inherit', shell: false });
  if (test.error) throw test.error;
  if (test.status !== 0) throw new Error(`Rift tests failed (exit ${test.status ?? test.signal}).`);
  // Удаляется только временный результат успешного теста, исходники не затрагиваются.
  rmSync(out, { recursive: true, force: true });
} catch (error) {
  console.error(`[ERROR] ${error.message}`);
  process.exitCode = error.exitCode || 1;
} finally {
  if (locked && existsSync(lock)) unlinkSync(lock);
}
