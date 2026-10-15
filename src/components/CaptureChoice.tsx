import { useState } from 'react';
import { ArrowRight, ChevronLeft, ChevronRight, Info, X } from 'lucide-react';
import type { ActionPreview, Player } from '../game/types';
import { dimensions, pieceName } from '../game/pieces';
import { CaptureDetails } from './CaptureDetails';
import { AnimalIcon } from './AnimalIcon';
import { coordinate } from './coordinates';
import type { BoardInteraction } from './useBoardInteraction';

export function CaptureChoice({
  human,
  interaction,
}: {
  human: Player;
  interaction: BoardInteraction;
}) {
  const { pending, optionIndex, setOptionIndex, clearChoice, chooseOption } = interaction;
  const [detailsOpen, setDetailsOpen] = useState(false);
  const option = pending?.[optionIndex];
  if (!pending || !option) return null;
  const ownKing = option.captured.some((p) => p.kind === 'walrus' && p.owner === human);
  const bothKings =
    ownKing && option.captured.some((p) => p.kind === 'walrus' && p.owner !== human);
  return (
    <aside className="action-dock is-confirming" aria-label="対局の操作">
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
            : `相手 ${option.captured.filter((p) => p.owner !== human).length}体・味方 ${option.captured.filter((p) => p.owner === human).length}体を捕食`}
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
          human={human}
          close={() => setDetailsOpen(false)}
        />
      )}
      <button className="primary-button full confirm-move" onClick={() => chooseOption(option)}>
        {pending.length > 1 ? (optionIndex > 0 ? '変身して着地' : 'このまま着地') : 'この手を指す'}{' '}
        <ArrowRight size={18} />
      </button>
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
