// @vitest-environment jsdom
import { act, cleanup, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { createGame, moveOptions } from '../game/engine';
import type { Piece } from '../game/types';
import { type MoveMotion, landingMoment } from './motion';
import { useGameAudio } from './useGameAudio';

const parameter = () => ({
  value: 0,
  setValueAtTime: vi.fn(),
  linearRampToValueAtTime: vi.fn(),
  exponentialRampToValueAtTime: vi.fn(),
});
const node = () => ({
  connect: vi.fn(),
  disconnect: vi.fn(),
  start: vi.fn(),
  stop: vi.fn(),
  frequency: parameter(),
  playbackRate: parameter(),
  gain: parameter(),
  Q: parameter(),
  onended: null,
});
class FakeAudioContext {
  static current: FakeAudioContext;
  state = 'running';
  currentTime = 10;
  sampleRate = 1000;
  destination = {};
  sources: ReturnType<typeof node>[] = [];
  createBuffer = () => ({ getChannelData: () => new Float32Array(220) });
  createBufferSource = () => {
    const n = node();
    this.sources.push(n);
    return n;
  };
  createOscillator = node;
  createGain = node;
  createBiquadFilter = node;
  resume = vi.fn(async () => {});
  close = vi.fn(async () => {});
  constructor() {
    FakeAudioContext.current = this;
  }
}
beforeEach(() => {
  vi.stubGlobal('AudioContext', FakeAudioContext);
  vi.stubGlobal('localStorage', { getItem: () => null, setItem: vi.fn() });
});
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});
const capture = (): MoveMotion => {
  const mover: Piece = {
    id: 'p',
    kind: 'penguin',
    owner: 'south',
    promoted: false,
    at: { x: 4, y: 5 },
  };
  const victim: Piece = { ...mover, id: 'v', kind: 'seal', owner: 'north', at: { x: 4, y: 4 } };
  const game = { ...createGame(), pieces: [mover, victim] };
  return {
    before: mover,
    action: moveOptions(game, mover, victim.at)[0],
    duration: 1100,
    startedAt: performance.now(),
    reduced: false,
  };
};
it('schedules a bite at capture impact and cancels pending sounds when replay seeks', () => {
  const hook = renderHook(({ motion }) => useGameAudio(motion), {
    initialProps: { motion: null as MoveMotion | null },
  });
  act(() => hook.result.current.unlock());
  const motion = capture();
  hook.rerender({ motion });
  const ctx = FakeAudioContext.current;
  expect(ctx.sources).toHaveLength(2);
  expect(ctx.sources[0].start.mock.calls[0][0]).toBeCloseTo(10 + landingMoment(motion) * 1.1, 1);
  hook.rerender({ motion: null });
  expect(ctx.sources.every((n) => n.stop.mock.calls.length === 2)).toBe(true);
});
it('never bites during a promotion preview or after cancellation, and respects mute', () => {
  const hook = renderHook(({ motion }) => useGameAudio(motion), {
    initialProps: { motion: null as MoveMotion | null },
  });
  act(() => hook.result.current.unlock());
  const ctx = FakeAudioContext.current,
    motion = capture();
  hook.rerender({ motion: { ...motion, stage: 'choice' } });
  hook.rerender({ motion: { ...motion, stage: 'return' } });
  expect(ctx.sources).toHaveLength(0);
  act(() => hook.result.current.toggle());
  hook.rerender({ motion: { ...motion, startedAt: performance.now() } });
  expect(ctx.sources).toHaveLength(0);
});
it('does not replay an already-past bite when sound is enabled late in a move', () => {
  const hook = renderHook(({ motion }) => useGameAudio(motion), {
    initialProps: { motion: null as MoveMotion | null },
  });
  act(() => hook.result.current.unlock());
  const motion = capture();
  motion.startedAt = performance.now() - 1000;
  hook.rerender({ motion });
  expect(FakeAudioContext.current.sources).toHaveLength(0);
});
