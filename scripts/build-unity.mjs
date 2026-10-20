import { access, cp, mkdir, readFile, readdir, rm, writeFile } from 'node:fs/promises';
import { spawn } from 'node:child_process';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { homedir } from 'node:os';
import { createRequire } from 'node:module';
import { prepareUnityEditor } from './unity-editor-copy.mjs';
import { prepareUnityroomPackage } from './package-unityroom.mjs';
const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const unityroom = process.argv.includes('--unityroom');
const require = createRequire(import.meta.url);
const version = (await readFile(join(root, 'unity/ProjectSettings/ProjectVersion.txt'), 'utf8'))
  .match(/^m_EditorVersion: (.+)$/m)[1]
  .trim();
const editor =
  process.env.UNITY_EDITOR ??
  (process.platform === 'win32'
    ? join(
        process.env.ProgramFiles ?? 'C:/Program Files',
        'Unity/Hub/Editor',
        version,
        'Editor/Unity.exe',
      )
    : process.platform === 'darwin'
      ? `/Applications/Unity/Hub/Editor/${version}/Unity.app/Contents/MacOS/Unity`
      : join(homedir(), 'Unity/Hub/Editor', version, 'Editor/Unity'));
const esbuild = require.resolve('esbuild/bin/esbuild');
const output = join(root, unityroom ? 'unity/Build/Unityroom' : 'unity/Build/Native');
const log = join(root, unityroom ? 'unity/BuildLogs/unityroom.log' : 'unity/BuildLogs/native.log');
async function run(command, args, env = {}) {
  await new Promise((resolveRun, reject) => {
    const child = spawn(command, args, {
      cwd: root,
      stdio: 'inherit',
      env: { ...process.env, ...env },
    });
    child.on('error', reject);
    child.on('exit', (code) =>
      code === 0
        ? resolveRun()
        : reject(
            new Error(
              `${command} failed (${code}). Unity log: ${args.includes('-logFile') ? args[args.indexOf('-logFile') + 1] : log}`,
            ),
          ),
    );
  });
}
if (!process.argv.includes('--reuse')) {
  await access(editor);
  await run(process.execPath, ['scripts/check-unity-presentation.mjs']);
  await run(process.execPath, ['scripts/check-wasm.mjs']);
  await run(process.execPath, [
    esbuild,
    'scripts/export-unity-assets.tsx',
    '--bundle',
    '--platform=node',
    '--format=cjs',
    '--packages=external',
    '--jsx=automatic',
    '--outfile=.openai/export-unity-assets.cjs',
  ]);
  await run(process.execPath, ['.openai/export-unity-assets.cjs']);
  if (process.platform === 'darwin' || process.platform === 'win32') {
    const cargo =
      process.env.CARGO ??
      join(
        process.env.CARGO_HOME ?? join(homedir(), '.cargo'),
        'bin',
        process.platform === 'win32' ? 'cargo.exe' : 'cargo',
      );
    await run(cargo, [
      'build',
      '--locked',
      '--release',
      '--manifest-path',
      'rust/azarashi-engine/Cargo.toml',
    ]);
    const platform = process.platform === 'win32' ? 'Windows' : 'macOS';
    const library =
      process.platform === 'win32' ? 'azarashi_engine.dll' : 'libazarashi_engine.dylib';
    await mkdir(join(root, 'unity/Assets/Plugins', platform), { recursive: true });
    await cp(
      join(root, 'rust/azarashi-engine/target/release', library),
      join(root, 'unity/Assets/Plugins', platform, library),
    );
  }
  await mkdir(dirname(log), { recursive: true });
  // unityroom accepts the build payloads, rather than our surrounding HTML
  // and notice files. Include their licenses inside the Unity data payload too.
  const notices = await Promise.all([
    'unity/Assets/Shaders/THIRD_PARTY.txt',
    'unity/Assets/Resources/Native/FontLicense.txt',
    'node_modules/lucide-react/LICENSE',
  ].map(async path => `${path}\n\n${await readFile(join(root, path), 'utf8')}`));
  await writeFile(join(root, 'unity/Assets/Resources/Native/DistributionNotices.txt'), notices.join('\n\n-----\n\n'));
  console.log(`Building native Unity UI and game (log: ${log})`);
  const buildEditor = await prepareUnityEditor(root, editor, version, run);
  await run(
    buildEditor,
    [
      '-batchmode',
      '-quit',
      '-nographics',
      '-projectPath',
      join(root, 'unity'),
      '-buildTarget',
      'WebGL',
      '-executeMethod',
      'Azarashi.UnityView.Editor.WebBuild.Build',
      '-logFile',
      log,
    ],
    { AZARASHI_UNITY_OUTPUT: output, AZARASHI_UNITYROOM: unityroom ? '1' : '0' },
  );
}
if (!process.argv.includes('--reuse')) {
  await run(process.execPath, [
    esbuild,
    'scripts/validate-unity-record.ts',
    '--bundle',
    '--platform=node',
    '--format=esm',
    '--packages=external',
    '--outfile=.openai/validate-unity-record.mjs',
  ]);
  await run(process.execPath, ['.openai/validate-unity-record.mjs']);
}
const files = await readdir(join(output, 'Build'));
for (const suffix of unityroom ? ['.data.gz', '.framework.js.gz', '.loader.js', '.wasm.gz'] : ['.data', '.framework.js', '.loader.js', '.wasm'])
  if (!files.some((file) => file.endsWith(suffix)))
    throw new Error(`Missing Unity artifact ${suffix}`);
const destination = join(root, unityroom ? 'dist-unityroom' : 'dist-unity');
await rm(destination, { recursive: true, force: true });
await cp(output, destination, { recursive: true });
await cp(join(root, 'unity/Assets/Shaders/THIRD_PARTY.txt'), join(destination, 'THIRD_PARTY.txt'));
await cp(
  join(root, 'unity/Assets/Resources/Native/FontLicense.txt'),
  join(destination, 'FONT-LICENSE.txt'),
);
await cp(join(root, 'node_modules/lucide-react/LICENSE'), join(destination, 'ICON-LICENSE.txt'));
const html = await readFile(join(destination, 'index.html'), 'utf8');
if (html.includes('assets/index-') || html.includes('id="root"'))
  throw new Error('The native Unity build must not contain the React UI host.');
await writeFile(
  join(destination, 'unity-build.json'),
  JSON.stringify(
    {
      renderer: 'Unity',
      ui: 'UI Toolkit',
      engine: 'original Rust WASM',
      target: unityroom ? 'unityroom' : 'local-preview',
      compression: unityroom ? 'gzip' : 'disabled',
      builtAt: new Date().toISOString(),
    },
    null,
    2,
  ),
);
if (unityroom) {
  await prepareUnityroomPackage();
  await writeFile(join(destination, 'UPLOAD.txt'), [
    'unityroom upload files (Unity 6000.5.8f1, Release, Gzip, Decompression Fallback OFF)',
    ...files.filter(file => /\.(loader\.js|data\.gz|framework\.js\.gz|wasm\.gz)$/.test(file)).map(file => `Build/${file}`),
    '',
    'In unityroom Web build upload, select the Build folder containing these four files.',
    'The surrounding index.html is only for local verification; unityroom supplies its own player page.',
    'Third-party license notices are included in the data payload and the accompanying notice files.',
    'Official instructions: https://help.unityroom.com/',
  ].join('\n'));
}
console.log(`Native Unity build ready: ${unityroom ? 'dist-unityroom' : 'dist-unity'}/ (no React runtime UI)`);
