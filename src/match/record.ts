import { applyAction, createGame } from '../game/engine';
import { RULES_VERSION } from '../game/types';
import type { GameAction, GameState, Player } from '../game/types';
import { randomSeed } from '../shared/random';
export type Difficulty = 1 | 2 | 3 | 4 | 5;
export interface MatchSettings {
  mode?: 'human-vs-ai' | 'ai-vs-ai';
  aiLevels?: Record<Player, Difficulty>;
  human: Player;
  difficulty: Difficulty;
}
export interface GameRecord {
  id: string;
  createdAt: string;
  seed: number;
  version: 1;
  rulesVersion: typeof RULES_VERSION;
  settings: MatchSettings;
  actions: GameAction[];
}
export const DEFAULT_SETTINGS: MatchSettings = { human: 'south', difficulty: 3 };
export const STORAGE_KEY = `azarashi-shogi.match.v${RULES_VERSION}`;
export const LEGACY_STORAGE_KEY = 'azarashi-shogi.match.v1';
export const isSpectator = (settings: MatchSettings) => settings.mode === 'ai-vs-ai';
export const playerLabel = (settings: MatchSettings, player: Player) =>
  isSpectator(settings)
    ? player === 'south'
      ? '先手AI'
      : '後手AI'
    : player === settings.human
      ? 'あなた'
      : 'NPC';
export const aiDifficulty = (settings: MatchSettings, player: Player) =>
  settings.aiLevels?.[player] ?? settings.difficulty;
export function newRecord(settings = DEFAULT_SETTINGS): GameRecord {
  const seed = randomSeed();
  return {
    id: globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${seed.toString(16)}`,
    createdAt: new Date().toISOString(),
    seed,
    version: 1,
    rulesVersion: RULES_VERSION,
    settings: { ...settings },
    actions: [],
  };
}
export function replayRecord(record: GameRecord): GameState {
  return record.actions.reduce((state, action) => applyAction(state, action), createGame());
}
export function decodeRecord(text: string): { record: GameRecord; game: GameState } {
  const record = JSON.parse(text) as GameRecord;
  if (
    !record ||
    record.version !== 1 ||
    record.rulesVersion !== RULES_VERSION ||
    !validSettings(record.settings) ||
    !Array.isArray(record.actions)
  )
    throw new Error('保存データの形式またはルールのバージョンが違います。');
  const game = replayRecord(record);
  // Existing v2 records predate replay metadata. Upgrade without changing their actions.
  const defaults = newRecord(record.settings);
  return {
    record: {
      ...record,
      id: typeof record.id === 'string' && record.id.length > 0 ? record.id : defaults.id,
      createdAt:
        typeof record.createdAt === 'string' && Number.isFinite(Date.parse(record.createdAt))
          ? record.createdAt
          : defaults.createdAt,
      seed:
        Number.isInteger(record.seed) && record.seed >= 0 && record.seed <= 0xffffffff
          ? record.seed
          : defaults.seed,
    },
    game,
  };
}
function validSettings(settings: MatchSettings): boolean {
  return (
    !!settings &&
    (settings.mode === undefined || ['human-vs-ai', 'ai-vs-ai'].includes(settings.mode)) &&
    (settings.aiLevels === undefined ||
      ['south', 'north'].every((side) =>
        [1, 2, 3, 4, 5].includes(settings.aiLevels![side as Player]),
      )) &&
    ['south', 'north'].includes(settings.human) &&
    [1, 2, 3, 4, 5].includes(settings.difficulty)
  );
}
export function loadMatch(): { record: GameRecord; game: GameState; warning: string | null } {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) return { ...decodeRecord(saved), warning: null };
    const legacy = localStorage.getItem(LEGACY_STORAGE_KEY);
    if (legacy) {
      const settings = (JSON.parse(legacy) as { settings?: MatchSettings }).settings;
      return {
        record: newRecord(settings && validSettings(settings) ? settings : DEFAULT_SETTINGS),
        game: createGame(),
        warning: '新ルールで対局を始めました。以前の棋譜はこの端末に保管しています。',
      };
    }
  } catch {
    return {
      record: newRecord(),
      game: createGame(),
      warning: '保存データを読み込めなかったため、新しい対局を始めました。',
    };
  }
  return { record: newRecord(), game: createGame(), warning: null };
}
