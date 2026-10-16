import { Component, lazy, Suspense, useState, type ReactNode } from 'react';
import { BookOpen, Pause, Play, Triangle, X } from 'lucide-react';
import { DEFINITIONS, dimensions, KINDS, pieceName } from '../game/pieces';
import type { Kind } from '../game/types';
import { AnimatedValue, GameDialog } from './AnimatedUI';
import { AnimalIcon } from './AnimalIcon';
const CatalogScene = lazy(() =>
  import('../scene/CatalogScene').then((m) => ({ default: m.CatalogScene })),
);
const ENTRIES = KINDS.flatMap((kind) =>
  (['seal', 'penguin', 'orca'].includes(kind) ? [false, true] : [false]).map((promoted) => ({
    kind,
    promoted,
  })),
);
class CatalogBoundary extends Component<
  { children: ReactNode; kind: Kind; promoted: boolean },
  { failed: boolean }
> {
  state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  render() {
    return this.state.failed ? (
      <div className="catalog-fallback">
        <AnimalIcon kind={this.props.kind} promoted={this.props.promoted} />
        <p>この環境では3D表示を利用できません</p>
      </div>
    ) : (
      this.props.children
    );
  }
}

export function PieceCatalog({ close, reduced }: { close: () => void; reduced: boolean }) {
  const [index, setIndex] = useState(0);
  const [rotating, setRotating] = useState(!reduced);
  const entry = ENTRIES[index];
  const [w, h] = dimensions(entry);
  const change = (delta: number) => setIndex((i) => (i + delta + ENTRIES.length) % ENTRIES.length);
  return (
    <GameDialog
      className="dialog piece-catalog"
      aria-labelledby="catalog-title"
      onDismiss={close}
      onKeyDown={(event) => {
        if (event.key === 'ArrowLeft' || event.key === 'ArrowRight') {
          event.preventDefault();
          change(event.key === 'ArrowLeft' ? -1 : 1);
        }
      }}
    >
      <header>
        <div className="dialog-title">
          <BookOpen />
          <h2 id="catalog-title">氷のなかま図鑑</h2>
        </div>
        <button className="icon-button" onClick={close} aria-label="図鑑を閉じる">
          <X />
        </button>
      </header>
      <div className="catalog-stage">
        <CatalogBoundary kind={entry.kind} promoted={entry.promoted}>
          <Suspense fallback={<div className="catalog-loading">なかまを呼んでいます…</div>}>
            <CatalogScene {...entry} rotating={rotating} reduced={reduced} />
          </Suspense>
        </CatalogBoundary>
        <button
          className="catalog-arrow catalog-previous"
          onClick={() => change(-1)}
          aria-label="前の駒"
        >
          <Triangle fill="currentColor" size={22} />
        </button>
        <button
          className="catalog-arrow catalog-next"
          onClick={() => change(1)}
          aria-label="次の駒"
        >
          <Triangle fill="currentColor" size={22} />
        </button>
        <button
          className="catalog-spin"
          onClick={() => setRotating((value) => !value)}
          aria-label={rotating ? '自動回転を止める' : '自動回転を始める'}
          aria-pressed={rotating}
        >
          {rotating ? <Pause size={15} /> : <Play size={15} />}
          <span>{rotating ? '回転中' : '回転する'}</span>
        </button>
        <span className="catalog-counter">
          {index + 1} / {ENTRIES.length}
        </span>
      </div>
      <section className="catalog-description" aria-live="polite" aria-atomic="true">
        <AnimatedValue valueKey={index}>
          <h3>{pieceName(entry)}</h3>
          <span>
            {w} × {h} マス
          </span>
          <p>{DEFINITIONS[entry.kind].description}</p>
        </AnimatedValue>
      </section>
      <p className="catalog-hint">ドラッグで好きな角度から眺められます</p>
    </GameDialog>
  );
}
