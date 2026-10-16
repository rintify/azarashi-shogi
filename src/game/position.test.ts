import { expect, it } from 'vitest';
import { createGame } from './engine';
import { positionIdentity } from './position';

it('recognizes identical boards regardless of IDs, array order, revision or last action', () => {
  const state = createGame();
  expect(
    positionIdentity({
      ...state,
      revision: 47,
      pieces: [...state.pieces]
        .reverse()
        .map((piece, index) => ({ ...piece, id: `other-${index}` })),
    }),
  ).toBe(positionIdentity(state));
});
it('distinguishes the side to move, stocks and transformed footprints', () => {
  const state = createGame();
  expect(positionIdentity({ ...state, turn: 'north' })).not.toBe(positionIdentity(state));
  expect(
    positionIdentity({
      ...state,
      stocks: { ...state.stocks, south: { ...state.stocks.south, seal: 5 } },
    }),
  ).not.toBe(positionIdentity(state));
  const withOrca = {
    ...state,
    pieces: [
      ...state.pieces,
      {
        id: 'orca',
        owner: 'south' as const,
        kind: 'orca' as const,
        at: { x: 3, y: 6 },
        promoted: false,
      },
    ],
  };
  expect(
    positionIdentity({
      ...withOrca,
      pieces: withOrca.pieces.map((piece) =>
        piece.id === 'orca' ? { ...piece, promoted: true } : piece,
      ),
    }),
  ).not.toBe(positionIdentity(withOrca));
});
