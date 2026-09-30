'use strict';
// Локальный CLI берётся из публичного поля bin, а не из закрытого subpath пакета.
// Ничего не скачивает, не запускает глобальный tsc и не подменяет версии зависимостей.
const fs = require('node:fs');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

function localPackage(root, name, workspaces = ['server', 'client']) {
  const roots = [...workspaces.map(w => path.join(root, w)), root];
  for (const base of roots) {
    const file = path.join(base, 'node_modules', name, 'package.json');
    if (!fs.existsSync(file)) continue;
    const data = JSON.parse(fs.readFileSync(file, 'utf8'));
    return { dir: path.dirname(file), file, data };
  }
  throw new Error(`Local dependency ${name} is missing. Run npm install in the DEEPFORGE root. No global compiler or download fallback was used.`);
}
function isWithin(parent, file) {
  const rel = path.relative(parent, file);
  return rel !== '..' && !rel.startsWith('..' + path.sep) && !path.isAbsolute(rel);
}
function compilerCommand(root, args, { workspaces = ['server', 'client'], env = process.env } = {}) {
  let file, version;
  if (env.DF_TSC_PATH) {
    file = path.resolve(root, env.DF_TSC_PATH);
    version = 'explicit DF_TSC_PATH';
  } else {
    const pkg = localPackage(root, 'typescript', workspaces);
    const bin = typeof pkg.data.bin === 'string' ? pkg.data.bin : pkg.data.bin?.tsc;
    if (typeof bin !== 'string' || !bin) throw new Error('The installed typescript package does not declare a tsc CLI in package.json bin. Reinstall the project dependencies.');
    file = path.resolve(pkg.dir, bin);
    if (!isWithin(pkg.dir, file)) throw new Error('Invalid tsc bin path outside its package.');
    version = pkg.data.version;
  }
  if (!fs.statSync(file, { throwIfNoEntry: false })?.isFile()) throw new Error(`TypeScript CLI does not exist: ${file}`);
  const fd = fs.openSync(file, 'r');
  const header = Buffer.alloc(256);
  let length;
  try { length = fs.readSync(fd, header, 0, header.length, 0); } finally { fs.closeSync(fd); }
  const bytes = header.subarray(0, length);
  const firstLine = bytes.toString('utf8').split(/\r?\n/, 1)[0];
  if (/\.[cm]?js$/i.test(file) || (/^#!/.test(firstLine) && /\bnode\b/.test(firstLine))) {
    return { command: process.execPath, args: [file, ...args], file, version };
  }
  const signature = bytes.length >= 4 ? bytes.readUInt32BE(0) : 0;
  const native = bytes.subarray(0, 2).toString() === 'MZ' || signature === 0x7f454c46 || [0xfeedface, 0xfeedfacf, 0xcefaedfe, 0xcffaedfe, 0xcafebabe].includes(signature);
  if (!native) throw new Error(`Unsupported TypeScript CLI launcher: ${file}. Expected Node.js launcher or native binary; no shell command was guessed.`);
  return { command: file, args: [...args], file, version };
}
function runCompiler(root, args, options = {}) {
  const invocation = compilerCommand(root, args, options);
  console.log(`[TSC] ${invocation.version}: ${invocation.file}`);
  const result = spawnSync(invocation.command, invocation.args, {
    cwd: root, env: options.env || process.env, stdio: 'inherit', shell: false,
  });
  if (result.error) throw new Error(`Could not start TypeScript: ${result.error.message}`);
  if (result.status !== 0) {
    const error = new Error(`TypeScript compilation failed (exit ${result.status ?? result.signal}). Tests were NOT run against stale output.`);
    error.exitCode = Number.isInteger(result.status) && result.status > 0 ? result.status : 1;
    throw error;
  }
}
function nodeTypeRoot(root, { env = process.env } = {}) {
  const dir = env.DF_TYPE_ROOT ? path.resolve(root, env.DF_TYPE_ROOT) : path.dirname(localPackage(root, '@types/node').dir);
  if (!fs.existsSync(path.join(dir, 'node', 'package.json'))) throw new Error(`Node.js type definitions were not found under ${dir}. Install @types/node for this project.`);
  return dir;
}
module.exports = { localPackage, compilerCommand, runCompiler, nodeTypeRoot };
