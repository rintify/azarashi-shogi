import { useCallback, useEffect, useState } from 'react';
import { decodeRecord, type GameRecord } from './record';
import {
  decodeLibrary,
  encodeLibrary,
  REPLAY_STORAGE_KEY,
  saveReplay,
  type SavedReplay,
} from './replayLibrary';

/** Owns persistent replay copies; watching never writes to the active match. */
export function useReplayLibrary(record: GameRecord) {
  const [library, setLibrary] = useState<{
    items: SavedReplay[];
    warning: string | null;
    readable: boolean;
  }>(() => {
    try {
      const raw = localStorage.getItem(REPLAY_STORAGE_KEY);
      return { items: raw ? decodeLibrary(raw) : [], warning: null, readable: true };
    } catch {
      return {
        items: [],
        warning: '保存済みの棋譜を読み込めません。既存データは保持しています。',
        readable: false,
      };
    }
  });
  const persist = useCallback((next: GameRecord) => {
    setLibrary((current) => {
      const items = saveReplay(current.items, next);
      if (!current.readable) return { ...current, items };
      try {
        localStorage.setItem(REPLAY_STORAGE_KEY, encodeLibrary(items));
        return { items, warning: null, readable: true };
      } catch {
        return {
          items,
          readable: true,
          warning: '端末に棋譜を保存できません。棋譜一覧からファイルに保存してください。',
        };
      }
    });
  }, []);
  useEffect(() => {
    if (record.actions.length) persist(record);
  }, [record, persist]);
  const importRecord = (text: string) => {
    const imported = decodeRecord(text).record;
    if (!imported.actions.length) throw new Error('棋譜に指し手がありません。');
    persist(imported);
    return imported;
  };
  return { items: library.items, warning: library.warning, importRecord };
}
