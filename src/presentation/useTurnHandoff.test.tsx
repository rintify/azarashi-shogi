// @vitest-environment jsdom
import { act, cleanup, renderHook } from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';
import { TURN_ROTATION_MS } from './cameraOrbit';
import { useTurnHandoff } from './useTurnHandoff';
import type { Player } from '../game/types';
afterEach(() => {
  cleanup();
  vi.useRealTimers();
});
it('blocks input only during local camera handoff, and cancels stale timers', () => {
  vi.useFakeTimers();
  const hook = renderHook(({ player, local, reduced }) => useTurnHandoff(player, local, reduced), {
    initialProps: { player: 'south' as Player, local: true, reduced: false },
  });
  expect(hook.result.current).toBe(true);
  hook.rerender({ player: 'north', local: true, reduced: false });
  expect(hook.result.current).toBe(false);
  act(() => vi.advanceTimersByTime(TURN_ROTATION_MS));
  expect(hook.result.current).toBe(true);
  hook.rerender({ player: 'south', local: true, reduced: false });
  hook.rerender({ player: 'south', local: false, reduced: false });
  expect(hook.result.current).toBe(true);
  act(() => vi.runAllTimers());
  hook.rerender({ player: 'north', local: true, reduced: true });
  expect(hook.result.current).toBe(true);
});
