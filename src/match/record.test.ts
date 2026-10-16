import { expect, it } from 'vitest';
import { positionIdentity } from '../game/position';
import {
  aiDifficulty,
  decodeRecord,
  isSpectator,
  isLocalPvP,
  interactionPlayer,
  isComputerTurn,
  newRecord,
  playerLabel,
} from './record';
it('restores legacy human matches and AI versus AI settings with independent levels', () => {
  const legacy = decodeRecord(JSON.stringify(newRecord({ human: 'south', difficulty: 3 })));
  expect(isSpectator(legacy.record.settings)).toBe(false);
  const saved = newRecord({
    human: 'south',
    mode: 'ai-vs-ai',
    difficulty: 4,
    aiLevels: { south: 2, north: 4 },
  });
  const loaded = decodeRecord(JSON.stringify(saved));
  expect(isSpectator(loaded.record.settings)).toBe(true);
  expect(aiDifficulty(loaded.record.settings, 'south')).toBe(2);
  expect(aiDifficulty(loaded.record.settings, 'north')).toBe(4);
  expect(playerLabel(loaded.record.settings, 'south')).toBe('先手AI');
  expect(playerLabel(loaded.record.settings, 'north')).toBe('後手AI');
});
it('rejects unknown modes and malformed AI levels rather than starting an invalid match', () => {
  const record = newRecord();
  expect(() =>
    decodeRecord(JSON.stringify({ ...record, settings: { ...record.settings, mode: 'invalid' } })),
  ).toThrow();
  expect(() =>
    decodeRecord(
      JSON.stringify({
        ...record,
        settings: { ...record.settings, aiLevels: { south: 7, north: 2 } },
      }),
    ),
  ).toThrow();
});

it('saves and restores the highest AI level for solo and spectator matches', () => {
  for (const mode of ['human-vs-ai', 'ai-vs-ai'] as const) {
    const record = newRecord({
      human: 'north',
      mode,
      difficulty: 6,
      aiLevels: { south: 6, north: 5 },
    });
    record.actions = [{ type: 'place', kind: 'seal', at: { x: 3, y: 7 } }];
    const restored = decodeRecord(JSON.stringify(record));
    expect(restored.record.settings).toEqual(record.settings);
    expect(restored.game.revision).toBe(1);
  }
});

it('does not replay a record under a different rule version', () => {
  expect(() => decodeRecord(JSON.stringify({ ...newRecord(), rulesVersion: 1 }))).toThrow();
});

it('rebuilds repetition history from saved moves without adjudicating a draw', () => {
  const record = newRecord({ human: 'south', difficulty: 3, mode: 'ai-vs-ai' });
  record.actions = [
    { type: 'move', pieceId: 'king-south', to: { x: 3, y: 8 } },
    { type: 'move', pieceId: 'king-north', to: { x: 3, y: 0 } },
    { type: 'move', pieceId: 'king-south', to: { x: 4, y: 8 } },
    { type: 'move', pieceId: 'king-north', to: { x: 4, y: 0 } },
  ];
  const loaded = decodeRecord(JSON.stringify(record));
  expect(loaded.positionHistory).toHaveLength(5);
  expect(loaded.positionHistory[0]).toBe(loaded.positionHistory[4]);
  expect(loaded.positionHistory[4]).toBe(positionIdentity(loaded.game));
  expect(loaded.game.phase).toBe('playing');
  expect(loaded.game.result).toBeNull();
});

it('restores local PvP and assigns both sides to human control without AI turns', () => {
  const record = newRecord({ mode: 'local-pvp', human: 'south', difficulty: 3 });
  record.actions = [
    { type: 'place', kind: 'seal', at: { x: 3, y: 7 } },
    { type: 'place', kind: 'penguin', at: { x: 3, y: 2 } },
  ];
  const loaded = decodeRecord(JSON.stringify(record));
  expect(isLocalPvP(loaded.record.settings)).toBe(true);
  expect(loaded.game.revision).toBe(2);
  expect(playerLabel(record.settings, 'south')).toBe('先手');
  expect(playerLabel(record.settings, 'north')).toBe('後手');
  for (const turn of ['south', 'north'] as const) {
    expect(interactionPlayer(record.settings, turn)).toBe(turn);
    expect(isComputerTurn(record.settings, turn)).toBe(false);
  }
  const solo = { human: 'south' as const, difficulty: 3 as const };
  expect(interactionPlayer(solo, 'north')).toBe('south');
  expect(isComputerTurn(solo, 'north')).toBe(true);
  expect(isComputerTurn({ ...solo, mode: 'ai-vs-ai' }, 'south')).toBe(true);
});
