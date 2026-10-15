import { describe, expect, it } from 'vitest';
import { createGame, moveOptions, previewAction } from './engine';
import { actionSafety } from './safety';
import type { GameAction, GameState, Kind, Piece, Player } from './types';
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
  pieces: [p('own', 'walrus', 0, 8), p('enemy', 'walrus', 8, 0, 'north'), ...pieces],
});
const safety = (state: GameState, action: GameAction) => {
  const preview = previewAction(state, action);
  expect(preview).not.toBeNull();
  return actionSafety(state, preview!);
};
describe('complete action danger', () => {
  for (const [kind, promoted] of [
    ['seal', false],
    ['seal', true],
    ['penguin', false],
    ['penguin', true],
    ['bear', false],
    ['orca', false],
    ['orca', true],
  ] as const) {
    it(`detects capture of ${kind} ${promoted ? 'transformed' : 'base'} after moving`, () => {
      const mover = p('m', kind, 4, kind === 'bear' ? 6 : 5, 'south', promoted);
      // Jet stops on food at its destination; the enemy bear jumps to the resulting body.
      const state = board(mover, p('food', 'seal', 4, 4), p('hunter', 'bear', 6, 4, 'north'));
      const result = safety(state, { type: 'move', pieceId: 'm', to: { x: 4, y: 4 } });
      expect(result.pieceThreatened).toBe(true);
      expect(result.unsafe).toBe(true);
    });
  }
  it('evaluates new placements, including partial contact with a large body', () => {
    const state = board(p('friend', 'seal', 4, 6), p('hunter', 'bear', 6, 4, 'north'));
    expect(safety(state, { type: 'place', kind: 'orca', at: { x: 4, y: 4 } }).pieceThreatened).toBe(
      true,
    );
    expect(safety(state, { type: 'place', kind: 'seal', at: { x: 3, y: 6 } }).unsafe).toBe(false);
  });
  it('removes a captured attacker before testing danger but keeps other attackers', () => {
    const mover = p('m', 'penguin', 4, 5),
      hunter = p('hunter', 'seal', 4, 4, 'north');
    const state = board(mover, hunter);
    expect(safety(state, { type: 'move', pieceId: 'm', to: { x: 4, y: 4 } }).unsafe).toBe(false);
    expect(
      safety(
        { ...state, pieces: [...state.pieces, p('second', 'bear', 6, 4, 'north')] },
        { type: 'move', pieceId: 'm', to: { x: 4, y: 4 } },
      ).unsafe,
    ).toBe(true);
  });
  it('sees a jet revealed by removing its first blocker', () => {
    const state = board(
      p('m', 'penguin', 4, 5),
      p('blocker', 'seal', 4, 4, 'north'),
      p('jet', 'penguin', 4, 0, 'north', true),
    );
    expect(safety(state, { type: 'move', pieceId: 'm', to: { x: 4, y: 4 } }).pieceThreatened).toBe(
      true,
    );
    expect(
      safety(
        { ...state, pieces: [...state.pieces, p('stop', 'seal', 4, 2, 'north')] },
        { type: 'move', pieceId: 'm', to: { x: 4, y: 4 } },
      ).pieceThreatened,
    ).toBe(false);
  });
  it('checks the king when an otherwise safe move removes its blocker', () => {
    const state = {
      ...board(),
      pieces: [
        p('own', 'walrus', 4, 8),
        p('enemy', 'walrus', 8, 0, 'north'),
        p('jet', 'penguin', 4, 0, 'north', true),
        p('m', 'penguin', 4, 6),
      ],
    };
    const exposed = safety(state, { type: 'move', pieceId: 'm', to: { x: 3, y: 6 } });
    expect(exposed.pieceThreatened).toBe(false);
    expect(exposed.kingThreatened).toBe(true);
    expect(exposed.unsafe).toBe(true);
    const blocking = safety(state, { type: 'move', pieceId: 'm', to: { x: 4, y: 5 } });
    expect(blocking.kingThreatened).toBe(false);
    expect(blocking.pieceThreatened).toBe(true);
  });
  it('ignores unrelated endangered non-royal allies', () => {
    const state = board(
      p('m', 'penguin', 6, 7),
      p('ally', 'seal', 3, 4),
      p('hunter', 'seal', 3, 3, 'north'),
    );
    expect(safety(state, { type: 'move', pieceId: 'm', to: { x: 6, y: 6 } }).unsafe).toBe(false);
  });
  it('reassesses every own orca rotation instead of reusing landing danger', () => {
    const orca = p('m', 'orca', 4, 6);
    const state = board(orca, p('food', 'seal', 4, 4), p('hunter', 'seal', 5, 3, 'north'));
    const options = moveOptions(state, orca, { x: 4, y: 4 });
    expect(actionSafety(state, options[0]).unsafe).toBe(false);
    for (const option of options.slice(1))
      expect(actionSafety(state, option).unsafe).toBe(option.footprint.some((c) => c.x === 5));
    const capture = board(orca, p('food', 'seal', 4, 4), p('hunter', 'penguin', 5, 4, 'north'));
    const escaped = moveOptions(capture, orca, { x: 4, y: 4 }).find((o) =>
      o.captured.some((p) => p.id === 'hunter'),
    )!;
    expect(actionSafety(capture, moveOptions(capture, orca, { x: 4, y: 4 })[0]).unsafe).toBe(true);
    expect(actionSafety(capture, escaped).unsafe).toBe(false);
  });
  it('includes legal enemy L captures and excludes rotations that abandon the captured cell', () => {
    const state = board(
      p('m', 'bear', 6, 7),
      p('orca', 'orca', 4, 6, 'north'),
      p('food', 'seal', 5, 4, 'north'),
    );
    const action = { type: 'move' as const, pieceId: 'm', to: { x: 6, y: 5 } };
    expect(safety(state, action).unsafe).toBe(false);
    expect(
      safety(
        { ...state, pieces: [...state.pieces, p('second-food', 'seal', 5, 5, 'north')] },
        action,
      ).pieceThreatened,
    ).toBe(true);
  });
  it('uses each owner’s forward direction', () => {
    const state = {
      ...createGame(),
      turn: 'north' as const,
      pieces: [
        p('own', 'walrus', 0, 0, 'north'),
        p('enemy', 'walrus', 8, 8),
        p('m', 'penguin', 4, 3, 'north'),
        p('hunter', 'seal', 4, 5),
      ],
    };
    expect(safety(state, { type: 'move', pieceId: 'm', to: { x: 4, y: 4 } }).pieceThreatened).toBe(
      true,
    );
  });
  it('marks immediate own-king loss red, but a win or draw ends reply danger', () => {
    const mover = p('m', 'bear', 4, 4);
    const action = { type: 'move' as const, pieceId: 'm', to: { x: 4, y: 2 } };
    expect(
      safety(
        {
          ...board(mover, p('hunter', 'bear', 6, 2, 'north')),
          pieces: [mover, p('enemy', 'walrus', 4, 1, 'north'), p('hunter', 'bear', 6, 2, 'north')],
        },
        action,
      ).unsafe,
    ).toBe(false);
    expect(
      safety(
        {
          ...board(),
          pieces: [mover, p('own', 'walrus', 4, 1), p('enemy', 'walrus', 8, 0, 'north')],
        },
        action,
      ).losesGame,
    ).toBe(true);
    const draw = {
      ...board(),
      pieces: [p('m', 'orca', 3, 5), p('own', 'walrus', 2, 2), p('enemy', 'walrus', 4, 2, 'north')],
    };
    expect(
      safety(draw, {
        type: 'move',
        pieceId: 'm',
        to: { x: 3, y: 3 },
        transformation: { type: 'rotate', pivot: 0, direction: -1 },
      }).unsafe,
    ).toBe(false);
  });
  it('does not mutate the match during risk analysis', () => {
    const state = board(p('m', 'penguin', 4, 5), p('food', 'seal', 4, 4, 'north'));
    const original = structuredClone(state);
    safety(state, { type: 'move', pieceId: 'm', to: { x: 4, y: 4 } });
    expect(state).toEqual(original);
  });
});
