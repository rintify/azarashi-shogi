import { Pause, Play, StepForward } from 'lucide-react';
import type { GameState } from '../game/types';
import { aiDifficulty, playerLabel, type MatchSettings } from '../match/record';
import { StockItems } from './OpponentBar';

export function SpectatorDock({
  game,
  settings,
  paused,
  busy,
  thinking,
  onPause,
  onStep,
}: {
  game: GameState;
  settings: MatchSettings;
  paused: boolean;
  busy: boolean;
  thinking: boolean;
  onPause: () => void;
  onStep: () => void;
}) {
  const title = busy
    ? '一手を再生中'
    : thinking
      ? `${playerLabel(settings, game.turn)}が考えています`
      : paused
        ? '観戦を一時停止中'
        : 'AI vs AI 観戦中';
  return (
    <aside className="reserve-dock spectator-dock" aria-label="AI対局の観戦" title={title}>
      <span className="spectator-name">
        {playerLabel(settings, settings.human)}
        <small>Lv.{aiDifficulty(settings, settings.human)}</small>
      </span>
      <StockItems game={game} player={settings.human} />
      <div className="spectator-controls">
        <button
          className="spectator-control"
          onClick={onPause}
          aria-label={paused ? '観戦を再開' : '観戦を一時停止'}
          title={paused ? '観戦を再開' : '観戦を一時停止'}
        >
          {paused ? <Play size={16} /> : <Pause size={16} />}
        </button>
        <button
          className="spectator-control"
          onClick={onStep}
          disabled={!paused || busy || thinking}
          aria-label="1手進める"
          title="1手進める"
        >
          <StepForward size={16} />
        </button>
      </div>
    </aside>
  );
}
