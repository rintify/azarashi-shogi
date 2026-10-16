import { expect, it } from 'vitest';
import { markerCell } from './boardAnchor';
import type { Piece } from '../game/types';
it('puts one large-piece badge on the same visible top-right corner for both players', () => {
  const king: Piece = {
    id: 'king',
    kind: 'walrus',
    owner: 'south',
    promoted: false,
    at: { x: 4, y: 8 },
  };
  expect(markerCell(king, 'south')).toEqual({ x: 5, y: 8 });
  expect(markerCell({ ...king, at: { x: 4, y: 0 } }, 'north')).toEqual({
    x: 4,
    y: 1,
  });
  const orca: Piece = { ...king, kind: 'orca', at: { x: 4, y: 4 } };
  expect(markerCell(orca, 'south')).toEqual({ x: 4, y: 4 });
  expect(markerCell(orca, 'north')).toEqual({ x: 4, y: 5 });
  expect(markerCell({ ...orca, promoted: true }, 'south')).toEqual({ x: 5, y: 4 });
  expect(markerCell({ ...orca, promoted: true }, 'north')).toEqual({ x: 4, y: 4 });
});
