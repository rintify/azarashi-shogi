import { describe, expect, it } from 'vitest';
import { applyAction, createGame, moveOptions } from '../game/engine';
import type { GameState, Piece } from '../game/types';
import {
  captureProgress,
  center,
  createMotion,
  facing,
  HOVER_HEIGHT,
  IMPACT,
  sampleMotion,
} from './motion';
const orca: Piece = { id: 'o', kind: 'orca', owner: 'south', promoted: false, at: { x: 4, y: 6 } };
const food: Piece = { id: 'f', kind: 'orca', owner: 'north', promoted: false, at: { x: 4, y: 4 } };
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
  it('retains L-shape victims while transforming in the air and consumes them at landing', () => {
    const extra: Piece = { ...food, id: 'extra', at: { x: 3, y: 4 } };
    const start = { ...state, pieces: [orca, food, extra] };
    const option = moveOptions(start, orca, food.at).find((o) => o.captured.length === 2)!;
    const motion = createMotion(start, applyAction(start, option.action), 0)!;
    expect(captureProgress(motion, food, 0.75)).toBe(0);
    expect(captureProgress(motion, food, 0.85)).toBeGreaterThan(0);
    expect(captureProgress(motion, extra, 0.85)).toBe(0);
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

it('waits above the destination untransformed, then transforms in the air and lands', () => {
  const option = moveOptions(state, orca, food.at)[1];
  const after = applyAction(state, option.action);
  const staged = {
    ...createMotion(state, after, 0)!,
    stage: 'choice' as const,
    action: moveOptions(state, orca, food.at)[0],
  };
  const hovering = sampleMotion(staged, 1);
  expect(hovering.position[1]).toBeCloseTo(HOVER_HEIGHT);
  expect(hovering.position[0]).toBeCloseTo(center({ ...orca, at: food.at })[0]);
  expect(hovering.promoted).toBe(false);
  expect(captureProgress(staged, food, 1)).toBe(0);
  const resolving = { ...createMotion(state, after, 0)!, stage: 'resolve' as const };
  expect(sampleMotion(resolving, 0).position).toEqual(hovering.position);
  expect(sampleMotion(resolving, 0.6).promoted).toBe(true);
  expect(sampleMotion(resolving, 0.6).position[1]).toBeCloseTo(HOVER_HEIGHT);
  expect(sampleMotion(resolving, 1).position[1]).toBeCloseTo(0);
});

it('previews each orca footprint in the air and resolves from the preview without snapping', () => {
  const options = moveOptions(state, orca, food.at);
  const flight = {
    ...createMotion(state, applyAction(state, options[0].action), 0)!,
    duration: 620,
    stage: 'choice' as const,
  };
  for (const target of options.slice(1)) {
    const staged = {
      ...flight,
      choicePreview: { target, from: sampleMotion(flight, 1), startedAt: 620 },
    };
    expect(sampleMotion(staged, 0.3, 186)).toEqual(sampleMotion(flight, 0.3));
    const preview = sampleMotion(staged, 1, 900);
    expect(preview.position).toEqual([
      center(target.piece)[0],
      HOVER_HEIGHT,
      center(target.piece)[2],
    ]);
    expect(preview.yaw).toBeCloseTo(facing(target.piece));
    expect(preview.promoted).toBe(true);
    const resolving = {
      ...createMotion(state, applyAction(state, target.action), 900)!,
      stage: 'resolve' as const,
      resolveFrom: preview,
    };
    expect(sampleMotion(resolving, 0).position).toEqual(preview.position);
    expect(sampleMotion(resolving, 0).baseYaw).toBeCloseTo(preview.baseYaw);
    expect(sampleMotion(resolving, 1).position).toEqual(center(target.piece));
    // Keeping the original footprint smoothly rotates back before landing.
    const keeping = {
      ...createMotion(state, applyAction(state, options[0].action), 900)!,
      stage: 'resolve' as const,
      resolveFrom: preview,
    };
    expect(sampleMotion(keeping, 0).position).toEqual(preview.position);
    expect(sampleMotion(keeping, 1).position).toEqual(center(options[0].piece));
    expect(sampleMotion(keeping, 1).baseYaw).toBe(0);
    expect(sampleMotion(keeping, 1).promoted).toBe(false);
  }
});
