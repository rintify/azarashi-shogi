import type { CSSProperties } from 'react';
import { Crown, Snowflake } from 'lucide-react';
import { GameDialog } from './AnimatedUI';

/** Native modality keeps keyboard focus on the result until the board is reopened. */
export function MatchResult({
  outcome,
  title,
  detail,
  onNewGame,
  onInspect,
}: {
  outcome: 'victory' | 'defeat' | 'draw';
  title: string;
  detail: string;
  onNewGame: () => void;
  onInspect: () => void;
}) {
  return (
    <GameDialog
      className={`result-overlay result-${outcome}`}
      aria-labelledby="result-title"
      onDismiss={onInspect}
      dismissOnBackdrop={false}
    >
      <div className="result-spectacle" aria-hidden="true">
        <div className="result-rays" />
        <div className="result-shockwave" />
        <div className="result-shockwave second" />
        {Array.from({ length: 32 }, (_, i) => (
          <i
            key={i}
            className="result-particle"
            style={
              {
                '--x': `${(i * 37 + 11) % 100}%`,
                '--delay': `${(i % 8) * 0.09}s`,
                '--drift': `${((i * 29) % 180) - 90}px`,
                '--spin': `${i * 71}deg`,
                '--fall': `${2.5 + (i % 5) * 0.3}s`,
              } as CSSProperties
            }
          />
        ))}
      </div>
      <section>
        <div className="result-emblem" aria-hidden="true">
          {outcome === 'victory' ? <Crown size={54} /> : <Snowflake size={54} />}
        </div>
        <p className="result-kicker">
          {outcome === 'victory' ? 'VICTORY' : outcome === 'defeat' ? 'DEFEAT' : 'DRAW'}
        </p>
        <h2 id="result-title">{title}</h2>
        <p>{detail}</p>
        <button className="primary-button full" onClick={onNewGame}>
          新しい対局
        </button>
        <button className="result-inspect" onClick={onInspect}>
          盤面を見る
        </button>
      </section>
    </GameDialog>
  );
}
