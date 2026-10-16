import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { delimiter, dirname, join, isAbsolute } from 'node:path';
import { spawnSync } from 'node:child_process';
import { rustRoot, wasmRoot, sha256, sourceHash } from './wasm-source.mjs';

const rustupCargo = join(homedir(), '.cargo', 'bin', 'cargo');
const cargo = process.env.CARGO || (existsSync(rustupCargo) ? rustupCargo : 'cargo');
const nativeTests = process.argv.includes('--test');
const args = nativeTests
  ? ['test', '--locked']
  : ['build', '--locked', '--target', 'wasm32-unknown-unknown', '--release'];
args.push('--target-dir', join(rustRoot, 'target'));
const result = spawnSync(cargo, args, {
  cwd: rustRoot,
  stdio: 'inherit',
  env: {
    ...process.env,
    PATH: isAbsolute(cargo)
      ? `${dirname(cargo)}${delimiter}${process.env.PATH ?? ''}`
      : process.env.PATH,
  },
});
if (result.error)
  console.error(
    `Rustのビルドに失敗しました: ${result.error.message}。READMEのRust開発手順を確認してください。`,
  );
if (result.status !== 0) process.exit(result.status ?? 1);
if (!nativeTests) {
  mkdirSync(wasmRoot, { recursive: true });
  const binary = readFileSync(
    join(rustRoot, 'target', 'wasm32-unknown-unknown', 'release', 'azarashi_engine.wasm'),
  );
  writeFileSync(join(wasmRoot, 'azarashi_engine.wasm'), binary);
  writeFileSync(
    join(wasmRoot, 'build.json'),
    `${JSON.stringify({ sourceHash: sourceHash(), wasmHash: sha256(binary) }, null, 2)}\n`,
  );
  console.log(`WASMを更新しました (${(binary.length / 1024).toFixed(1)} KiB)`);
}
