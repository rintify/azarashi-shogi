// @vitest-environment jsdom
import { act, cleanup, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { applyAction, createGame, moveOptions } from '../game/engine';
import { sampleMotion } from './motion';
import { usePlayback } from './usePlayback';
beforeEach(() => vi.useFakeTimers());
afterEach(() => {
  cleanup();
  vi.useRealTimers();
});
it('blocks the next turn until the visible action finishes and cancels on restart', () => {
  const initial = createGame();
  const hook = renderHook(({ game }) => usePlayback(game), { initialProps: { game: initial } });
  const placed = applyAction(initial, { type: 'place', kind: 'seal', at: { x: 4, y: 7 } });
  hook.rerender({ game: placed });
  expect(hook.result.current.busy).toBe(true);
  expect(hook.result.current.settled).toBe(initial);
  act(() => vi.advanceTimersByTime(639));
  expect(hook.result.current.busy).toBe(true);
  act(() => vi.advanceTimersByTime(1));
  expect(hook.result.current.busy).toBe(false);
  const reply = applyAction(placed, { type: 'place', kind: 'seal', at: { x: 4, y: 2 } });
  hook.rerender({ game: reply });
  expect(hook.result.current.motion).not.toBeNull();
  const restarted = createGame();
  hook.rerender({ game: restarted });
  expect(hook.result.current.motion).toBeNull();
  act(() => vi.runAllTimers());
  expect(hook.result.current.settled).toBe(restarted);
});
it('holds the result until the king capture has been shown', () => {
  const initial = {
    ...createGame(),
    phase: 'playing' as const,
    pieces: [
      {
        id: 'b',
        kind: 'bear' as const,
        owner: 'south' as const,
        promoted: false,
        at: { x: 4, y: 4 },
      },
      {
        id: 'k',
        kind: 'walrus' as const,
        owner: 'north' as const,
        promoted: false,
        at: { x: 4, y: 1 },
      },
    ],
  };
  const final = applyAction(initial, { type: 'move', pieceId: 'b', to: { x: 4, y: 2 } });
  const hook = renderHook(({ game }) => usePlayback(game), {
    initialProps: { game: initial as typeof final },
  });
  hook.rerender({ game: final });
  expect(hook.result.current.busy).toBe(true);
  expect(hook.result.current.settled.phase).toBe('playing');
  expect(hook.result.current.motion?.action.captured.map((p) => p.id)).toEqual(['k']);
  act(() => vi.advanceTimersByTime(1100));
  expect(hook.result.current.busy).toBe(false);
  expect(hook.result.current.settled.phase).toBe('finished');
});

it('stages an uncommitted capture, waits for choice, and resolves from the air without replaying the move', () => {
  const before = {
    ...createGame(),
    phase: 'playing' as const,
    pieces: [
      {
        id: 'p',
        kind: 'penguin' as const,
        owner: 'south' as const,
        promoted: false,
        at: { x: 4, y: 5 },
      },
      {
        id: 's',
        kind: 'seal' as const,
        owner: 'north' as const,
        promoted: false,
        at: { x: 4, y: 4 },
      },
    ],
  };
  const choices = moveOptions(before, before.pieces[0], { x: 4, y: 4 });
  const hook = renderHook(({ game }) => usePlayback(game), {
    initialProps: { game: before as ReturnType<typeof createGame> },
  });
  act(() => hook.result.current.presentChoice(choices[0]));
  expect(hook.result.current.motion?.stage).toBe('choice');
  expect(hook.result.current.busy).toBe(true);
  expect(hook.result.current.resolving).toBe(false);
  act(() => vi.advanceTimersByTime(620));
  expect(hook.result.current.choiceReady).toBe(true);
  expect(before.pieces).toHaveLength(2);
  hook.rerender({ game: applyAction(before, choices[1].action) });
  expect(hook.result.current.motion?.stage).toBe('resolve');
  expect(hook.result.current.choiceReady).toBe(false);
  act(() => vi.advanceTimersByTime(1150));
  expect(hook.result.current.busy).toBe(false);
});
it('cancels an airborne choice and discards its arrival timer on restart', () => {
  const before = {
    ...createGame(),
    phase: 'playing' as const,
    pieces: [
      {
        id: 'p',
        kind: 'penguin' as const,
        owner: 'south' as const,
        promoted: false,
        at: { x: 4, y: 5 },
      },
      {
        id: 's',
        kind: 'seal' as const,
        owner: 'north' as const,
        promoted: false,
        at: { x: 4, y: 4 },
      },
    ],
  };
  const preview = moveOptions(before, before.pieces[0], { x: 4, y: 4 })[0];
  const hook = renderHook(({ game }) => usePlayback(game), {
    initialProps: { game: before as ReturnType<typeof createGame> },
  });
  act(() => hook.result.current.presentChoice(preview));
  act(() => hook.result.current.presentChoice(null));
  expect(hook.result.current.motion?.stage).toBe('return');
  expect(hook.result.current.busy).toBe(true);
  expect(hook.result.current.resolving).toBe(true);
  act(() => vi.advanceTimersByTime(500));
  expect(hook.result.current.motion).toBeNull();
  expect(hook.result.current.settled).toBe(before);
  act(() => hook.result.current.presentChoice(preview));
  hook.rerender({ game: createGame() });
  act(() => vi.runAllTimers());
  expect(hook.result.current.motion).toBeNull();
  expect(hook.result.current.choiceReady).toBe(false);
});
it('keeps the arrival deadline while rotating previews and preserves the exact pose on confirmation', () => {
  const before = {
    ...createGame(),
    phase: 'playing' as const,
    pieces: [
      {
        id: 'o',
        kind: 'orca' as const,
        owner: 'south' as const,
        promoted: false,
        at: { x: 4, y: 6 },
      },
      {
        id: 's',
        kind: 'orca' as const,
        owner: 'north' as const,
        promoted: false,
        at: { x: 4, y: 4 },
      },
    ],
  };
  const options = moveOptions(before, before.pieces[0], before.pieces[1].at);
  const hook = renderHook(({ game }) => usePlayback(game), {
    initialProps: { game: before as ReturnType<typeof createGame> },
  });
  act(() => hook.result.current.presentChoice(options[0]));
  act(() => vi.advanceTimersByTime(300));
  act(() => hook.result.current.previewChoice(options[1]));
  act(() => vi.advanceTimersByTime(320));
  expect(hook.result.current.choiceReady).toBe(true);
  act(() => vi.advanceTimersByTime(280));
  act(() => hook.result.current.previewChoice(options[4]));
  expect(hook.result.current.choiceReady).toBe(true);
  act(() => vi.advanceTimersByTime(140));
  const motion = hook.result.current.motion!;
  const now = performance.now();
  const hovering = sampleMotion(motion, 1, now);
  hook.rerender({ game: applyAction(before, options[4].action) });
  expect(hook.result.current.motion!.resolveFrom).toEqual(hovering);
  expect(sampleMotion(hook.result.current.motion!, 0).position).toEqual(hovering.position);
  expect(hook.result.current.settled).toBe(before);
});
