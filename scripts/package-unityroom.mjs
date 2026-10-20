import { readFile, readdir, writeFile } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { gunzipSync } from 'node:zlib';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
export async function prepareUnityroomPackage() {
  const output = join(root, 'dist-unityroom');
  const files = await readdir(join(output, 'Build'));
  for (const suffix of ['.loader.js', '.data.gz', '.framework.js.gz', '.wasm.gz']) {
    const matching = files.filter(file => file.endsWith(suffix));
    if (matching.length !== 1) throw new Error(`Expected one unityroom upload file: ${suffix}`);
    const bytes = await readFile(join(output, 'Build', matching[0]));
    const decoded = suffix.endsWith('.gz') ? gunzipSync(bytes) : bytes;
    if (suffix === '.wasm.gz' && !WebAssembly.validate(decoded)) throw new Error('Invalid Unity WebAssembly');
    if (suffix === '.data.gz' && !decoded.subarray(0, 32).toString().startsWith('UnityWebData')) throw new Error('Invalid Unity data archive');
    console.log(`${matching[0]}: ${bytes.length} bytes; verified`);
  }
  const icon = await readFile(join(root, 'public/unityroom-icon.jpg'));
  await writeFile(join(output, 'icon.jpg'), icon);
  console.log('unityroom package verified; 512px walrus listing icon copied to icon.jpg');
}
if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) await prepareUnityroomPackage();
