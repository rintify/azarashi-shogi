import { CaptureChoice } from './CaptureChoice';
import { Info, X } from 'lucide-react';
import type { GameState } from '../game/types';
import { DEFINITIONS, KINDS, pieceName } from '../game/pieces';
import type { MatchSettings } from '../match/record';
import { AnimalIcon } from './AnimalIcon';
import type { BoardInteraction } from './useBoardInteraction';
import { statusCopy } from './statusCopy';

interface Props {
  game: GameState;
  settings: MatchSettings;
  interaction: BoardInteraction;
  onHelp: () => void;
  busy?: boolean;
}

/** A fixed-size turn control surface: stock and selection give way to capture confirmation. */
export function ActionDock({ game, settings, interaction, onHelp, busy = false }: Props) {
  const { activeKind, humanTurn, setup, selectStock, pending, clearSelection, threat } =
    interaction;
  const status = statusCopy(game, settings.human, interaction);
  const dangerSources =
    threat?.attackerIds.flatMap((id) => {
      const p = game.pieces.find((p) => p.id === id);
      return p ? [pieceName(p)] : [];
    }) ?? [];
  const dangerText =
    dangerSources.length === 1
      ? `${dangerSources[0]}に捕食される危険があります。`
      : `相手${dangerSources.length}体に狙われています。橙の枠で相手を確認。`;

  if (pending) return <CaptureChoice human={settings.human} interaction={interaction} />;
  return (
    <aside className={`action-dock ${pending ? 'is-confirming' : ''}`} aria-label="対局の操作">
      <div className="dock-heading">
        <div className="turn-copy" aria-live="polite">
          <span className="step-label">
            {busy
              ? '移動中'
              : setup
                ? 'まずは王を配置'
                : humanTurn
                  ? 'あなたの手番'
                  : game.phase === 'finished'
                    ? '対局終了'
                    : '相手の手番'}
          </span>
          <h2>
            {busy
              ? `${game.lastAction?.piece.owner === settings.human ? 'あなた' : 'NPC'}の一手`
              : status.title}
          </h2>
        </div>
        <div className="dock-actions">
          {(interaction.selected || (activeKind && !setup)) && !busy && (
            <button className="icon-button" aria-label="選択を解除" onClick={clearSelection}>
              <X size={19} />
            </button>
          )}
          <button className="icon-button" aria-label="駒の動かし方" onClick={onHelp}>
            <Info size={18} />
          </button>
        </div>
      </div>
      <p className={`turn-instruction ${dangerSources.length ? 'danger' : ''}`}>
        {busy ? '移動が終わるまでお待ちください' : dangerSources.length ? dangerText : status.text}
      </p>
      <div className={`reserve-grid ${setup ? 'setup-reserve' : ''}`} aria-label="あなたのストック">
        {KINDS.filter((kind) => kind !== 'walrus' || setup).map((kind) => (
          <button
            key={kind}
            disabled={!humanTurn || setup || game.stocks[settings.human][kind] === 0}
            className={activeKind === kind ? 'selected' : ''}
            aria-pressed={activeKind === kind}
            onClick={() => selectStock(kind)}
            aria-label={`${DEFINITIONS[kind].name}を配置 残り${game.stocks[settings.human][kind]}体`}
          >
            <AnimalIcon kind={kind} />
            <span className="stock-count">{game.stocks[settings.human][kind]}</span>
            <span>{DEFINITIONS[kind].short}</span>
          </button>
        ))}
      </div>
    </aside>
  );
}
