// @vitest-environment jsdom
import { act, cleanup, renderHook } from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';
import { applyAction, createGame } from '../game/engine';
import { createMotion } from './motion';
import { captureTransfers } from './captureTransfers';
import { useCaptureStocks } from './useCaptureStocks';

afterEach(() => {
  cleanup();
  vi.useRealTimers();
});
it('adds each captured piece only when its orb arrives without mutating match state', () => {
  vi.useFakeTimers();
  const before = createGame();
  before.pieces.push(
    { id: 'orca', owner: 'south', kind: 'orca', promoted: false, at: { x: 3, y: 5 } },
    { id: 'a', owner: 'north', kind: 'seal', promoted: false, at: { x: 4, y: 3 } },
    { id: 'b', owner: 'south', kind: 'seal', promoted: true, at: { x: 4, y: 4 } },
  );
  const after = applyAction(before, { type: 'move', pieceId: 'orca', to: { x: 4, y: 3 } });
  const motion = createMotion(before, after, performance.now())!;
  const flights = captureTransfers(motion);
  const hook = renderHook(({ game, animation }) => useCaptureStocks(game, animation), {
    initialProps: { game: after, animation: motion as typeof motion | null },
  });
  expect(hook.result.current.stocks.south.seal).toBe(before.stocks.south.seal);
  act(() => vi.advanceTimersByTime(flights[0].arriveAt - performance.now() + 2));
  expect(hook.result.current.stocks.south.seal).toBe(before.stocks.south.seal + 1);
  act(() => vi.advanceTimersByTime(flights[1].arriveAt - performance.now() + 2));
  expect(hook.result.current.stocks.south.seal).toBe(after.stocks.south.seal);
  expect(after.stocks.south.seal).toBe(before.stocks.south.seal + 2);
  hook.rerender({ game: before, animation: null });
  act(() => vi.runAllTimers());
  expect(hook.result.current.stocks).toBe(before.stocks);
});
