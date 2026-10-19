import { access, cp, mkdir, readFile, readdir, rm, writeFile } from 'node:fs/promises';
import { spawn } from 'node:child_process';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const editor = process.env.UNITY_EDITOR ?? '/Applications/Unity/Hub/Editor/6000.5.8f1/Unity.app/Contents/MacOS/Unity';
const output = join(root, 'unity/Build/Native');
const log = join(root, 'unity/BuildLogs/native.log');
async function run(command, args, env = {}) {
  await new Promise((resolveRun, reject) => {
    const child = spawn(command, args, { cwd: root, stdio: 'inherit', env: { ...process.env, ...env } });
    child.on('error', reject);
    child.on('exit', code => code === 0 ? resolveRun() : reject(new Error(`${command} failed (${code}). Unity log: ${log}`)));
  });
}
if (!process.argv.includes('--reuse')) {
  await access(editor);
  await run(process.execPath, ['scripts/check-unity-presentation.mjs']);
  await run(process.execPath, ['scripts/check-wasm.mjs']);
  await run(join(root, 'node_modules/.bin/esbuild'), ['scripts/export-unity-assets.tsx', '--bundle', '--platform=node', '--format=cjs', '--packages=external', '--jsx=automatic', '--outfile=.openai/export-unity-assets.cjs']);
  await run(process.execPath, ['.openai/export-unity-assets.cjs']);
  if (process.platform === 'darwin') {
    const cargo = process.env.CARGO ?? join(process.env.HOME, '.cargo/bin/cargo');
    await run(cargo, ['build', '--locked', '--release', '--manifest-path', 'rust/azarashi-engine/Cargo.toml']);
    await mkdir(join(root, 'unity/Assets/Plugins/macOS'), { recursive: true });
    await cp(join(root, 'rust/azarashi-engine/target/release/libazarashi_engine.dylib'), join(root, 'unity/Assets/Plugins/macOS/libazarashi_engine.dylib'));
  }
  await mkdir(dirname(log), { recursive: true });
  console.log(`Building native Unity UI and game (log: ${log})`);
  await run(editor, ['-batchmode', '-quit', '-nographics', '-projectPath', join(root, 'unity'), '-buildTarget', 'WebGL', '-executeMethod', 'Azarashi.UnityView.Editor.WebBuild.Build', '-logFile', log], { AZARASHI_UNITY_OUTPUT: output });
}
if (!process.argv.includes('--reuse')) {
  await run(join(root, 'node_modules/.bin/esbuild'), ['scripts/validate-unity-record.ts', '--bundle', '--platform=node', '--format=esm', '--packages=external', '--outfile=.openai/validate-unity-record.mjs']);
  await run(process.execPath, ['.openai/validate-unity-record.mjs']);
}
const files = await readdir(join(output, 'Build'));
for (const suffix of ['.data', '.framework.js', '.loader.js', '.wasm'])
  if (!files.some(file => file.endsWith(suffix))) throw new Error(`Missing Unity artifact ${suffix}`);
const destination = join(root, 'dist-unity');
await rm(destination, { recursive: true, force: true });
await cp(output, destination, { recursive: true });
await cp(join(root, 'unity/Assets/Shaders/THIRD_PARTY.txt'), join(destination, 'THIRD_PARTY.txt'));
await cp(join(root, 'unity/Assets/Resources/Native/FontLicense.txt'), join(destination, 'FONT-LICENSE.txt'));
await cp(join(root, 'node_modules/lucide-react/LICENSE'), join(destination, 'ICON-LICENSE.txt'));
const html = await readFile(join(destination, 'index.html'), 'utf8');
if (html.includes('assets/index-') || html.includes('id="root"')) throw new Error('The native Unity build must not contain the React UI host.');
await writeFile(join(destination, 'unity-build.json'), JSON.stringify({ renderer: 'Unity', ui: 'UI Toolkit', engine: 'original Rust WASM', builtAt: new Date().toISOString() }, null, 2));
console.log('Native Unity build ready: dist-unity/ (no React runtime UI)');
