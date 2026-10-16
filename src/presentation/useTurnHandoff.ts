import { useEffect, useState } from 'react';
import type { Player } from '../game/types';

/** Keep touch input still while the shared device's camera turns to the next player. */
export function useTurnHandoff(player: Player, local: boolean, reduced: boolean) {
  const [readyPlayer, setReadyPlayer] = useState(player);
  useEffect(() => {
    if (!local || reduced) {
      setReadyPlayer(player);
      return;
    }
    if (readyPlayer === player) return;
    const timer = window.setTimeout(() => setReadyPlayer(player), 650);
    return () => window.clearTimeout(timer);
  }, [player, local, reduced, readyPlayer]);
  return !local || reduced || readyPlayer === player;
}
