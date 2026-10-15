import { describe, expect, it } from 'vitest';
import { applyAction, createGame, moveOptions } from '../game/engine';
import type { GameState, Piece } from '../game/types';
import { captureProgress, center, createMotion, facing, IMPACT, sampleMotion } from './motion';
const orca: Piece = { id: 'o', kind: 'orca', owner: 'south', promoted: false, at: { x: 4, y: 6 } };
const food: Piece = { id: 'f', kind: 'seal', owner: 'north', promoted: false, at: { x: 4, y: 4 } };
const state: GameState = { ...createGame(), phase: 'playing', pieces: [orca, food] };
describe('presentation geometry and timing', () => {
  it('faces both armies toward their forward moves, including horizontal orcas', () => {
    expect(Math.cos(facing(orca))).toBeCloseTo(-1);
    expect(Math.cos(facing({ ...orca, owner: 'north' }))).toBeCloseTo(1);
    expect(Math.sin(facing({ ...orca, promoted: true }))).toBeCloseTo(1);
    expect(Math.sin(facing({ ...orca, promoted: true, owner: 'north' }))).toBeCloseTo(-1);
  });
  it('starts at the previous cell, lands before capture, and retains victims until impact', () => {
    const next = applyAction(state, { type: 'move', pieceId: 'o', to: food.at });
    const motion = createMotion(state, next, 0)!;
    expect(sampleMotion(motion, 0).position).toEqual(center(orca));
    center(next.pieces[0]).forEach((v, i) =>
      expect(sampleMotion(motion, IMPACT).position[i]).toBeCloseTo(v),
    );
    expect(captureProgress(motion, food, IMPACT - 0.01)).toBe(0);
    expect(captureProgress(motion, food, 1)).toBe(1);
  });
  it('rotates around every legal pivot and ends at the exact final footprint', () => {
    for (const option of moveOptions(state, orca, food.at).slice(1)) {
      const next = applyAction(state, option.action),
        motion = createMotion(state, next, 0)!;
      const final = sampleMotion(motion, 1);
      center(option.piece).forEach((v, i) => expect(final.position[i]).toBeCloseTo(v));
      expect(final.promoted).toBe(true);
      expect(final.yaw).toBeCloseTo(facing(option.piece));
    }
  });
  it('keeps extra L-shape victims alive until rotation reaches them', () => {
    const extra: Piece = { ...food, id: 'extra', at: { x: 3, y: 4 } };
    const start = { ...state, pieces: [orca, food, extra] };
    const option = moveOptions(start, orca, food.at).find((o) => o.captured.length === 2)!;
    const motion = createMotion(start, applyAction(start, option.action), 0)!;
    expect(captureProgress(motion, food, 0.75)).toBe(1);
    expect(captureProgress(motion, extra, 0.75)).toBe(0);
    expect(captureProgress(motion, extra, 1)).toBe(1);
  });
  it('skips replay for loaded and reset games, and provides a short reduced-motion mode', () => {
    expect(createMotion(state, createGame(), 0)).toBeNull();
    const after = applyAction(state, { type: 'move', pieceId: 'o', to: food.at });
    const motion = createMotion(state, after, 0, true)!;
    expect(motion.duration).toBe(180);
    expect(sampleMotion(motion, 0.2).position).toEqual(center(after.lastAction!.piece));
  });
});
