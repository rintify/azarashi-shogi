import { useEffect, useId, useRef, useState } from 'react';
import { CaptureChoice } from './CaptureChoice';
import { ChevronUp, Info, X } from 'lucide-react';
import type { GameState } from '../game/types';
import { DEFINITIONS, KINDS } from '../game/pieces';
import type { MatchSettings } from '../match/record';
import { AnimalIcon } from './AnimalIcon';
import { StockItems } from './OpponentBar';
import type { BoardInteraction } from './useBoardInteraction';

interface Props {
  game: GameState;
  settings: MatchSettings;
  interaction: BoardInteraction;
  onHelp: () => void;
  busy?: boolean;
}

/** The persistent stock strip never changes size; its chooser overlays the world. */
export function ActionDock({ game, settings, interaction, onHelp, busy = false }: Props) {
  const { activeKind, humanTurn, selectStock, pending, clearSelection } = interaction;
  const [expanded, setExpanded] = useState(false);
  const root = useRef<HTMLElement>(null);
  const toggle = useRef<HTMLButtonElement>(null);
  const trayId = useId();
  useEffect(() => setExpanded(false), [game.revision, settings.human, busy]);
  useEffect(() => {
    if (!expanded) return;
    function outside(event: PointerEvent) {
      if (!root.current?.contains(event.target as Node)) setExpanded(false);
    }
    function escape(event: KeyboardEvent) {
      if (event.key !== 'Escape' || document.querySelector('dialog[open]')) return;
      event.stopPropagation();
      setExpanded(false);
      toggle.current?.focus({ preventScroll: true });
    }
    document.addEventListener('pointerdown', outside, true);
    document.addEventListener('keydown', escape, true);
    return () => {
      document.removeEventListener('pointerdown', outside, true);
      document.removeEventListener('keydown', escape, true);
    };
  }, [expanded]);
  if (pending) return <CaptureChoice human={settings.human} interaction={interaction} />;
  const hasSelection = !!(interaction.selected || activeKind);
  return (
    <aside ref={root} className="reserve-dock" aria-label="対局の操作">
      <button
        ref={toggle}
        className="reserve-toggle"
        disabled={busy}
        aria-label={expanded ? '持ち駒を閉じる' : '持ち駒を開く'}
        aria-expanded={expanded}
        aria-controls={trayId}
        onClick={() => setExpanded((open) => !open)}
      >
        <span className="reserve-label">持ち駒</span>
        <StockItems game={game} player={settings.human} activeKind={activeKind} />
        <ChevronUp size={15} className={expanded ? 'is-open' : ''} />
      </button>
      {hasSelection && !busy && (
        <button className="reserve-clear" aria-label="選択を解除" onClick={clearSelection}>
          <X size={17} />
        </button>
      )}
      {expanded && (
        <section className="reserve-tray action-dock" id={trayId} aria-label="配置する持ち駒">
          <div className="dock-heading">
            <h2>配置する駒を選択</h2>
            <div className="dock-actions">
              <button
                className="icon-button"
                aria-label="駒の動かし方"
                onClick={() => {
                  setExpanded(false);
                  onHelp();
                }}
              >
                <Info size={18} />
              </button>
              <button
                className="icon-button"
                aria-label="持ち駒の選択を閉じる"
                onClick={() => {
                  setExpanded(false);
                  toggle.current?.focus({ preventScroll: true });
                }}
              >
                <X size={18} />
              </button>
            </div>
          </div>
          <div className="reserve-grid" aria-label="あなたのストック">
            {KINDS.filter((kind) => kind !== 'walrus').map((kind) => (
              <button
                key={kind}
                disabled={!humanTurn || game.stocks[settings.human][kind] === 0}
                className={activeKind === kind ? 'selected' : ''}
                aria-pressed={activeKind === kind}
                aria-label={`${DEFINITIONS[kind].name}を配置 残り${game.stocks[settings.human][kind]}体`}
                onClick={() => {
                  if (activeKind !== kind) selectStock(kind);
                  setExpanded(false);
                  toggle.current?.focus({ preventScroll: true });
                }}
              >
                <AnimalIcon kind={kind} />
                <span className="stock-count">{game.stocks[settings.human][kind]}</span>
                <span>{DEFINITIONS[kind].short}</span>
              </button>
            ))}
          </div>
        </section>
      )}
    </aside>
  );
}
