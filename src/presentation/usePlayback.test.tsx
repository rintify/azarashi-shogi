// @vitest-environment jsdom
import { act, cleanup, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { applyAction, createGame } from '../game/engine';
import { usePlayback } from './usePlayback';
beforeEach(() => vi.useFakeTimers());
afterEach(() => {
  cleanup();
  vi.useRealTimers();
});
it('blocks the next turn until the visible action finishes and cancels on restart', () => {
  const initial = createGame();
  const hook = renderHook(({ game }) => usePlayback(game), { initialProps: { game: initial } });
  const placed = applyAction(initial, { type: 'place', kind: 'walrus', at: { x: 4, y: 8 } });
  hook.rerender({ game: placed });
  expect(hook.result.current.busy).toBe(true);
  expect(hook.result.current.settled).toBe(initial);
  act(() => vi.advanceTimersByTime(639));
  expect(hook.result.current.busy).toBe(true);
  act(() => vi.advanceTimersByTime(1));
  expect(hook.result.current.busy).toBe(false);
  const reply = applyAction(placed, { type: 'place', kind: 'walrus', at: { x: 4, y: 0 } });
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
