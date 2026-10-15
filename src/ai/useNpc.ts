import { useEffect, useState } from 'react';
import type { GameAction, GameState, Player } from '../game/types';
import type { Difficulty } from '../match/record';
import type { ThinkRequest, ThinkResponse } from './protocol';
export function useNpc(
  game: GameState,
  human: Player | null,
  difficulty: Difficulty,
  submit: (action: GameAction, revision: number) => void,
  enabled = true,
  seed = 0,
) {
  const [status, setStatus] = useState({ thinking: false, depth: 0, nodes: 0 });
  const [error, setError] = useState<string | null>(null);
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    if (!enabled || game.turn === human || game.phase === 'finished') {
      setStatus((s) => (s.thinking ? { ...s, thinking: false } : s));
      setError(null);
      return;
    }
    let active = true;
    let worker: Worker;
    setStatus({ thinking: true, depth: 0, nodes: 0 });
    setError(null);
    try {
      worker = new Worker(new URL('./worker.ts', import.meta.url), { type: 'module' });
    } catch {
      setError('この環境ではNPCを起動できません。ブラウザーを更新して再試行してください。');
      setStatus((s) => ({ ...s, thinking: false }));
      return;
    }
    worker.onmessage = ({ data }: MessageEvent<ThinkResponse>) => {
      if (!active || data.revision !== game.revision) return;
      if (data.type === 'progress') setStatus({ thinking: true, ...data.progress });
      else if (data.type === 'result') {
        setStatus({ thinking: false, ...data.result });
        if (data.result.action) submit(data.result.action, game.revision);
        else setError('指せる手が見つかりませんでした。再試行してください。');
      } else {
        setError(data.message);
        setStatus((s) => ({ ...s, thinking: false }));
      }
    };
    worker.onerror = () => {
      if (active) {
        setError('NPCの読み込みに失敗しました。再試行してください。');
        setStatus((s) => ({ ...s, thinking: false }));
      }
    };
    const request: ThinkRequest = { state: game, difficulty, revision: game.revision, seed };
    worker.postMessage(request);
    return () => {
      active = false;
      worker.terminate();
    };
  }, [game, human, difficulty, submit, attempt, enabled, seed]);
  return { status, error, retry: () => setAttempt((n) => n + 1) };
}
