import { useCallback, useEffect, useState } from 'react';
import { applyAction, createGame } from '../game/engine';
import type { GameAction } from '../game/types';
import { loadMatch, newRecord, STORAGE_KEY } from './record';
import type { MatchSettings } from './record';
export function useMatch() {
  const [match, setMatch] = useState(loadMatch);
  const [saveWarning, setSaveWarning] = useState<string | null>(null);
  useEffect(() => {
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(match.record)); setSaveWarning(null); }
    catch { setSaveWarning('このブラウザーでは対局を保存できません。ページを閉じると対局が失われます。'); }
  }, [match.record]);
  const submit = useCallback((action: GameAction, revision: number) => {
    setMatch(current => {
      if (current.game.revision !== revision) return current;
      try {
        return { ...current, game: applyAction(current.game, action, revision), record: { ...current.record, actions: [...current.record.actions, action] } };
      } catch { return { ...current, warning: '局面が変わったため、この手を取り消しました。' }; }
    });
  }, []);
  const restart = useCallback((settings: MatchSettings) => setMatch({ game: createGame(), record: newRecord(settings), warning: null }), []);
  return { game: match.game, settings: match.record.settings, warning: saveWarning ?? match.warning, submit, restart, history: match.record.actions };
}
