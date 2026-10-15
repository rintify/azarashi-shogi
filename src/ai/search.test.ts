import { describe, expect, it } from 'vitest';
import { applyAction, createGame, legalPreviews, previewAction } from '../game/engine';
import { searchBestAction, THINKING_MS } from './search';
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
  it('uses the specified five time budgets', () =>
    expect(Object.values(THINKING_MS)).toEqual([100, 300, 1000, 3000, 10000]));
  it('finds an immediate royal capture', () => {
    const state = board(
      p('own', 'walrus', 0, 8),
      p('enemy', 'walrus', 4, 1, 'north'),
      p('bear', 'bear', 4, 4),
    );
    const result = searchBestAction(state, { difficulty: 5 });
    expect(applyAction(state, result.action!).result?.winner).toBe('south');
  });
  it('finds a winning L capture that needs friendly food to enable rotation', () => {
    const state = board(
      p('own', 'walrus', 0, 8),
      p('enemy', 'walrus', 5, 3, 'north'),
      p('orca', 'orca', 3, 6),
      p('food', 'seal', 4, 4),
    );
    const result = searchBestAction(state, { difficulty: 5 });
    expect(result.action?.type === 'move' && result.action.transformation?.type).toBe('rotate');
    expect(applyAction(state, result.action!).result?.winner).toBe('south');
  });
  it('escapes royal danger instead of allowing an immediate loss', () => {
    const state = board(p('own', 'walrus', 4, 6), p('enemy', 'walrus', 4, 2, 'north'));
    const result = searchBestAction(state, { difficulty: 5, budgetMs: 200 });
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
  it('returns a legal fallback on timeout and honors cancellation', () => {
    for (const cancelled of [false, true]) {
      let tick = 0;
      const result = searchBestAction(createGame(), {
        difficulty: 5,
        budgetMs: 8,
        now: () => tick++,
        cancelled: () => cancelled,
      });
      expect(result.timedOut).toBe(true);
      expect(result.action && previewAction(createGame(), result.action)).not.toBeNull();
      expect(result.elapsedMs).toBeLessThanOrEqual(9);
    }
  });
  it('returns no action for a finished match', () => {
    const state = {
      ...createGame(),
      phase: 'finished' as const,
      result: { winner: 'south' as const, reason: 'king-captured' as const },
    };
    expect(searchBestAction(state, { difficulty: 5 }).action).toBeNull();
  });
});
