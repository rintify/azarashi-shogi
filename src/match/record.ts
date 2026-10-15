import { applyAction, createGame } from '../game/engine';
import type { GameAction, GameState, Player } from '../game/types';
export type Difficulty = 1 | 2 | 3 | 4 | 5;
export interface MatchSettings {
  mode?: 'human-vs-ai' | 'ai-vs-ai';
  aiLevels?: Record<Player, Difficulty>;
  human: Player;
  difficulty: Difficulty;
}
export interface GameRecord {
  version: 1;
  rulesVersion: 1;
  settings: MatchSettings;
  actions: GameAction[];
}
export const DEFAULT_SETTINGS: MatchSettings = { human: 'south', difficulty: 3 };
export const STORAGE_KEY = 'azarashi-shogi.match.v1';
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
  return { version: 1, rulesVersion: 1, settings: { ...settings }, actions: [] };
}
export function replayRecord(record: GameRecord): GameState {
  return record.actions.reduce((state, action) => applyAction(state, action), createGame());
}
export function decodeRecord(text: string): { record: GameRecord; game: GameState } {
  const record = JSON.parse(text) as GameRecord;
  // The first local prototype's version 1 records also used rules version 1.
  if (record.rulesVersion === undefined) record.rulesVersion = 1;
  if (
    record.version !== 1 ||
    record.rulesVersion !== 1 ||
    (record.settings?.mode !== undefined &&
      !['human-vs-ai', 'ai-vs-ai'].includes(record.settings.mode)) ||
    (record.settings?.aiLevels !== undefined &&
      !['south', 'north'].every((side) =>
        [1, 2, 3, 4, 5].includes(record.settings.aiLevels![side as Player]),
      )) ||
    !['south', 'north'].includes(record.settings?.human) ||
    ![1, 2, 3, 4, 5].includes(record.settings?.difficulty) ||
    !Array.isArray(record.actions)
  )
    throw new Error('保存データの形式が違います。');
  return { record, game: replayRecord(record) };
}
export function loadMatch(): { record: GameRecord; game: GameState; warning: string | null } {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) return { ...decodeRecord(saved), warning: null };
  } catch {
    return {
      record: newRecord(),
      game: createGame(),
      warning: '保存データを読み込めなかったため、新しい対局を始めました。',
    };
  }
  return { record: newRecord(), game: createGame(), warning: null };
}
