import { expect, it } from 'vitest';
import { createGame, getThreats, moveCells, moveOptions } from './engine';
import { dimensions } from './pieces';
import { kingRescuers } from './rescue';
import { actionSafety } from './safety';
import type { GameState, Piece } from './types';

const trapped = (): GameState => ({
  ...createGame(),
  pieces: [
    { id: 'king', kind: 'walrus', owner: 'south', promoted: false, at: { x: 0, y: 8 } },
    { id: 'enemy', kind: 'walrus', owner: 'north', promoted: false, at: { x: 8, y: 0 } },
    { id: 'jet1', kind: 'penguin', owner: 'north', promoted: true, at: { x: 1, y: 0 } },
    { id: 'jet2', kind: 'penguin', owner: 'north', promoted: true, at: { x: 2, y: 0 } },
    { id: 'helper', kind: 'orca', owner: 'south', promoted: true, at: { x: 3, y: 7 } },
    { id: 'other', kind: 'seal', owner: 'south', promoted: false, at: { x: 8, y: 7 } },
  ],
});
it('marks a piece that can shield a trapped king, even if the shield itself can be captured', () => {
  const state = trapped(),
    king = state.pieces[0];
  expect(getThreats(state, 'south').some((threat) => threat.targetId === king.id)).toBe(true);
  expect(
    moveCells(state, king).every((at) =>
      moveOptions(state, king, at).every((preview) => actionSafety(state, preview).kingThreatened),
    ),
  ).toBe(true);
  const shield = moveOptions(state, state.pieces[4], { x: 1, y: 7 })[0];
  expect(actionSafety(state, shield).pieceThreatened).toBe(true);
  expect(actionSafety(state, shield).kingThreatened).toBe(false);
  expect(kingRescuers(state, 'south')).toEqual(['helper']);
});
it('does not mark rescuers if the king can escape or is already safe', () => {
  const state = trapped();
  state.pieces = state.pieces.filter((piece) => piece.id !== 'jet2');
  expect(kingRescuers(state, 'south')).toEqual([]);
  state.pieces = state.pieces.filter((piece) => piece.id !== 'jet1');
  expect(kingRescuers(state, 'south')).toEqual([]);
});
it('handles north-facing rescues and suppresses inactive or finished sides', () => {
  const state = trapped();
  const mirrored: GameState = {
    ...state,
    turn: 'north',
    pieces: state.pieces.map((piece): Piece => {
      const [, height] = dimensions(piece);
      return {
        ...piece,
        owner: piece.owner === 'south' ? 'north' : 'south',
        at: { x: piece.at.x, y: 10 - height - piece.at.y },
      };
    }),
  };
  expect(kingRescuers(mirrored, 'north')).toEqual(['helper']);
  expect(kingRescuers(state, 'north')).toEqual([]);
  expect(kingRescuers({ ...state, phase: 'finished' }, 'south')).toEqual([]);
});
it('does not mark a piece whose moves leave the king exposed', () => {
  const state = trapped();
  state.pieces = state.pieces.filter((piece) => piece.id !== 'helper');
  expect(kingRescuers(state, 'south')).toEqual([]);
});
