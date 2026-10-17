import { useEffect, useRef, useState } from 'react';
import type { GameAction, GameState, Player } from '../game/types';
import type { Difficulty } from '../match/record';
import { NpcClient } from './NpcClient';
const EMPTY_HISTORY: readonly string[] = [];

export function useNpc(
  game: GameState,
  human: Player | null,
  difficulty: Difficulty,
  submit: (action: GameAction, revision: number) => void,
  enabled = true,
  seed = 0,
  positionHistory: readonly string[] = EMPTY_HISTORY,
  matchId = String(seed),
  deferUntilSettled = false,
) {
  const [status, setStatus] = useState({ thinking: false, depth: 0, nodes: 0 });
  const [thinkingSession, setThinkingSession] = useState<{
    startedAt: number;
    budgetMs: number;
  } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [attempt, setAttempt] = useState(0);
  const [visible, setVisible] = useState(() => !document.hidden);
  const client = useRef<NpcClient | null>(null);
  useEffect(() => {
    const update = () => setVisible(!document.hidden);
    document.addEventListener('visibilitychange', update);
    return () => document.removeEventListener('visibilitychange', update);
  }, []);
  useEffect(() => {
    const instance = new NpcClient();
    client.current = instance;
    return () => {
      instance.dispose();
      client.current = null;
    };
  }, [matchId, seed, attempt]);

  useEffect(() => {
    const instance = client.current!;
    if (!enabled || !visible || game.phase === 'finished') {
      instance.stop();
      setStatus((s) => (s.thinking ? { ...s, thinking: false } : s));
      setError(null);
      return;
    }
    if (deferUntilSettled) {
      setStatus((s) => ({ ...s, thinking: false }));
      return;
    }
    let active = true;
    const input = { state: game, difficulty, seed, positionHistory };
    setError(null);
    if (game.turn === human) {
      setStatus((s) => ({ ...s, thinking: false }));
      // A speculative failure must never interrupt the player's turn.
      try {
        instance.ponder(input);
      } catch {
        instance.stop();
      }
    } else {
      setStatus({ thinking: true, depth: 0, nodes: 0 });
      const startedAt = performance.now();
      try {
        const budgetMs = instance.think(input, (data) => {
          if (!active) return;
          if (data.type === 'progress') setStatus({ thinking: true, ...data.progress });
          else if (data.type === 'result') {
            setStatus({ thinking: false, ...data.result });
            if (data.result.action) submit(data.result.action, game.revision);
            else setError('指せる手が見つかりませんでした。再試行してください。');
          } else if (data.type === 'error') {
            setError(data.message);
            setStatus((s) => ({ ...s, thinking: false }));
          }
        });
        setThinkingSession({ startedAt, budgetMs });
      } catch {
        instance.stop();
        setError('この環境ではNPCを起動できません。ブラウザーを更新して再試行してください。');
        setStatus((s) => ({ ...s, thinking: false }));
      }
    }
    // Keep speculative work alive across the human -> NPC transition so it can be adopted.
    return () => {
      active = false;
    };
  }, [
    game,
    human,
    difficulty,
    submit,
    attempt,
    enabled,
    seed,
    positionHistory,
    matchId,
    visible,
    deferUntilSettled,
  ]);
  return {
    status,
    thinkingSession: status.thinking ? thinkingSession : null,
    error,
    retry: () => setAttempt((n) => n + 1),
  };
}
