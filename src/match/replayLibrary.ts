import { applyAction, createGame } from '../game/engine';
import type { GameState } from '../game/types';
import { decodeRecord, type GameRecord } from './record';

export const REPLAY_STORAGE_KEY = 'azarashi-shogi.replays.v1';
export interface SavedReplay {
  record: GameRecord;
  savedAt: string;
}
export function replayTimeline(record: GameRecord): GameState[] {
  const states = [createGame()];
  for (const action of record.actions) states.push(applyAction(states[states.length - 1], action));
  return states;
}
export function decodeLibrary(text: string): SavedReplay[] {
  const data = JSON.parse(text) as { version: number; items: SavedReplay[] };
  if (!data || data.version !== 1 || !Array.isArray(data.items))
    throw new Error('棋譜一覧を読み込めません。');
  return data.items.map((item) => ({
    record: decodeRecord(JSON.stringify(item.record)).record,
    savedAt: Number.isFinite(Date.parse(item.savedAt)) ? item.savedAt : item.record.createdAt,
  }));
}
export function saveReplay(
  items: SavedReplay[],
  record: GameRecord,
  savedAt = new Date().toISOString(),
) {
  if (!record.actions.length) return items;
  if (
    items.some(
      (item) => item.record.id === record.id && item.record.actions.length > record.actions.length,
    )
  )
    return items;
  return [{ record, savedAt }, ...items.filter((item) => item.record.id !== record.id)];
}
export function encodeLibrary(items: SavedReplay[]): string {
  return JSON.stringify({ version: 1, items });
}
