import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { wasmRoot, sha256, sourceHash } from './wasm-source.mjs';

try {
  const manifest = JSON.parse(readFileSync(join(wasmRoot, 'build.json'), 'utf8'));
  const binary = readFileSync(join(wasmRoot, 'azarashi_engine.wasm'));
  if (manifest.sourceHash !== sourceHash() || manifest.wasmHash !== sha256(binary))
    throw new Error('WASMがRustソースと一致しません');
} catch (error) {
  console.error(
    `${error.message}\n先に npm run wasm:build を実行してください。Rustの導入手順はREADMEにあります。`,
  );
  process.exit(1);
}
