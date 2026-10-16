// @vitest-environment jsdom
import { act, cleanup, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { positionIdentity } from '../game/position';
import { newRecord, STORAGE_KEY } from './record';
import { useMatch } from './useMatch';

beforeEach(() => {
  const saved = new Map<string, string>();
  vi.stubGlobal('localStorage', {
    getItem: (key: string) => saved.get(key) ?? null,
    setItem: (key: string, value: string) => saved.set(key, value),
  });
});
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

it('restores, appends and resets position history with the canonical match', () => {
  const record = newRecord({ human: 'south', difficulty: 3, mode: 'ai-vs-ai' });
  record.actions = [{ type: 'move', pieceId: 'king-south', to: { x: 3, y: 8 } }];
  localStorage.setItem(STORAGE_KEY, JSON.stringify(record));
  const hook = renderHook(() => useMatch());
  expect(hook.result.current.positionHistory).toHaveLength(2);
  act(() =>
    hook.result.current.submit({ type: 'move', pieceId: 'king-north', to: { x: 3, y: 0 } }, 1),
  );
  expect(hook.result.current.positionHistory).toHaveLength(3);
  expect(hook.result.current.positionHistory[2]).toBe(positionIdentity(hook.result.current.game));
  // A stale action must not add a phantom occurrence.
  act(() =>
    hook.result.current.submit({ type: 'move', pieceId: 'king-north', to: { x: 3, y: 0 } }, 1),
  );
  expect(hook.result.current.positionHistory).toHaveLength(3);
  act(() => hook.result.current.restart({ human: 'south', difficulty: 6 }));
  expect(hook.result.current.positionHistory).toEqual([positionIdentity(hook.result.current.game)]);
  expect(hook.result.current.game.revision).toBe(0);
});
