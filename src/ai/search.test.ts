import { describe, expect, it } from 'vitest';
import {
  applyAction,
  applyPreview,
  createGame,
  legalPreviews,
  previewAction,
} from '../game/engine';
import { searchBestAction, THINKING_MS } from './reference/search';
import { LEVELS } from './levels';
import { evaluatePosition } from './reference/evaluation';
import { positionIdentity } from '../game/position';
import type { GameState, Kind, Piece, Player } from '../game/types';
const p = (id: string, kind: Kind, x: number, y: number, owner: Player = 'south'): Piece => ({
  id,
  kind,
  at: { x, y },
  owner,
  promoted: false,
});
const board = (...pieces: Piece[]): GameState => ({
  ...createGame(),
  phase: 'playing',
  pieces,
  stocks: {
    south: { seal: 0, penguin: 0, bear: 0, orca: 0, walrus: 0 },
    north: { seal: 0, penguin: 0, bear: 0, orca: 0, walrus: 0 },
  },
});
describe('fair NPC search', () => {
  it.each([1, 2, 3, 4, 5, 6] as const)(
    'breaks a played four-ply cycle at level %i',
    (difficulty) => {
      const original = LEVELS[difficulty];
      LEVELS[difficulty] = { ...original, maxDepth: 1, tacticalDepth: 0 };
      try {
        const initial = board(p('own', 'walrus', 0, 8), p('enemy', 'walrus', 8, 0, 'north'));
        const repeated = searchBestAction(initial, { difficulty, seed: 12, now: () => 0 }).action!;
        let current = initial;
        const positionHistory = [positionIdentity(current)];
        const cycle = [
          repeated,
          { type: 'move', pieceId: 'enemy', to: { x: 6, y: 2 } },
          { type: 'move', pieceId: 'own', to: { x: 0, y: 8 } },
          { type: 'move', pieceId: 'enemy', to: { x: 8, y: 0 } },
        ] as const;
        for (let loop = 0; loop < 4; loop++)
          for (const action of cycle) {
            current = applyAction(current, action);
            positionHistory.push(positionIdentity(current));
          }
        expect(positionIdentity(current)).toBe(positionIdentity(initial));
        const result = searchBestAction(current, {
          difficulty,
          seed: 12,
          now: () => 0,
          positionHistory,
        });
        const next = applyAction(current, result.action!);
        expect(positionHistory).not.toContain(positionIdentity(next));
        expect(next.phase).toBe('playing');
      } finally {
        LEVELS[difficulty] = original;
      }
    },
  );
  it('does not sacrifice its king just to avoid repetition', () => {
    const state = board(p('own', 'walrus', 4, 6), p('enemy', 'walrus', 4, 2, 'north'));
    const isSafe = (next: GameState) =>
      !legalPreviews(next).some((reply) => applyPreview(next, reply).result?.winner === 'north');
    const safePositions = legalPreviews(state)
      .map((move) => applyPreview(state, move))
      .filter(isSafe);
    expect(safePositions.length).toBeGreaterThan(0);
    expect(safePositions.length).toBeLessThan(legalPreviews(state).length);
    const positionHistory = Array.from({ length: 20 }, () =>
      safePositions.map(positionIdentity),
    ).flat();
    const result = searchBestAction(state, {
      difficulty: 1,
      seed: 12,
      now: () => 0,
      positionHistory,
    });
    expect(isSafe(applyAction(state, result.action!))).toBe(true);
  });
  it('still takes an immediate win even if its resulting board has appeared before', () => {
    const state = board(
      p('own', 'walrus', 0, 8),
      p('enemy', 'walrus', 4, 1, 'north'),
      p('bear', 'bear', 4, 4),
    );
    const wins = legalPreviews(state)
      .map((move) => applyPreview(state, move))
      .filter((next) => next.result?.winner === 'south');
    const positionHistory = Array.from({ length: 20 }, () => wins.map(positionIdentity)).flat();
    const result = searchBestAction(state, { difficulty: 6, positionHistory });
    expect(applyAction(state, result.action!).result?.winner).toBe('south');
  });
  it('varies equivalent openings with the match seed and remains reproducible with an explicit seed', () => {
    const state = createGame();
    const think = (seed: number) =>
      searchBestAction(state, { difficulty: 1, seed, now: () => 0 }).action;
    expect(think(123)).toEqual(think(123));
    expect(
      new Set([1, 2, 3, 4, 5, 6].map((seed) => JSON.stringify(think(seed)))).size,
    ).toBeGreaterThan(1);
    // Highest difficulty has no evaluation noise, but equal-priority timeout fallbacks vary.
    const fallbacks = [1, 2, 3, 4].map(
      (seed) => searchBestAction(state, { difficulty: 5, seed, budgetMs: 0, now: () => 0 }).action,
    );
    expect(new Set(fallbacks.map((a) => JSON.stringify(a))).size).toBeGreaterThan(1);
    expect(fallbacks.every((a) => a && previewAction(state, a))).toBe(true);
  });
  it('adds a thirty-second budget above the existing five levels', () =>
    expect(Object.values(THINKING_MS)).toEqual([100, 300, 1000, 3000, 10000, 30000]));
  it.each([5, 6] as const)('finds an immediate royal capture at level %i', (difficulty) => {
    const state = board(
      p('own', 'walrus', 0, 8),
      p('enemy', 'walrus', 4, 1, 'north'),
      p('bear', 'bear', 4, 4),
    );
    const result = searchBestAction(state, { difficulty });
    expect(applyAction(state, result.action!).result?.winner).toBe('south');
  });
  it.each([5, 6] as const)(
    'finds a winning L capture with friendly food at level %i',
    (difficulty) => {
      const state = board(
        p('own', 'walrus', 0, 8),
        p('enemy', 'walrus', 5, 3, 'north'),
        p('orca', 'orca', 3, 6),
        p('food', 'seal', 4, 4),
      );
      const result = searchBestAction(state, { difficulty });
      expect(result.action?.type === 'move' && result.action.transformation?.type).toBe('rotate');
      expect(applyAction(state, result.action!).result?.winner).toBe('south');
    },
  );
  it.each([5, 6] as const)('escapes royal danger at level %i', (difficulty) => {
    const state = board(p('own', 'walrus', 4, 6), p('enemy', 'walrus', 4, 2, 'north'));
    const result = searchBestAction(state, { difficulty, budgetMs: 200, seed: 19 });
    const next = applyAction(state, result.action!);
    expect(legalPreviews(next).some((m) => m.captured.some((p) => p.id === 'own'))).toBe(false);
  });
  it('searches the first turn with both fixed kings already on the board', () => {
    const state = createGame();
    const result = searchBestAction(state, { difficulty: 2, budgetMs: 30 });
    expect(state.pieces.filter((p) => p.kind === 'walrus')).toHaveLength(2);
    expect(
      result.action && !(result.action.type === 'place' && result.action.kind === 'walrus'),
    ).toBe(true);
    expect(previewAction(state, result.action!)).not.toBeNull();
    expect(state).toEqual(createGame());
  });
  it.each([5, 6] as const)(
    'returns a legal fallback on timeout and cancellation at level %i',
    (difficulty) => {
      for (const cancelled of [false, true]) {
        let tick = 0;
        const result = searchBestAction(createGame(), {
          difficulty,
          budgetMs: 8,
          now: () => tick++,
          cancelled: () => cancelled,
        });
        expect(result.timedOut).toBe(true);
        expect(result.action && previewAction(createGame(), result.action)).not.toBeNull();
        expect(result.elapsedMs).toBeLessThanOrEqual(9);
      }
    },
  );
  it('returns no action for a finished match', () => {
    const state = {
      ...createGame(),
      phase: 'finished' as const,
      result: { winner: 'south' as const, reason: 'king-captured' as const },
    };
    expect(searchBestAction(state, { difficulty: 5 }).action).toBeNull();
  });
  it('matches exhaustive minimax with PVS and cached positions for either side', () => {
    const original = LEVELS[6];
    // Fix the horizon for this comparison so the independent oracle can examine every move.
    LEVELS[6] = { ...original, maxDepth: 3, tacticalDepth: 0 };
    try {
      for (const root of ['south', 'north'] as const) {
        const state = {
          ...board(p('own', 'walrus', 0, 8), p('enemy', 'walrus', 8, 0, 'north')),
          turn: root,
        };
        const leafScores = new Map<string, number>();
        const exhaustive = (position: GameState, depth: number, ply: number): number => {
          if (position.result)
            return position.result.winner === null
              ? 0
              : position.result.winner === root
                ? 1000000 - ply
                : -1000000 + ply;
          if (!depth) {
            const key = `${ply}/${positionIdentity(position)}`;
            const cached = leafScores.get(key);
            if (cached !== undefined) return cached;
            const assessment = evaluatePosition(position, root);
            const score = assessment.canWinImmediately
              ? position.turn === root
                ? 1000000 - ply - 1
                : -1000000 + ply + 1
              : assessment.score;
            leafScores.set(key, score);
            return score;
          }
          const scores = legalPreviews(position).map((move) =>
            exhaustive(applyPreview(position, move), depth - 1, ply + 1),
          );
          return position.turn === root ? Math.max(...scores) : Math.min(...scores);
        };
        const expected = exhaustive(state, 3, 0);
        const result = searchBestAction(state, { difficulty: 6, seed: 93, now: () => 0 });
        expect(result.depth).toBe(3);
        expect(result.score).toBeCloseTo(expected, 8);
        expect(exhaustive(applyAction(state, result.action!), 2, 1)).toBeCloseTo(expected, 8);
      }
    } finally {
      LEVELS[6] = original;
    }
  });
});
