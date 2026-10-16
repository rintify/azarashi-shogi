import { expect, it } from 'vitest';
import { Vector3 } from 'three';
import { sampleCameraOrbit } from './cameraOrbit';
it('turns around the board at a constant radius instead of cutting over its center', () => {
  const from = new Vector3(0, 20, 10),
    to = new Vector3(0, 20, -10);
  const middle = sampleCameraOrbit(from, to, 0.5);
  expect(middle.x).toBeCloseTo(10);
  expect(middle.y).toBe(20);
  expect(middle.z).toBeCloseTo(0);
  for (const t of [0, 0.1, 0.25, 0.5, 0.75, 0.9, 1]) {
    const position = sampleCameraOrbit(from, to, t);
    expect(Math.hypot(position.x, position.z)).toBeCloseTo(10);
  }
  expect(new Vector3().copy(sampleCameraOrbit(from, to, 0)).distanceTo(from)).toBeCloseTo(0);
  expect(new Vector3().copy(sampleCameraOrbit(from, to, 1)).distanceTo(to)).toBeCloseTo(0);
  expect(from.toArray()).toEqual([0, 20, 10]);
});
it('starts and stops gently and rotates continuously in top view', () => {
  const from = new Vector3(0, 20, 0.01),
    to = new Vector3(0, 20, -0.01);
  const start = sampleCameraOrbit(from, to, 0.01),
    middle = sampleCameraOrbit(from, to, 0.5);
  expect(Math.atan2(start.x, start.z)).toBeLessThan(Math.PI * 0.01);
  expect(middle.x).toBeCloseTo(0.01);
  expect(Math.hypot(middle.x, middle.z)).toBeGreaterThan(0);
});
