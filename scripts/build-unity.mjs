import { readdir, mkdir, readFile, writeFile, cp, rm, access } from 'node:fs/promises';
import { spawn } from 'node:child_process';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const editor =
  process.env.UNITY_EDITOR ??
  '/Applications/Unity/Hub/Editor/6000.5.8f1/Unity.app/Contents/MacOS/Unity';
const output = join(root, 'unity/Build/WebGL');
const log = join(root, 'unity/BuildLogs/webgl.log');
const run = (command, args, env = {}) =>
  new Promise((accept, reject) => {
    const child = spawn(command, args, {
      cwd: root,
      stdio: 'inherit',
      env: { ...process.env, ...env },
    });
    child.on('error', reject);
    child.on('exit', (code) =>
      code === 0
        ? accept()
        : reject(new Error(`${command} exited with ${code}. Unity log: ${log}`)),
    );
  });

if (!process.argv.includes('--reuse')) {
  await access(editor).catch(() => {
    throw new Error(
      'Unity Editorが見つかりません。UNITY_EDITOR に実行ファイルのパスを設定してください。',
    );
  });
  await mkdir(dirname(log), { recursive: true });
  console.log(`Building Unity renderer (log: ${log})`);
  await run(
    editor,
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
    { AZARASHI_UNITY_OUTPUT: output },
  );
}

const source = join(output, 'Build');
const files = await readdir(source);
const suffix = (end) => {
  const name = files.find((file) => file.endsWith(end));
  if (!name) throw new Error(`Missing Unity build artifact: ${end}`);
  return name;
};
const manifest = {
  loaderUrl: suffix('.loader.js'),
  dataUrl: suffix('.data'),
  frameworkUrl: suffix('.framework.js'),
  codeUrl: suffix('.wasm'),
};
const destination = join(root, 'public/UnityBuild');
await rm(destination, { recursive: true, force: true });
await mkdir(destination, { recursive: true });
for (const file of Object.values(manifest)) await cp(join(source, file), join(destination, file));
await cp(join(root, 'unity/Assets/Shaders/THIRD_PARTY.txt'), join(destination, 'THIRD_PARTY.txt'));
await writeFile(join(destination, 'manifest.json'), JSON.stringify(manifest, null, 2) + '\n');
const pkg = JSON.parse(await readFile(join(root, 'package.json'), 'utf8'));
await run(process.execPath, ['node_modules/typescript/bin/tsc', '-b']);
await run(process.execPath, ['scripts/check-wasm.mjs']);
await run(process.execPath, ['node_modules/vite/bin/vite.js', 'build', '--outDir', 'dist-unity'], {
  VITE_RENDERER: 'unity',
});
console.log(`${pkg.name}: Unity + React + existing Rust WASM ready in dist-unity/`);
