import { readFile } from 'node:fs/promises';
import { afterAll, beforeAll, bench, describe, expect } from 'vitest';
import { createGame } from '../game/engine';
import { LEVELS } from './levels';
import { searchBestAction } from './reference/search';
import { instantiateEngine } from './wasmClient';

const state = createGame();
const original = LEVELS[6];
let engine: Awaited<ReturnType<typeof instantiateEngine>>;
beforeAll(async () => {
  const bytes = await readFile(new URL('./wasm/azarashi_engine.wasm', import.meta.url));
  engine = await instantiateEngine(Uint8Array.from(bytes).buffer, { now: () => 0 });
  LEVELS[6] = { ...original, maxDepth: 2, tacticalDepth: 0 };
  const reference = searchBestAction(state, { difficulty: 6, seed: 12, now: () => 0 });
  const native = engine.search(state, 6, { seed: 12, maxDepth: 2, tacticalDepth: 0 });
  expect(reference.depth).toBe(2);
  expect(native.depth).toBe(2);
  expect(native.score).toBeCloseTo(reference.score, 8);
  console.info('Benchmark parity', {
    typescript: { depth: reference.depth, nodes: reference.nodes, score: reference.score },
    wasm: { depth: native.depth, nodes: native.nodes, score: native.score },
  });
});
afterAll(() => {
  LEVELS[6] = original;
});

describe('same opening, seed, evaluation and depth 2; no time cutoff', () => {
  bench(
    'TypeScript reference',
    () => {
      searchBestAction(state, { difficulty: 6, seed: 12, now: () => 0 });
    },
    { time: 500, iterations: 5, warmupIterations: 1, warmupTime: 50 },
  );
  bench(
    'Rust / WebAssembly',
    () => {
      engine.search(state, 6, { seed: 12, maxDepth: 2, tacticalDepth: 0 });
    },
    { time: 500, iterations: 5, warmupIterations: 1, warmupTime: 50 },
  );
});
