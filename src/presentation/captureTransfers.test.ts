import { expect, it } from 'vitest';
import { applyAction, createGame } from '../game/engine';
import { createMotion } from './motion';
import { captureTransfers, playbackDuration, transferPoint } from './captureTransfers';

it('transfers captured friends and enemies separately, excluding kings', () => {
  const before = createGame();
  before.pieces.push(
    { id: 'orca', owner: 'south', kind: 'orca', promoted: false, at: { x: 3, y: 5 } },
    { id: 'friend', owner: 'south', kind: 'seal', promoted: true, at: { x: 4, y: 3 } },
    { id: 'enemy', owner: 'north', kind: 'penguin', promoted: true, at: { x: 4, y: 4 } },
  );
  const after = applyAction(before, { type: 'move', pieceId: 'orca', to: { x: 4, y: 3 } });
  const motion = createMotion(before, after, 100)!;
  const flights = captureTransfers(motion);
  expect(flights.map((flight) => flight.victim.id)).toEqual(['friend', 'enemy']);
  expect(flights[1].arriveAt).toBeGreaterThan(flights[0].arriveAt);
  expect(playbackDuration(motion)).toBeGreaterThan(flights[1].arriveAt - motion.startedAt);
  expect(captureTransfers({ ...motion, stage: 'choice' })).toEqual([]);
  expect(captureTransfers({ ...motion, stage: 'return' })).toEqual([]);
  expect(
    captureTransfers({ ...motion, action: { ...motion.action, captured: [before.pieces[0]] } }),
  ).toEqual([]);
});
it('starts and finishes the arc exactly at the source and stock, with a lifted midpoint', () => {
  const from = { x: 200, y: 300 },
    to = { x: 600, y: 650 };
  expect(transferPoint(from, to, 0)).toEqual(from);
  const end = transferPoint(from, to, 1);
  expect(end.x).toBeCloseTo(to.x);
  expect(end.y).toBeCloseTo(to.y);
  expect(transferPoint(from, to, 0.5).y).toBeLessThan((from.y + to.y) / 2);
});
