import { describe, expect, it } from 'vitest';
import { actionKey, applyAction, createGame, getThreats, legalPreviews, moveCells, moveOptions, placementCells, previewAction } from './engine';
import { footprint, initialStock } from './pieces';
import type { GameState, Kind, Piece, Player } from './types';
import { decodeRecord, newRecord, replayRecord } from '../match/record';
const p = (id: string, kind: Kind, x: number, y: number, owner: Player = 'south', promoted = false): Piece => ({ id, kind, at: { x, y }, owner, promoted });
function board(...pieces: Piece[]): GameState {
  return { ...createGame(), phase: 'playing', pieces, stocks: { south: { seal: 0, penguin: 0, bear: 0, orca: 0, walrus: 0 }, north: { seal: 0, penguin: 0, bear: 0, orca: 0, walrus: 0 } } };
}
describe('initial placement and deployment', () => {
  it('starts empty with 13 pieces on each side', () => {
    const state = createGame();
    expect(state.pieces).toHaveLength(0);
    expect(Object.values(state.stocks.south).reduce((a,b) => a+b)).toBe(13);
    expect(state.stocks.north).toEqual(initialStock());
    expect(placementCells(state, 'seal')).toEqual([]);
    expect(placementCells(state, 'walrus')).toHaveLength(36);
  });
  it('constrains the entire royal footprint to its own half', () => {
    expect(previewAction(createGame(), { type: 'place', kind: 'walrus', at: { x: 3, y: 4 } })).toBeNull();
    let state = applyAction(createGame(), { type: 'place', kind: 'walrus', at: { x: 4, y: 8 } });
    expect(state.phase).toBe('setup-north');
    expect(placementCells(state, 'walrus').every(c => c.y <= 3)).toBe(true);
    state = applyAction(state, { type: 'place', kind: 'walrus', at: { x: 4, y: 0 } });
    expect(state.phase).toBe('playing'); expect(state.turn).toBe('south');
    expect(state.stocks.south.walrus).toBe(0);
  });
  it('requires friendly edge or corner contact and all cells empty', () => {
    const state = board(p('s', 'seal', 4, 4), p('e', 'seal', 8, 8, 'north'));
    state.stocks.south.orca = 1; state.stocks.south.seal = 1;
    expect(placementCells(state, 'seal')).toContainEqual({ x: 3, y: 3 });
    expect(placementCells(state, 'seal')).not.toContainEqual({ x: 7, y: 7 });
    expect(placementCells(state, 'orca')).not.toContainEqual({ x: 4, y: 3 });
    expect(placementCells(state, 'orca')).not.toContainEqual({ x: 3, y: 9 });
  });
});
describe('movement', () => {
  it('reverses forward with ownership and makes black seals irreversible', () => {
    const seal = p('s', 'seal', 4, 4);
    expect(moveCells(board(seal), seal)).toEqual([{ x: 4, y: 3 }]);
    const north = { ...seal, owner: 'north' as const };
    expect(moveCells(board(north), north)).toEqual([{ x: 4, y: 5 }]);
    const black = { ...seal, promoted: true };
    expect(moveCells(board(black), black)).toHaveLength(8);
    const state = board(black, p('e', 'seal', 4, 3, 'north'));
    expect(moveOptions(state, black, { x: 4, y: 3 })).toHaveLength(1);
  });
  it('walking penguins move to eight neighbors', () => {
    const penguin = p('p', 'penguin', 4, 4);
    expect(moveCells(board(penguin), penguin)).toHaveLength(8);
  });
  it('bears reach all 16 outer cells and ignore the intermediate piece', () => {
    const bear = p('b', 'bear', 4, 4);
    const state = board(bear, p('s', 'seal', 4, 3));
    const moves = moveCells(state, bear);
    expect(moves).toHaveLength(16);
    expect(moves).toContainEqual({ x: 6, y: 3 });
    expect(moves).not.toContainEqual({ x: 5, y: 4 });
    expect(previewAction(state, { type: 'move', pieceId: 'b', to: { x: 4, y: 2 } })?.captured).toHaveLength(0);
  });
  it('jets stop at the first friendly or enemy footprint, or the edge', () => {
    const jet = p('j', 'penguin', 4, 8, 'south', true);
    const state = board(jet, p('s', 'seal', 4, 5), p('e', 'walrus', 3, 1, 'north'));
    expect(moveCells(state, jet)).toEqual([{ x: 4, y: 5 }]);
    expect(moveCells(board(jet), jet)).toEqual([{ x: 4, y: 0 }]);
    expect(moveCells(board({ ...jet, at: { x: 4, y: 0 } }), { ...jet, at: { x: 4, y: 0 } })).toEqual([]);
    const north = p('j', 'penguin', 2, 0, 'north', true);
    expect(moveCells(board(north), north)).toEqual([{ x: 2, y: 9 }]);
  });
  it('large pieces move through the full rectangle and are bounded by their whole body', () => {
    const vertical = p('v', 'orca', 4, 4), horizontal = p('h', 'orca', 4, 4, 'south', true), king = p('k', 'walrus', 4, 4);
    expect(moveCells(board(vertical), vertical)).toHaveLength(14);
    expect(moveCells(board(horizontal), horizontal)).toHaveLength(14);
    expect(moveCells(board(king), king)).toHaveLength(24);
    expect(moveCells(board(king), king)).toContainEqual({ x: 6, y: 5 });
    const edge = { ...king, at: { x: 8, y: 8 } };
    expect(moveCells(board(edge), edge).every(c => c.x <= 8 && c.y <= 8)).toBe(true);
  });
});
describe('capture, transformation, and terminal outcomes', () => {
  it('captures multiple friends and enemies, one stock each, without eating itself', () => {
    const king = p('k', 'walrus', 3, 5);
    const state = board(king, p('f', 'seal', 3, 4), p('e', 'orca', 4, 3, 'north', true));
    const action = { type: 'move' as const, pieceId: 'k', to: { x: 3, y: 3 } };
    expect(previewAction(state, action)?.captured.map(p => p.id).sort()).toEqual(['e', 'f']);
    const next = applyAction(state, action);
    expect(next.pieces).toHaveLength(1); expect(next.stocks.south.seal).toBe(1); expect(next.stocks.south.orca).toBe(1);
    const overlap = applyAction(board(king), { type: 'move', pieceId: 'k', to: { x: 3, y: 4 } });
    expect(overlap.pieces).toHaveLength(1);
  });
  it('requires a landing capture before optional transformation', () => {
    const seal = p('s', 'seal', 4, 4);
    expect(previewAction(board(seal), { type: 'move', pieceId: 's', to: { x: 4, y: 3 }, transformation: { type: 'promote' } })).toBeNull();
    const state = board(seal, p('f', 'seal', 4, 3));
    expect(moveOptions(state, seal, { x: 4, y: 3 })).toHaveLength(2);
    expect(applyAction(state, { type: 'move', pieceId: 's', to: { x: 4, y: 3 }, transformation: { type: 'promote' } }).pieces[0].promoted).toBe(true);
  });
  it('reverses penguins only on capture', () => {
    const jet = p('j', 'penguin', 4, 4, 'south', true);
    const next = applyAction(board(jet, p('e', 'seal', 4, 2, 'north')), { type: 'move', pieceId: 'j', to: { x: 4, y: 2 }, transformation: { type: 'promote' } });
    expect(next.pieces[0].promoted).toBe(false);
  });
  it('offers four pivot/direction choices, each capturing an L of three cells', () => {
    const orca = p('o', 'orca', 4, 6);
    const state = board(orca, p('f', 'seal', 4, 4), p('l', 'seal', 3, 4, 'north'), p('r', 'seal', 5, 5, 'north'));
    const options = moveOptions(state, orca, { x: 4, y: 4 });
    expect(options).toHaveLength(5);
    for (const option of options.slice(1)) { expect(option.captureCells).toHaveLength(3); expect(option.footprint).toHaveLength(2); expect(option.piece.promoted).toBe(true); }
    expect(options.some(o => o.captured.some(c => c.id === 'l'))).toBe(true);
    expect(options.some(o => o.captured.some(c => c.id === 'r'))).toBe(true);
    const horizontal = p('o', 'orca', 4, 6, 'south', true);
    const back = moveOptions(board(horizontal, p('f', 'seal', 4, 4)), horizontal, { x: 4, y: 4 });
    expect(back).toHaveLength(5); expect(back.slice(1).every(o => !o.piece.promoted)).toBe(true);
  });
  it('excludes off-board rotations and rejects rotation without an initial capture', () => {
    const orca = p('o', 'orca', 0, 4);
    const state = board(orca, p('f', 'seal', 0, 2));
    expect(moveOptions(state, orca, { x: 0, y: 2 })).toHaveLength(3);
    expect(previewAction(board(orca, p('e', 'seal', 1, 2)), { type: 'move', pieceId: 'o', to: { x: 0, y: 2 }, transformation: { type: 'rotate', pivot: 0, direction: -1 } })).toBeNull();
  });
  it('resets captured promoted pieces upon deployment', () => {
    const king = p('k', 'walrus', 4, 6);
    let state = applyAction(board(king, p('e', 'seal', 4, 4, 'north', true)), { type: 'move', pieceId: 'k', to: { x: 4, y: 4 } });
    state = { ...state, turn: 'south' };
    const next = applyAction(state, { type: 'place', kind: 'seal', at: { x: 3, y: 3 } });
    expect(next.pieces.at(-1)?.promoted).toBe(false);
  });
  it('wins by eating the enemy king and loses by eating the friendly king', () => {
    const bear = p('b', 'bear', 4, 4);
    for (const owner of ['north', 'south'] as const) {
      const next = applyAction(board(bear, p('k', 'walrus', 4, 1, owner)), { type: 'move', pieceId: 'b', to: { x: 4, y: 2 } });
      expect(next.result?.winner).toBe(owner === 'north' ? 'south' : 'north'); expect(next.phase).toBe('finished');
      expect(legalPreviews(next)).toEqual([]);
    }
  });
  it('resolves both kings captured across landing and rotation as one draw', () => {
    const orca = p('o', 'orca', 3, 5);
    const state = board(orca, p('own', 'walrus', 2, 2), p('enemy', 'walrus', 4, 2, 'north'));
    const next = applyAction(state, { type: 'move', pieceId: 'o', to: { x: 3, y: 3 }, transformation: { type: 'rotate', pivot: 0, direction: -1 } });
    expect(next.result).toEqual({ winner: null, reason: 'both-kings' });
  });
  it('threat detection includes jets and additional rotation captures', () => {
    const orca = p('o', 'orca', 4, 6, 'north');
    const state = board(orca, p('food', 'seal', 4, 4, 'north'), p('target', 'seal', 3, 4), p('jet', 'penguin', 8, 1, 'north', true), p('victim', 'seal', 8, 5));
    expect(getThreats(state, 'south')).toContainEqual({ targetId: 'target', attackerIds: ['o'] });
    expect(getThreats(state, 'south')).toContainEqual({ targetId: 'victim', attackerIds: ['jet'] });
  });
});
describe('state integrity and record replay', () => {
  it('rejects wrong ownership, illegal moves, and stale revisions', () => {
    const state = board(p('e', 'seal', 4, 4, 'north'));
    expect(() => applyAction(state, { type: 'move', pieceId: 'e', to: { x: 4, y: 5 } })).toThrow();
    expect(() => applyAction(createGame(), { type: 'place', kind: 'walrus', at: { x: 0, y: 8 } }, 5)).toThrow('局面');
  });
  it('matches previews, preserves non-royal totals and replay over generated games', () => {
    let state = createGame(); const record = newRecord();
    let seed = 93;
    for (let i = 0; i < 100 && state.phase !== 'finished'; i++) {
      const choices = legalPreviews(state);
      expect(new Set(choices.map(c => actionKey(c.action))).size).toBe(choices.length);
      seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
      const chosen = choices[seed % choices.length];
      const next = applyAction(state, chosen.action);
      expect(next.lastAction).toEqual(chosen);
      const nonRoyals = next.pieces.filter(p => p.kind !== 'walrus').length + Object.values(next.stocks).reduce((sum, s) => sum + s.seal + s.penguin + s.bear + s.orca, 0);
      expect(nonRoyals).toBe(24);
      const cells = next.pieces.flatMap(footprint).map(c => `${c.x},${c.y}`);
      expect(new Set(cells).size).toBe(cells.length);
      record.actions.push(chosen.action); state = next;
    }
    expect(replayRecord(record)).toEqual(state);
    expect(decodeRecord(JSON.stringify(record)).game).toEqual(state);
  });
  it('rejects corrupt saves and incompatible versions', () => {
    expect(() => decodeRecord('{')).toThrow();
    expect(() => decodeRecord(JSON.stringify({ ...newRecord(), version: 2 }))).toThrow();
    expect(() => decodeRecord(JSON.stringify({ ...newRecord(), actions: [{ type: 'place', kind: 'seal', at: { x: 0, y: 0 } }] }))).toThrow();
  });
});
