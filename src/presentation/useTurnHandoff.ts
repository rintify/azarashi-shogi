import { useEffect, useState } from 'react';
import { TURN_ROTATION_MS } from './cameraOrbit';
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
    const timer = window.setTimeout(() => setReadyPlayer(player), TURN_ROTATION_MS);
    return () => window.clearTimeout(timer);
  }, [player, local, reduced, readyPlayer]);
  return !local || reduced || readyPlayer === player;
}
