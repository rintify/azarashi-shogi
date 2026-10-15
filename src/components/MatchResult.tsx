import { GameDialog } from './AnimatedUI';
import { AnimalIcon } from './AnimalIcon';

/** Native modality keeps keyboard focus on the result until the board is reopened. */
export function MatchResult({
  title,
  detail,
  onNewGame,
  onInspect,
}: {
  title: string;
  detail: string;
  onNewGame: () => void;
  onInspect: () => void;
}) {
  return (
    <GameDialog
      className="result-overlay"
      aria-labelledby="result-title"
      onDismiss={onInspect}
      dismissOnBackdrop={false}
    >
      <section>
        <AnimalIcon kind="walrus" className="result-mascot" />
        <p className="result-kicker">対局終了</p>
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
