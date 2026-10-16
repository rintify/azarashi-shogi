import { expect, it } from 'vitest';
import { resultCameraFrame } from './resultCamera';
import type { Piece } from '../game/types';

const attacker: Piece = {
  id: 'winner',
  kind: 'penguin',
  owner: 'south',
  promoted: false,
  at: { x: 0, y: 0 },
};
it('frames the actual attacker with a medium distance and looks toward its face', () => {
  const frame = resultCameraFrame(attacker, 16 / 9);
  expect(frame.target.x).toBe(-4.5);
  expect(frame.target.z).toBe(-4.5);
  expect(frame.position.distanceTo(frame.target)).toBeCloseTo(7.5);
  expect(frame.position.z).toBeLessThan(frame.target.z);
  const north = resultCameraFrame({ ...attacker, owner: 'north' }, 16 / 9);
  expect(north.position.z).toBeGreaterThan(north.target.z);
});
it('gives large pieces and portrait screens more room instead of cropping them', () => {
  const small = resultCameraFrame(attacker, 16 / 9);
  const large = resultCameraFrame({ ...attacker, kind: 'walrus' }, 16 / 9);
  const portrait = resultCameraFrame({ ...attacker, kind: 'walrus' }, 390 / 844);
  expect(large.position.distanceTo(large.target)).toBeGreaterThan(
    small.position.distanceTo(small.target),
  );
  expect(portrait.position.distanceTo(portrait.target)).toBeGreaterThan(
    large.position.distanceTo(large.target),
  );
});
