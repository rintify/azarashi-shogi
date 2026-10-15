import { describe, expect, it } from 'vitest';
import type { Kind, Piece } from '../game/types';
import { bodyDynamics, travelEnd } from './movement';
import {
  captureMoment,
  captureProgress,
  center,
  landingMoment,
  sampleMotion,
  type MoveMotion,
} from './motion';
function motion(kind: Kind, promoted = false): MoveMotion {
  const before: Piece = { id: 'm', owner: 'south', kind, promoted, at: { x: 4, y: 6 } };
  return {
    before,
    action: {
      action: { type: 'move', pieceId: 'm', to: { x: 4, y: 3 } },
      from: before.at,
      piece: { ...before, at: { x: 4, y: 3 } },
      footprint: [],
      captureCells: [],
      captured: [],
    },
    startedAt: 0,
    duration: 1000,
    reduced: false,
  };
}
describe('animal movement dynamics', () => {
  it('fires the jet only while a jet penguin is traveling, in either army', () => {
    for (const owner of ['south', 'north'] as const) {
      const move = motion('penguin', true);
      move.before!.owner = owner;
      move.action.piece.owner = owner;
      expect(bodyDynamics(move, 0).thrust).toBe(0);
      expect(bodyDynamics(move, 0.2).thrust).toBeGreaterThan(0.8);
      expect(bodyDynamics(move, travelEnd(move)).thrust).toBe(0);
      expect(bodyDynamics({ ...move, stage: 'resolve' }, 0.2).thrust).toBe(0);
      expect(bodyDynamics({ ...move, reduced: true }, 0.2).thrust).toBe(0);
    }
    expect(bodyDynamics(motion('penguin'), 0.2).thrust).toBe(0);
  });
  it('gives the orca a shallow swim and the king a heavier hop, with exact final positions', () => {
    const orca = motion('orca'),
      king = motion('walrus');
    expect(sampleMotion(orca, 0.28).position[1]).toBeCloseTo(0.12);
    expect(sampleMotion(king, 0.28).position[1]).toBeCloseTo(0.55);
    expect(Math.abs(bodyDynamics(orca, 0.14).pitch)).toBeGreaterThan(0);
    for (const move of [orca, king, motion('penguin', true)]) {
      center(move.action.piece).forEach((value, i) =>
        expect(sampleMotion(move, 1).position[i]).toBeCloseTo(value),
      );
      expect(bodyDynamics(move, 1).stretch).toEqual([1, 1, 1]);
    }
    expect(bodyDynamics(king, landingMoment(king) + 0.09).stretch[1]).toBeLessThan(0.85);
  });
  it('keeps staged captures silent until confirmation and shares visual/audio capture timing', () => {
    const move = motion('orca');
    const victim: Piece = {
      id: 'food',
      owner: 'north',
      kind: 'seal',
      promoted: false,
      at: { x: 4, y: 3 },
    };
    const bite = captureMoment(move, victim);
    expect(captureProgress(move, victim, bite - 0.01)).toBe(0);
    expect(captureProgress(move, victim, bite + 0.04)).toBeGreaterThan(0);
    expect(captureMoment({ ...move, stage: 'choice' }, victim)).toBe(Infinity);
    expect(captureMoment({ ...move, stage: 'return' }, victim)).toBe(Infinity);
    expect(captureMoment({ ...move, reduced: true }, victim)).toBe(0);
  });
});
