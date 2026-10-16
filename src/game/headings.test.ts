import { expect, it } from 'vitest';
import {
  actionKey,
  applyAction,
  createGame,
  getThreats,
  moveCells,
  moveOptions,
  previewAction,
} from './engine';
import { HEADINGS, HEADING_VECTOR } from './headings';
import type { Piece } from './types';
import { positionKey } from '../ai/search';
import { decodeRecord, newRecord } from '../match/record';

const walker: Piece = {
  id: 'p',
  kind: 'penguin',
  owner: 'south',
  promoted: false,
  at: { x: 4, y: 4 },
};
const meal: Piece = { ...walker, id: 'meal', kind: 'seal', at: { x: 4, y: 3 } };

it('offers four distinct jet headings plus keeping the walking form after a capture', () => {
  const game = { ...createGame(), pieces: [walker, meal] };
  const options = moveOptions(game, walker, meal.at);
  expect(options).toHaveLength(5);
  expect(new Set(options.slice(1).map((p) => p.piece.heading))).toEqual(new Set(HEADINGS));
  expect(new Set(options.map((p) => actionKey(p.action))).size).toBe(5);
  expect(new Set(options.slice(1).map((p) => positionKey(applyAction(game, p.action)))).size).toBe(
    4,
  );
  for (const option of options.slice(1)) {
    const next = applyAction(game, option.action);
    expect(next.pieces[0].heading).toBe(option.piece.heading);
  }
});

it('stops at the first friendly or enemy piece along each heading for either owner', () => {
  for (const owner of ['south', 'north'] as const)
    for (const heading of HEADINGS) {
      const jet: Piece = { ...walker, promoted: true, heading, owner };
      const delta = HEADING_VECTOR[heading];
      for (const blockerOwner of ['south', 'north'] as const) {
        const target = { x: jet.at.x + delta.x * 2, y: jet.at.y + delta.y * 2 };
        const blocker = { ...meal, owner: blockerOwner, at: target };
        expect(moveCells({ ...createGame(), pieces: [jet, blocker] }, jet)).toEqual([target]);
      }
      const edge = {
        x: delta.x === 0 ? jet.at.x : delta.x > 0 ? 9 : 0,
        y: delta.y === 0 ? jet.at.y : delta.y > 0 ? 9 : 0,
      };
      expect(moveCells({ ...createGame(), pieces: [jet] }, jet)).toEqual([edge]);
      expect(
        moveCells({ ...createGame(), pieces: [{ ...jet, at: edge }] }, { ...jet, at: edge }),
      ).toEqual([]);
    }
});

it('uses the chosen heading for threats and clears it when returning to walking form', () => {
  const jet: Piece = { ...walker, promoted: true, heading: 'east' };
  const king: Piece = { ...meal, id: 'king', kind: 'walrus', owner: 'north', at: { x: 7, y: 4 } };
  const game = { ...createGame(), pieces: [jet, king] };
  expect(getThreats(game, 'north').find((t) => t.targetId === king.id)?.attackerIds).toContain(
    jet.id,
  );
  const walking = moveOptions(game, jet, king.at).find((p) => !p.piece.promoted)!;
  expect(walking.piece.heading).toBeUndefined();
  expect(
    previewAction(game, {
      type: 'move',
      pieceId: jet.id,
      to: king.at,
      transformation: { type: 'promote', heading: 'west' },
    }),
  ).toBeNull();
});

it('preserves old forward-only records and round-trips a newly selected heading', () => {
  const record = newRecord();
  const king = createGame().pieces.find((p) => p.owner === 'north')!;
  record.actions = [
    { type: 'place', kind: 'penguin', at: { x: 3, y: 7 } },
    { type: 'move', pieceId: king.id, to: { x: 4, y: 1 } },
    { type: 'place', kind: 'seal', at: { x: 3, y: 6 } },
    { type: 'move', pieceId: king.id, to: { x: 4, y: 0 } },
    { type: 'move', pieceId: 'p0', to: { x: 3, y: 6 }, transformation: { type: 'promote' } },
  ];
  expect(decodeRecord(JSON.stringify(record)).game.pieces.find((p) => p.id === 'p0')?.heading).toBe(
    'north',
  );
  record.actions[4] = {
    type: 'move',
    pieceId: 'p0',
    to: { x: 3, y: 6 },
    transformation: { type: 'promote', heading: 'east' },
  };
  expect(decodeRecord(JSON.stringify(record)).game.pieces.find((p) => p.id === 'p0')?.heading).toBe(
    'east',
  );
});
