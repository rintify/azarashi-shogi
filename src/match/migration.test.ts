// @vitest-environment jsdom
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { LEGACY_STORAGE_KEY, STORAGE_KEY, loadMatch, newRecord } from './record';
import { applyAction, createGame } from '../game/engine';
beforeEach(() => {
  const values = new Map<string, string>();
  vi.stubGlobal('localStorage', {
    getItem: (key: string) => values.get(key) ?? null,
    setItem: (key: string, value: string) => values.set(key, value),
  });
});
afterEach(() => vi.unstubAllGlobals());
it('keeps the old record untouched and carries settings to a fresh fixed-king game', () => {
  const old = JSON.stringify({
    version: 1,
    rulesVersion: 1,
    settings: { human: 'north', difficulty: 2 },
    actions: [],
  });
  localStorage.setItem(LEGACY_STORAGE_KEY, old);
  const loaded = loadMatch();
  expect(loaded.record.settings).toEqual({ human: 'north', difficulty: 2 });
  expect(loaded.game).toEqual(createGame());
  expect(loaded.warning).toContain('以前の棋譜');
  expect(localStorage.getItem(LEGACY_STORAGE_KEY)).toBe(old);
});
it('replays the new record ahead of the preserved legacy data', () => {
  const record = newRecord();
  record.actions.push({ type: 'place', kind: 'seal', at: { x: 3, y: 7 } });
  localStorage.setItem(STORAGE_KEY, JSON.stringify(record));
  localStorage.setItem(LEGACY_STORAGE_KEY, 'old');
  expect(loadMatch().game).toEqual(applyAction(createGame(), record.actions[0]));
  expect(loadMatch().warning).toBeNull();
});
