import { useEffect, useMemo, useReducer } from 'react';
import type { GameState } from '../game/types';
import type { MoveMotion } from './motion';
import { captureTransfers } from './captureTransfers';

/** Canonical stocks are immediate; only their displayed counts wait for each orb's arrival. */
export function useCaptureStocks(game: GameState, motion: MoveMotion | null): GameState {
  const [, update] = useReducer((n: number) => n + 1, 0);
  const transfers = useMemo(() => captureTransfers(motion), [motion]);
  useEffect(() => {
    const now = performance.now();
    const timers = transfers
      .filter((flight) => flight.arriveAt > now)
      .map((flight) => window.setTimeout(update, flight.arriveAt - now + 1));
    return () => timers.forEach(window.clearTimeout);
  }, [transfers]);
  if (!motion || !transfers.length) return game;
  const stocks = { south: { ...game.stocks.south }, north: { ...game.stocks.north } };
  for (const flight of transfers)
    if (performance.now() < flight.arriveAt)
      stocks[motion.action.piece.owner][flight.victim.kind]--;
  return { ...game, stocks };
}
