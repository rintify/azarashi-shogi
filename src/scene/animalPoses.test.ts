import { expect, it } from 'vitest';
import { Vector3 } from 'three';
import { JET_POSE } from './animalPoses';
import { facing } from '../presentation/motion';
it('keeps the jet belly-down with a horizontal body and head ahead for both armies', () => {
  expect(JET_POSE.bodyScale[2]).toBeGreaterThan(JET_POSE.bodyScale[1] * 1.8);
  expect(Math.abs(JET_POSE.head[1] - JET_POSE.body[1])).toBeLessThan(0.1);
  expect(JET_POSE.beak[2]).toBeGreaterThan(JET_POSE.head[2]);
  for (const owner of ['south', 'north'] as const) {
    const yaw = facing({ kind: 'penguin', promoted: true, owner });
    const nose = new Vector3(...JET_POSE.beak)
      .sub(new Vector3(...JET_POSE.body))
      .applyAxisAngle(new Vector3(0, 1, 0), yaw);
    expect(nose.z * (owner === 'south' ? -1 : 1)).toBeGreaterThan(0.5);
    expect(Math.abs(nose.x)).toBeLessThan(0.001);
  }
});
