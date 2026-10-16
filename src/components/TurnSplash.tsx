import { useEffect, useRef, useState } from 'react';
import { Snowflake } from 'lucide-react';
import type { GameState, Player } from '../game/types';
import { isSpectator, isLocalPvP, playerLabel, type MatchSettings } from '../match/record';

/** Announce the next turn only after the previous piece has landed. */
export function TurnSplash({
  game,
  settings,
  ready,
  busy,
}: {
  game: GameState;
  settings: MatchSettings;
  ready: boolean;
  busy: boolean;
}) {
  const announced = useRef<Player | null>(null);
  const [notice, setNotice] = useState<{ turn: Player; revision: number } | null>(null);
  useEffect(() => {
    if (!ready || game.phase !== 'playing') {
      setNotice(null);
      return;
    }
    if (busy) return;
    if (announced.current === game.turn) return;
    announced.current = game.turn;
    setNotice({ turn: game.turn, revision: game.revision });
  }, [ready, busy, game.turn, game.revision, game.phase]);
  useEffect(() => {
    if (!notice) return;
    const timer = window.setTimeout(() => setNotice(null), 1050);
    return () => window.clearTimeout(timer);
  }, [notice]);
  if (!notice || !ready || game.phase !== 'playing') return null;
  const label =
    !isLocalPvP(settings) && !isSpectator(settings) && notice.turn !== settings.human
      ? '相手'
      : playerLabel(settings, notice.turn);
  return (
    <div className="turn-splash" key={notice.revision} data-side={notice.turn} aria-hidden="true">
      <div className="turn-splash-copy">
        <Snowflake className="turn-splash-spark" />
        <strong>
          {label}
          <small>の番</small>
        </strong>
      </div>
    </div>
  );
}
