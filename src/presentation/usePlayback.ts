import { useLayoutEffect, useState } from 'react';
import type { GameState } from '../game/types';
import { createMotion, type MoveMotion } from './motion';

/** Canonical state is committed immediately; the next turn waits for its presentation. */
export function usePlayback(game: GameState, reduced = false) {
  const [settled, setSettled] = useState(game);
  const [motion, setMotion] = useState<MoveMotion | null>(null);
  useLayoutEffect(() => {
    if (game === settled) return;
    const next = createMotion(settled, game, performance.now(), reduced);
    if (!next) {
      setSettled(game);
      setMotion(null);
      return;
    }
    setMotion(next);
    const timer = window.setTimeout(() => {
      setMotion(null);
      setSettled(game);
    }, next.duration);
    return () => window.clearTimeout(timer);
  }, [game, settled, reduced]);
  return { motion, busy: game !== settled, settled };
}
