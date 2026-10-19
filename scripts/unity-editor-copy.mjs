import { createHash } from 'node:crypto';
import { copyFile, link, mkdir, readFile, readdir, symlink, writeFile } from 'node:fs/promises';
import { dirname, join, relative, resolve, sep } from 'node:path';

// UUM-151098 is unfixed in 6000.5. Keep the installed editor intact: only the
// player module in this project's private build-editor copy is rewritten.
export async function prepareUnityEditor(root, editor, version, run) {
  if (version !== '6000.5.8f1') return editor;
  const windows = process.platform === 'win32';
  const bundle = process.platform === 'darwin';
  const source = bundle ? resolve(dirname(editor), '..') : dirname(editor);
  const contents = bundle ? '.' : 'Data';
  const moduleRelative = join(
    contents,
    'PlaybackEngines/WebGLSupport/Managed/UnityEngine.UIElementsModule.dll',
  );
  const original = join(source, moduleRelative);
  const originalHash = createHash('sha256')
    .update(await readFile(original))
    .digest('hex');
  const destination = join(
    root,
    '.openai/tooling/unity-build-editor',
    version,
    bundle ? 'Unity.app/Contents' : 'Editor',
  );
  const module = join(destination, moduleRelative);
  const targetEditor = join(destination, relative(source, editor));
  const manifest = join(destination, 'azarashi-staging-patch.json');
  const patchVersion = 1;
  const patchHash = createHash('sha256')
    .update(
      (await readFile(join(root, 'unity/Assets/Editor/UirStagingPatch.cs'), 'utf8')).replaceAll(
        '\r\n',
        '\n',
      ),
    )
    .digest('hex');
  try {
    const state = JSON.parse(await readFile(manifest, 'utf8'));
    const patchedHash = createHash('sha256')
      .update(await readFile(module))
      .digest('hex');
    if (
      state.originalHash === originalHash &&
      state.patchVersion === patchVersion &&
      state.patchHash === patchHash &&
      state.patchedHash === patchedHash
    )
      return targetEditor;
  } catch {
    /* Prepare a fresh verified copy below. */
  }
  const privateRoot = resolve(root, '.openai/tooling') + sep;
  if (!resolve(destination).startsWith(privateRoot))
    throw new Error('Build editor must stay inside project tooling.');
  console.log('Preparing a private Unity player-module fix for UUM-151098.');
  // Real directories only on the path to the rewritten DLL. Other directories
  // point to the official installation; executable files are unchanged hard links.
  async function clone(directory) {
    await mkdir(join(destination, directory), { recursive: true });
    for (const entry of await readdir(join(source, directory), { withFileTypes: true })) {
      const path = join(directory, entry.name);
      const from = join(source, path),
        to = join(destination, path);
      if (entry.isDirectory()) {
        if (
          moduleRelative.startsWith(path + sep) ||
          relative(source, editor).startsWith(path + sep)
        )
          await clone(path);
        else {
          try {
            await symlink(from, to, windows ? 'junction' : 'dir');
          } catch (error) {
            if (error.code !== 'EEXIST') throw error;
          }
        }
      } else if (path === moduleRelative) {
        await copyFile(from, to);
      } else {
        try {
          await link(from, to);
        } catch (error) {
          if (error.code === 'EPERM' || error.code === 'EXDEV') await copyFile(from, to);
          else if (error.code !== 'EEXIST') throw error;
        }
      }
    }
  }
  await clone('');
  await run(
    editor,
    [
      '-batchmode',
      '-quit',
      '-nographics',
      '-projectPath',
      join(root, 'unity'),
      '-executeMethod',
      'Azarashi.UnityView.Editor.UirStagingPatch.Prepare',
      '-logFile',
      join(root, 'unity/BuildLogs/staging-patch.log'),
    ],
    { AZARASHI_PLAYER_MODULE_COPY: module },
  );
  if (
    createHash('sha256')
      .update(await readFile(original))
      .digest('hex') !== originalHash
  )
    throw new Error('The installed Unity player module changed unexpectedly.');
  const patchedHash = createHash('sha256')
    .update(await readFile(module))
    .digest('hex');
  if (patchedHash === originalHash) throw new Error('UIR staging correction was not applied.');
  await writeFile(
    manifest,
    JSON.stringify({ patchVersion, patchHash, originalHash, patchedHash, version }, null, 2),
  );
  return targetEditor;
}
