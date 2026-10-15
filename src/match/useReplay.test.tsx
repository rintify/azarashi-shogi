// @vitest-environment jsdom
import { act, cleanup, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { newRecord, replayRecord } from './record';
import { useReplay } from './useReplay';
import { useReplayLibrary } from './useReplayLibrary';
import { REPLAY_STORAGE_KEY } from './replayLibrary';
beforeEach(() => {
  const values = new Map<string, string>();
  vi.stubGlobal('localStorage', {
    getItem: vi.fn((key: string) => values.get(key) ?? null),
    setItem: vi.fn((key: string, value: string) => values.set(key, value)),
  });
});
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});
const record = () => ({
  ...newRecord(),
  actions: [
    { type: 'place' as const, kind: 'seal' as const, at: { x: 3, y: 7 } },
    { type: 'place' as const, kind: 'seal' as const, at: { x: 3, y: 2 } },
  ],
});
it('scrubs, steps, replays the ending, and closes without altering the active record', () => {
  const saved = record(),
    original = structuredClone(saved);
  const hook = renderHook(() => useReplay());
  act(() => hook.result.current.open(saved));
  expect(hook.result.current.cursor).toBe(0);
  expect(hook.result.current.playing).toBe(true);
  act(() => hook.result.current.advance());
  expect(hook.result.current.game?.revision).toBe(1);
  const epoch = hook.result.current.epoch;
  act(() => hook.result.current.seek(99));
  expect(hook.result.current.epoch).toBeGreaterThan(epoch);
  expect(hook.result.current.game).toEqual(replayRecord(saved));
  expect(hook.result.current.playing).toBe(false);
  act(() => hook.result.current.toggle());
  expect(hook.result.current.cursor).toBe(0);
  expect(hook.result.current.playing).toBe(true);
  act(() => hook.result.current.seek(-10));
  expect(hook.result.current.cursor).toBe(0);
  act(() => hook.result.current.close());
  expect(hook.result.current.active).toBe(false);
  expect(saved).toEqual(original);
});
it('automatically persists separate matches and restores them on a later visit', () => {
  const first = record(),
    second = record();
  const hook = renderHook(({ current }) => useReplayLibrary(current), {
    initialProps: { current: first },
  });
  expect(hook.result.current.items[0].record).toEqual(first);
  hook.rerender({ current: second });
  expect(hook.result.current.items).toHaveLength(2);
  hook.unmount();
  const revisit = renderHook(() => useReplayLibrary(newRecord()));
  expect(revisit.result.current.items.map((i) => i.record.id)).toEqual([second.id, first.id]);
});
it('reports storage failures and keeps a downloadable copy in memory', () => {
  vi.mocked(localStorage.setItem).mockImplementation(() => {
    throw new Error('quota');
  });
  const saved = record();
  const hook = renderHook(() => useReplayLibrary(saved));
  expect(hook.result.current.items[0].record).toEqual(saved);
  expect(hook.result.current.warning).toContain('ファイルに保存');
});
it('preserves corrupt storage and rejects a bad import without changing its saved matches', () => {
  localStorage.setItem(REPLAY_STORAGE_KEY, 'unreadable');
  const saved = record();
  const hook = renderHook(() => useReplayLibrary(saved));
  expect(localStorage.getItem(REPLAY_STORAGE_KEY)).toBe('unreadable');
  expect(hook.result.current.warning).toContain('既存データは保持');
  expect(() => hook.result.current.importRecord('not json')).toThrow();
  expect(hook.result.current.items).toHaveLength(1);
});
