import {
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
  Pause,
  Play,
  X,
} from 'lucide-react';
import type { GameState, Player } from '../game/types';
import { StockItems } from './OpponentBar';
import type { ReplayController } from '../match/useReplay';
export function ReplayDock({
  replay,
  busy,
  game,
  human,
}: {
  replay: ReplayController;
  busy: boolean;
  game: GameState;
  human: Player;
}) {
  return (
    <aside className="replay-dock" aria-label="リプレイ操作">
      <div className="replay-stock">
        <StockItems game={game} player={human} />
      </div>
      <input
        type="range"
        min={0}
        max={replay.total}
        step={1}
        value={replay.cursor}
        aria-label="リプレイの手数"
        onChange={(e) => replay.seek(Number(e.target.value))}
      />
      <div className="replay-controls">
        <button
          aria-label="最初の局面"
          onClick={() => replay.seek(0)}
          disabled={replay.cursor === 0 && !busy}
        >
          <ChevronsLeft />
        </button>
        <button
          aria-label="1手戻す"
          onClick={() => replay.seek(replay.cursor - 1)}
          disabled={replay.cursor === 0 && !busy}
        >
          <ChevronLeft />
        </button>
        <button
          className="replay-play"
          aria-label={replay.playing ? 'リプレイを一時停止' : 'リプレイを再生'}
          onClick={replay.toggle}
        >
          {replay.playing ? <Pause fill="currentColor" /> : <Play fill="currentColor" />}
        </button>
        <button
          aria-label="1手進む"
          disabled={busy || replay.cursor === replay.total}
          onClick={() => {
            replay.pause();
            replay.advance();
          }}
        >
          <ChevronRight />
        </button>
        <button
          aria-label="最後の局面"
          onClick={() => replay.seek(replay.total)}
          disabled={replay.cursor === replay.total && !busy}
        >
          <ChevronsRight />
        </button>
        <button
          className="replay-speed"
          aria-label={`再生速度 ${replay.speed}倍`}
          onClick={() => replay.setSpeed(replay.speed === 0.5 ? 1 : replay.speed === 1 ? 2 : 0.5)}
          disabled={busy}
        >
          {replay.speed}×
        </button>
        <button aria-label="リプレイを終了して対局に戻る" onClick={replay.close}>
          <X size={19} />
        </button>
      </div>
    </aside>
  );
}
