import { createHash } from 'node:crypto';
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

export const rustRoot = fileURLToPath(new URL('../rust/azarashi-engine/', import.meta.url));
export const wasmRoot = fileURLToPath(new URL('../src/ai/wasm/', import.meta.url));
export const sha256 = (data) => createHash('sha256').update(data).digest('hex');
export function sourceHash() {
  const files = ['Cargo.toml', 'Cargo.lock', 'rust-toolchain.toml'];
  const visit = (directory) => {
    for (const entry of readdirSync(join(rustRoot, directory), { withFileTypes: true })) {
      const path = join(directory, entry.name);
      if (entry.isDirectory()) visit(path);
      else if (entry.name.endsWith('.rs')) files.push(path);
    }
  };
  visit('src');
  const hash = createHash('sha256');
  for (const path of files.sort())
    hash
      .update(path)
      .update('\0')
      .update(readFileSync(join(rustRoot, path)))
      .update('\0');
  return hash.digest('hex');
}
