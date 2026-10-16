import wasmUrl from './wasm/azarashi_engine.wasm?url';
import { instantiateEngine, type WasmHost } from './wasmClient';

export async function loadEngine(host: WasmHost) {
  const response = await fetch(wasmUrl);
  if (!response.ok) throw new Error(`NPCエンジンを読み込めませんでした (${response.status})`);
  let module: WebAssembly.Module;
  try {
    module = await WebAssembly.compileStreaming(response.clone());
  } catch {
    // Static hosts may serve .wasm as application/octet-stream. Compilation still works.
    module = await WebAssembly.compile(await response.arrayBuffer());
  }
  return instantiateEngine(module, host);
}
