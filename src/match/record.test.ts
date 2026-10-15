import { expect, it } from 'vitest';
import { aiDifficulty, decodeRecord, isSpectator, newRecord, playerLabel } from './record';
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
        settings: { ...record.settings, aiLevels: { south: 6, north: 2 } },
      }),
    ),
  ).toThrow();
});

it('does not replay a record under a different rule version', () => {
  expect(() => decodeRecord(JSON.stringify({ ...newRecord(), rulesVersion: 1 }))).toThrow();
});
