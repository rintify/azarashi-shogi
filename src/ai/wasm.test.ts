import { readFile } from 'node:fs/promises';
import { beforeAll, describe, expect, it } from 'vitest';
import {
  actionKey,
  applyAction,
  applyPreview,
  createGame,
  legalPreviews,
  previewAction,
} from '../game/engine';
import { positionIdentity } from '../game/position';
import { KINDS } from '../game/pieces';
import type { GameState, Kind, Piece, Player } from '../game/types';
import { LEVELS } from './levels';
import { evaluatePosition } from './reference/evaluation';
import { searchBestAction } from './reference/search';
import { seededValue } from '../shared/random';
import { instantiateEngine } from './wasmClient';

let module: WebAssembly.Module;
beforeAll(async () => {
  const bytes = await readFile(new URL('./wasm/azarashi_engine.wasm', import.meta.url));
  module = await WebAssembly.compile(Uint8Array.from(bytes).buffer);
});
const p = (
  id: string,
  kind: Kind,
  x: number,
  y: number,
  owner: Player = 'south',
  promoted = false,
): Piece => ({ id, kind, at: { x, y }, owner, promoted });
const board = (...pieces: Piece[]): GameState => ({
  ...createGame(),
  pieces,
  stocks: {
    south: { seal: 0, penguin: 0, bear: 0, orca: 0, walrus: 0 },
    north: { seal: 0, penguin: 0, bear: 0, orca: 0, walrus: 0 },
  },
});

async function assertRules(state: GameState) {
  const engine = await instantiateEngine(module);
  const inspected = engine.inspect(state);
  const expected = legalPreviews(state);
  expect(inspected.rulesVersion).toBe(state.rulesVersion);
  expect(inspected.positionIdentity).toBe(positionIdentity(state));
  expect(inspected.moves.map((move) => actionKey(move.action)).sort()).toEqual(
    expected.map((move) => actionKey(move.action)).sort(),
  );
  const byKey = new Map(expected.map((move) => [actionKey(move.action), move]));
  for (const actual of inspected.moves) {
    const preview = byKey.get(actionKey(actual.action))!;
    const { after, ...body } = actual;
    expect(body).toEqual(preview);
    const next = applyPreview(state, preview);
    expect(positionIdentity(after as GameState)).toBe(positionIdentity(next));
    expect(after.result).toEqual(next.result);
    expect(after.revision).toBe(next.revision);
    expect([...after.pieces].sort((a, b) => a.id.localeCompare(b.id))).toEqual(
      [...next.pieces].sort((a, b) => a.id.localeCompare(b.id)),
    );
  }
  const evaluated = evaluatePosition(state, state.turn);
  expect(inspected.evaluation.score).toBeCloseTo(evaluated.score, 8);
  expect(inspected.evaluation.kingInDanger).toBe(evaluated.kingInDanger);
  expect(inspected.evaluation.canWinImmediately).toBe(evaluated.canWinImmediately);
}

describe('compiled Rust/WASM rules against the TypeScript authority', () => {
  it('matches every piece and both orientations, including own captures', async () => {
    for (const owner of ['south', 'north'] as const)
      for (const kind of KINDS)
        for (const promoted of kind === 'seal' || kind === 'penguin' || kind === 'orca'
          ? [false, true]
          : [false]) {
          const kings = [p('own', 'walrus', 0, 8), p('enemy', 'walrus', 8, 0, 'north')].filter(
            (piece) => kind !== 'walrus' || piece.owner !== owner,
          );
          const state = board(
            ...kings,
            p('m', kind, 4, 4, owner, promoted),
            p('food', 'seal', 3, 3, owner),
            p('hunter', 'bear', 6, 4, owner === 'south' ? 'north' : 'south'),
          );
          state.turn = owner;
          await assertRules(state);
        }
  });
  it('matches legal L rotations, retained capture cells, partial contact and both-king draws', async () => {
    for (const state of [
      board(
        p('own', 'walrus', 0, 8),
        p('enemy', 'walrus', 5, 3, 'north'),
        p('orca', 'orca', 3, 6),
        p('food', 'seal', 4, 4),
      ),
      board(p('own', 'walrus', 2, 2), p('enemy', 'walrus', 4, 2, 'north'), p('orca', 'orca', 3, 5)),
      board(
        p('own', 'walrus', 0, 8),
        p('enemy', 'walrus', 8, 0, 'north'),
        p('orca', 'orca', 0, 0),
        p('food', 'seal', 1, 2, 'north'),
      ),
      board(
        p('own', 'walrus', 0, 8),
        p('enemy', 'walrus', 8, 0, 'north'),
        p('jet', 'penguin', 4, 7, 'south', true),
        p('blocker', 'seal', 4, 4),
        p('behind', 'seal', 4, 2, 'north'),
      ),
    ])
      await assertRules(state);
  });
  it('matches all legal previews and their resulting states through seeded games', async () => {
    for (const seed of [25, 7001, 8981]) {
      let state = createGame();
      for (let ply = 0; ply < 20 && !state.result; ply++) {
        await assertRules(state);
        const moves = legalPreviews(state);
        const chosen = moves.reduce((best, move) =>
          seededValue(actionKey(move.action), seed + ply) >
          seededValue(actionKey(best.action), seed + ply)
            ? move
            : best,
        );
        state = applyPreview(state, chosen);
      }
    }
  }, 15000);
});

describe('Rust/WASM search in the real compiled module', () => {
  it('matches reference scores at a fixed horizon for both sides', async () => {
    const original = LEVELS[6];
    LEVELS[6] = { ...original, maxDepth: 2, tacticalDepth: 0 };
    try {
      const engine = await instantiateEngine(module, { now: () => 0 });
      for (const turn of ['south', 'north'] as const) {
        const state = {
          ...board(
            p('own', 'walrus', 0, 8),
            p('enemy', 'walrus', 8, 0, 'north'),
            p('m', 'seal', 3, 6),
            p('n', 'seal', 6, 3, 'north'),
          ),
          turn,
        };
        const reference = searchBestAction(state, { difficulty: 6, seed: 12, now: () => 0 });
        const result = engine.search(state, 6, { seed: 12, maxDepth: 2, tacticalDepth: 0 });
        expect(result.depth).toBe(2);
        expect(result.score).toBeCloseTo(reference.score, 8);
        expect(previewAction(state, result.action!)).not.toBeNull();
      }
    } finally {
      LEVELS[6] = original;
    }
  });
  it.each([1, 2, 3, 4, 5, 6] as const)(
    'finds a winning L capture at level %i',
    async (difficulty) => {
      const state = board(
        p('own', 'walrus', 0, 8),
        p('enemy', 'walrus', 5, 3, 'north'),
        p('orca', 'orca', 3, 6),
        p('food', 'seal', 4, 4),
      );
      const engine = await instantiateEngine(module);
      const result = engine.search(state, difficulty);
      expect(result.action?.type === 'move' && result.action.transformation?.type).toBe('rotate');
      expect(applyAction(state, result.action!).result?.winner).toBe('south');
    },
  );
  it('retains royal safety even when every safe destination has appeared repeatedly', async () => {
    const state = board(p('own', 'walrus', 4, 6), p('enemy', 'walrus', 4, 2, 'north'));
    const safe = (next: GameState) =>
      !legalPreviews(next).some((reply) => applyPreview(next, reply).result?.winner === 'north');
    const saved = legalPreviews(state)
      .map((move) => applyPreview(state, move))
      .filter(safe)
      .map(positionIdentity);
    const engine = await instantiateEngine(module, { now: () => 0 });
    const result = engine.search(state, 1, {
      positionHistory: Array.from({ length: 20 }, () => saved).flat(),
      seed: 12,
    });
    expect(safe(applyAction(state, result.action!))).toBe(true);
  });
  it('avoids a played four-ply loop', async () => {
    const engine = await instantiateEngine(module, { now: () => 0 });
    let state = board(p('own', 'walrus', 0, 8), p('enemy', 'walrus', 8, 0, 'north'));
    const repeating = engine.search(state, 1, { seed: 12 }).action!;
    const positions = [positionIdentity(state)];
    const cycle = [
      repeating,
      { type: 'move', pieceId: 'enemy', to: { x: 6, y: 2 } },
      { type: 'move', pieceId: 'own', to: { x: 0, y: 8 } },
      { type: 'move', pieceId: 'enemy', to: { x: 8, y: 0 } },
    ] as const;
    for (let loop = 0; loop < 4; loop++)
      for (const action of cycle) {
        state = applyAction(state, action);
        positions.push(positionIdentity(state));
      }
    const result = engine.search(state, 1, { seed: 12, positionHistory: positions });
    expect(positions).not.toContain(positionIdentity(applyAction(state, result.action!)));
  });
  it('reports progress, returns legal results on deadlines and reuses the same instance safely', async () => {
    const progress: number[] = [];
    const engine = await instantiateEngine(module, { onProgress: (p) => progress.push(p.depth) });
    const result = engine.search(createGame(), 6, { budgetMs: 60, maxNodes: 20000 });
    expect(result.elapsedMs).toBeLessThan(500);
    expect(result.timedOut).toBe(true);
    expect(result.action && previewAction(createGame(), result.action)).not.toBeNull();
    const completed = engine.search(createGame(), 1, { budgetMs: 1000 });
    expect(completed.depth).toBe(1);
    expect(progress).toContain(1);
    for (let index = 0; index < 100; index++) {
      const fallback = engine.search(createGame(), 6, { budgetMs: 0, seed: index });
      expect(fallback.timedOut).toBe(true);
      expect(previewAction(createGame(), fallback.action!)).not.toBeNull();
    }
    expect(engine.inspect(createGame()).moves.length).toBe(legalPreviews(createGame()).length);
  });
  it('rejects mismatched rules and malformed profiles instead of returning a fabricated move', async () => {
    const engine = await instantiateEngine(module);
    expect(() => engine.search({ ...createGame(), rulesVersion: 999 as 2 }, 6)).toThrow(/version/);
    expect(() => engine.search(createGame(), 6, { maxDepth: 0 })).toThrow(/profile/);
  });
});

it('reuses evaluated subtrees without changing a completed fixed-horizon score', async () => {
  const engine = await instantiateEngine(module, { now: () => 0 });
  const state = board(
    p('own', 'walrus', 0, 8),
    p('enemy', 'walrus', 8, 0, 'north'),
    p('s', 'seal', 3, 6),
  );
  const options = { seed: 12, maxDepth: 3, tacticalDepth: 0 };
  const cold = engine.search(state, 6, options);
  const warm = engine.search(state, 6, options);
  expect(warm.depth).toBe(cold.depth);
  expect(warm.score).toBeCloseTo(cold.score, 8);
  expect(warm.nodes).toBeLessThan(cold.nodes);
  expect(previewAction(state, warm.action!)).not.toBeNull();
  console.info('Persistent cache: cold/warm nodes', cold.nodes, warm.nodes);
});

it('isolates retained scores by side and evaluation profile and reapplies current repetition costs', async () => {
  const engine = await instantiateEngine(module, { now: () => 0 });
  const state = board(p('own', 'walrus', 0, 8), p('enemy', 'walrus', 8, 0, 'north'));
  for (const turn of ['south', 'north', 'south'] as const) {
    for (const difficulty of [6, 3, 6] as const) {
      const position = { ...state, turn };
      const options = { seed: 73, maxDepth: 2 };
      const cold = await instantiateEngine(module, { now: () => 0 });
      const expected = cold.search(position, difficulty, options);
      const actual = engine.search(position, difficulty, options);
      expect(actual.score).toBeCloseTo(expected.score, 8);
      expect(actual.depth).toBe(expected.depth);
    }
  }
  const first = engine.search(state, 1, { seed: 12 }).action!;
  const repeated = positionIdentity(applyAction(state, first));
  const freshHistory = Array(20).fill(repeated);
  const actual = engine.search(state, 1, { seed: 12, positionHistory: freshHistory });
  expect(positionIdentity(applyAction(state, actual.action!))).not.toBe(repeated);
});

it('reuses caches across actual turns, captures and compacted piece slots without changing fixed-depth scores', async () => {
  const engine = await instantiateEngine(module, { now: () => 0 });
  let state = board(
    p('own', 'walrus', 0, 8),
    p('enemy', 'walrus', 8, 0, 'north'),
    p('s', 'seal', 4, 5),
    p('n', 'seal', 4, 4, 'north'),
  );
  for (let turn = 0; turn < 6 && !state.result; turn++) {
    const options = { maxDepth: 2, tacticalDepth: 0, seed: 41 };
    const fresh = await instantiateEngine(module, { now: () => 0 });
    const expected = fresh.search(state, 6, options);
    const actual = engine.search(state, 6, options);
    expect(actual.score).toBeCloseTo(expected.score, 8);
    expect(actual.depth).toBe(expected.depth);
    state = applyAction(state, actual.action!);
  }
});
