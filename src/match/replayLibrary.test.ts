import { expect, it } from 'vitest';
import { applyAction, createGame, legalPreviews } from '../game/engine';
import { decodeRecord, newRecord, replayRecord } from './record';
import { decodeLibrary, encodeLibrary, replayTimeline, saveReplay } from './replayLibrary';

function playedRecord() {
  const record = newRecord();
  let game = createGame();
  // Includes deployments, captures and transformations through the actual legal-action contract.
  for (let i = 0; i < 12 && game.phase !== 'finished'; i++) {
    const moves = legalPreviews(game);
    const preview =
      moves.find((p) => p.action.type === 'move' && p.action.transformation) ??
      moves.find((p) => p.captured.length) ??
      moves.find((p) => p.action.type === 'place') ??
      moves[0];
    record.actions.push(preview.action);
    game = applyAction(game, preview.action);
  }
  return { record, game };
}
it('restores every frame and the final state exactly after saving and loading', () => {
  const { record, game } = playedRecord();
  const stored = encodeLibrary(saveReplay([], record));
  const restored = decodeLibrary(stored)[0].record;
  expect(restored).toEqual(record);
  expect(replayTimeline(restored)).toHaveLength(record.actions.length + 1);
  expect(replayTimeline(restored).at(-1)).toEqual(game);
  for (let i = 0; i <= record.actions.length; i++)
    expect(replayTimeline(restored)[i]).toEqual(
      replayRecord({ ...restored, actions: restored.actions.slice(0, i) }),
    );
});
it('updates one match, keeps earlier matches and never replaces a longer replay with a partial file', () => {
  const { record } = playedRecord();
  let items = saveReplay([], { ...record, actions: record.actions.slice(0, 1) });
  items = saveReplay(items, record);
  expect(items).toHaveLength(1);
  expect(saveReplay(items, { ...record, actions: record.actions.slice(0, 1) })).toEqual(items);
  const next = newRecord();
  next.actions = [record.actions[0]];
  items = saveReplay(items, next);
  expect(items.map((i) => i.record.id)).toEqual([next.id, record.id]);
  expect(saveReplay(items, newRecord())).toEqual(items);
});
it('rejects invalid rules, illegal actions and corrupt libraries', () => {
  const { record } = playedRecord();
  expect(() => decodeLibrary('{')).toThrow();
  expect(() => decodeLibrary(JSON.stringify({ version: 8, items: [] }))).toThrow();
  expect(() => decodeRecord(JSON.stringify({ ...record, rulesVersion: 999 }))).toThrow();
  expect(() =>
    decodeRecord(
      JSON.stringify({
        ...record,
        actions: [{ type: 'place', kind: 'bear', at: { x: 99, y: 99 } }],
      }),
    ),
  ).toThrow();
});
it('gives a new match its own entropy and preserves it with legacy-compatible metadata', () => {
  const first = newRecord(),
    second = newRecord();
  expect(first.id).not.toBe(second.id);
  expect(first.seed).toBeGreaterThanOrEqual(0);
  expect(first.seed).toBeLessThanOrEqual(0xffffffff);
  expect(decodeRecord(JSON.stringify(first)).record).toEqual(first);
  const old = { version: 1, rulesVersion: 2, settings: first.settings, actions: [] };
  const loaded = decodeRecord(JSON.stringify(old));
  expect(loaded.record.id).toBeTruthy();
  expect(loaded.game).toEqual(createGame());
});
