import { DEFINITIONS, KINDS } from '../game/pieces';
import { RULES_VERSION, type ActionPreview, type GameState } from '../game/types';
import { LEVELS, type Difficulty } from './levels';
import type { SearchProgress, SearchResult } from './searchTypes';

interface EngineExports {
  memory: WebAssembly.Memory;
  engine_alloc(length: number): number;
  engine_free(pointer: number, length: number): void;
  engine_search(pointer: number, length: number): bigint;
  engine_inspect(pointer: number, length: number): bigint;
  engine_rules_version(): number;
}
export interface WasmHost {
  now?: () => number;
  onProgress?: (progress: SearchProgress) => void;
}
export interface WasmSearchOptions {
  seed?: number;
  positionHistory?: readonly string[];
  budgetMs?: number;
  /** Bounded horizons and node limits support reproducible engine comparisons. */
  maxDepth?: number;
  tacticalDepth?: number;
  maxNodes?: number;
}
export interface EngineInspection {
  rulesVersion: number;
  positionIdentity: string;
  evaluation: { score: number; kingInDanger: boolean; canWinImmediately: boolean };
  moves: (ActionPreview & { after: Omit<GameState, 'lastAction'> })[];
}

/** Small, owned-buffer ABI. No per-node calls or JS rule evaluation occur during search. */
export async function instantiateEngine(
  module: BufferSource | WebAssembly.Module,
  host: WasmHost = {},
) {
  const imports = {
    env: {
      clock_now: host.now ?? (() => performance.now()),
      search_progress: (depth: number, nodes: number, elapsedMs: number) => {
        host.onProgress?.({ depth, nodes, elapsedMs });
      },
    },
  };
  const instance =
    module instanceof WebAssembly.Module
      ? await WebAssembly.instantiate(module, imports)
      : (await WebAssembly.instantiate(module, imports)).instance;
  const engine = instance.exports as unknown as EngineExports;
  if (
    !(engine.memory instanceof WebAssembly.Memory) ||
    typeof engine.engine_rules_version !== 'function' ||
    engine.engine_rules_version() !== RULES_VERSION
  ) {
    throw new Error(
      'NPCエンジンと対局ルールのバージョンが一致しません。ページを更新してください。',
    );
  }
  const encoder = new TextEncoder();
  const decoder = new TextDecoder();
  function call<T>(method: 'engine_search' | 'engine_inspect', payload: unknown): T {
    const bytes = encoder.encode(JSON.stringify(payload));
    const pointer = engine.engine_alloc(bytes.length) >>> 0;
    try {
      new Uint8Array(engine.memory.buffer, pointer, bytes.length).set(bytes);
      const result = engine[method](pointer, bytes.length);
      const outputPointer = Number(result >> 32n) >>> 0;
      const outputLength = Number(result & 0xffffffffn);
      try {
        // Search can grow WASM memory, invalidating earlier ArrayBuffer views.
        const text = decoder.decode(
          new Uint8Array(engine.memory.buffer, outputPointer, outputLength),
        );
        const parsed = JSON.parse(text);
        if (parsed && typeof parsed.error === 'string') throw new Error(parsed.error);
        return parsed as T;
      } finally {
        engine.engine_free(outputPointer, outputLength);
      }
    } finally {
      engine.engine_free(pointer, bytes.length);
    }
  }
  function request(state: GameState, difficulty: Difficulty, options: WasmSearchOptions) {
    const config = LEVELS[difficulty];
    return {
      state,
      seed: options.seed ?? 0,
      positionHistory: options.positionHistory ?? [],
      profile: {
        budgetMs: options.budgetMs ?? config.thinkingMs,
        maxDepth: options.maxDepth ?? config.maxDepth,
        tacticalDepth: options.tacticalDepth ?? config.tacticalDepth,
        advanced: config.advanced,
        noise: config.noise,
        values: KINDS.map((kind) => DEFINITIONS[kind].value),
        maxNodes: options.maxNodes,
      },
    };
  }
  return {
    search: (state: GameState, difficulty: Difficulty, options: WasmSearchOptions = {}) =>
      call<SearchResult>('engine_search', request(state, difficulty, options)),
    inspect: (state: GameState, difficulty: Difficulty = 6) =>
      call<EngineInspection>('engine_inspect', request(state, difficulty, {})),
  };
}
