import { useState } from 'react';
import { CaptureDetails } from './CaptureDetails';
import { ArrowRight, Check, ChevronLeft, ChevronRight, Info, X } from 'lucide-react';
import type { ActionPreview, GameState } from '../game/types';
import { DEFINITIONS, dimensions, KINDS, pieceName } from '../game/pieces';
import type { MatchSettings } from '../match/record';
import { AnimalIcon } from './AnimalIcon';
import type { BoardInteraction } from './useBoardInteraction';
import { coordinate } from './coordinates';
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
  const {
    activeKind,
    humanTurn,
    setup,
    selectStock,
    pending,
    optionIndex,
    setOptionIndex,
    clearChoice,
    clearSelection,
    portrait,
    threat,
    chooseOption,
  } = interaction;
  const [detailsOpen, setDetailsOpen] = useState(false);
  const status = statusCopy(game, settings.human, interaction);
  const option = pending?.[optionIndex];
  const ownKing = option?.captured.some((p) => p.kind === 'walrus' && p.owner === settings.human);
  const bothKings =
    ownKing && option?.captured.some((p) => p.kind === 'walrus' && p.owner !== settings.human);
  const dangerSources = threat?.attackerIds
    .flatMap((id) => {
      const p = game.pieces.find((p) => p.id === id);
      return p ? [pieceName(p)] : [];
    })
    .join('・');

  return (
    <aside className={`action-dock ${pending ? 'is-confirming' : ''}`} aria-label="対局の操作">
      {pending && option ? (
        <>
          <div className="dock-heading">
            <div>
              <span className="step-label">移動の確認</span>
              <h2>{pending.length > 1 ? '変身を選択' : '自分の王を捕食します'}</h2>
            </div>
            <button
              className="icon-button"
              aria-label="移動を取り消す"
              onClick={() => {
                setDetailsOpen(false);
                clearChoice();
              }}
            >
              <X size={20} />
            </button>
          </div>
          {pending.length > 1 && (
            <div className="choice-selector" aria-label="変身の候補">
              <button
                className="icon-button"
                aria-label="前の変身候補"
                disabled={pending.length === 1}
                onClick={() => setOptionIndex((optionIndex + pending.length - 1) % pending.length)}
              >
                <ChevronLeft size={22} />
              </button>
              <div className="choice-description" aria-live="polite">
                <AnimalIcon kind={option.piece.kind} promoted={option.piece.promoted} />
                <div>
                  <strong>{transformationLabel(option, pending[0], optionIndex)}</strong>
                  <span>
                    {dimensions(option.piece).join(' × ')}マス · {option.captured.length}体を捕食
                  </span>
                </div>
              </div>
              <button
                className="icon-button"
                aria-label="次の変身候補"
                disabled={pending.length === 1}
                onClick={() => setOptionIndex((optionIndex + 1) % pending.length)}
              >
                <ChevronRight size={22} />
              </button>
            </div>
          )}
          {pending.length > 1 && (
            <div className="choice-tabs" aria-label="変身を選択">
              {pending.map((p, i) => (
                <button
                  key={i}
                  aria-label={transformationLabel(p, pending[0], i)}
                  aria-pressed={optionIndex === i}
                  className={optionIndex === i ? 'active' : ''}
                  onClick={() => setOptionIndex(i)}
                >
                  {i === 0
                    ? 'そのまま'
                    : p.action.type === 'move' && p.action.transformation?.type === 'rotate'
                      ? `回転 ${i}`
                      : '変身'}
                </button>
              ))}
            </div>
          )}
          <div className="capture-line">
            <p
              className={`capture-summary ${ownKing ? 'danger' : ''}`}
              role={ownKing ? 'alert' : undefined}
            >
              {ownKing
                ? bothKings
                  ? '両方の王を捕食 → 引き分け'
                  : '自分の王を捕食 → 敗北'
                : `相手 ${option.captured.filter((p) => p.owner !== settings.human).length}体・味方 ${option.captured.filter((p) => p.owner === settings.human).length}体を捕食`}
            </p>
            <button
              className="capture-detail-button"
              aria-label="捕食する駒の内訳"
              onClick={() => setDetailsOpen(true)}
            >
              内訳 <Info size={13} />
            </button>
          </div>
          {detailsOpen && (
            <CaptureDetails
              pieces={option.captured}
              human={settings.human}
              close={() => setDetailsOpen(false)}
            />
          )}
          <button className="primary-button full confirm-move" onClick={() => chooseOption(option)}>
            この手を指す <ArrowRight size={18} />
          </button>
        </>
      ) : (
        <>
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
          <p className={`turn-instruction ${dangerSources ? 'danger' : ''}`}>
            {busy
              ? '移動が終わるまでお待ちください'
              : dangerSources
                ? `${dangerSources}に捕食される危険があります。`
                : status.text}
          </p>
          <div
            className={`reserve-grid ${setup ? 'setup-reserve' : ''}`}
            aria-label="あなたのストック"
          >
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
          <div className={`selection-note ${dangerSources ? 'danger' : ''}`} aria-live="polite">
            {dangerSources ? (
              <>
                <b>!</b>
                <span>{dangerSources}から捕食される危険あり</span>
              </>
            ) : portrait ? (
              <>
                <AnimalIcon kind={portrait.kind} promoted={portrait.promoted} />
                <span>
                  <strong>{pieceName(portrait)}</strong>
                  <small>
                    {setup ? '緑のマスをタップして配置' : DEFINITIONS[portrait.kind].description}
                  </small>
                </span>
              </>
            ) : (
              <>
                <Check size={16} />
                <span>盤上の仲間を動かすか、ストックから配置</span>
              </>
            )}
          </div>
        </>
      )}
    </aside>
  );
}

function transformationLabel(
  preview: ActionPreview,
  landing: ActionPreview,
  index: number,
): string {
  if (index === 0) return 'そのまま進む';
  const action = preview.action;
  if (action.type === 'move' && action.transformation?.type === 'rotate') {
    const { direction, pivot } = action.transformation;
    return `${direction === 1 ? '右' : '左'}回転 · 軸 ${coordinate(landing.footprint[pivot])}`;
  }
  return pieceName(preview.piece);
}
