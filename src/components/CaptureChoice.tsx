import { ArrowUp, Sparkles, X } from 'lucide-react';
import { HEADING_LABEL, HEADING_VECTOR, jetHeading } from '../game/headings';
import type { ActionPreview, Player } from '../game/types';
import { sameCell } from '../game/types';
import { coordinate } from './coordinates';
import type { BoardInteraction } from './useBoardInteraction';

/** A live board preview carries the explanation; only the decisions remain in the HUD. */
export function CaptureChoice({
  human,
  interaction,
}: {
  human: Player;
  interaction: BoardInteraction;
}) {
  const { pending, optionIndex, setOptionIndex, clearChoice, chooseOption } = interaction;
  if (!pending?.length) return null;
  const choice = pending[optionIndex];
  const transformIndex = optionIndex > 0 ? optionIndex : 1;
  const transform = pending[transformIndex];
  const ownKing = choice.captured.some((p) => p.kind === 'walrus' && p.owner === human);
  const bothKings =
    ownKing && choice.captured.some((p) => p.kind === 'walrus' && p.owner !== human);
  const rotations =
    pending[1]?.action.type === 'move' && pending[1].action.transformation?.type === 'rotate';
  const jetDirections =
    pending[0].piece.kind === 'penguin' && !pending[0].piece.promoted && pending.length > 1;
  return (
    <aside className="promotion-controls" aria-label="対局の操作">
      {jetDirections && (
        <div className="rotation-choices" role="group" aria-label="ジェットの向きを選択">
          {pending.slice(1).map((candidate, i) => {
            const heading = jetHeading(candidate.piece);
            const vector = HEADING_VECTOR[heading];
            const angle =
              (Math.atan2(vector.y, vector.x) * 180) / Math.PI + 90 + (human === 'north' ? 180 : 0);
            return (
              <button
                key={heading}
                className="rotation-choice"
                aria-label={`ジェットの向き：${HEADING_LABEL[heading]}`}
                aria-pressed={optionIndex === i + 1}
                data-danger={interaction.pendingSafety[i + 1]?.unsafe || undefined}
                onClick={() => setOptionIndex(i + 1)}
              >
                <ArrowUp
                  size={28}
                  style={{ transform: `rotate(${angle}deg)` }}
                  aria-hidden="true"
                />
              </button>
            );
          })}
        </div>
      )}
      {rotations && (
        <div className="rotation-choices" role="group" aria-label="シャチの向きを選択">
          {pending.slice(1).map((candidate, i) => (
            <button
              key={i}
              className="rotation-choice"
              data-danger={interaction.pendingSafety[i + 1]?.unsafe || undefined}
              aria-label={`${rotationLabel(candidate, pending[0])}${interaction.pendingSafety[i + 1]?.unsafe ? '・捕食の危険' : ''}`}
              aria-pressed={optionIndex === i + 1}
              onClick={() => setOptionIndex(i + 1)}
            >
              <RotationShape candidate={candidate} options={pending} human={human} />
            </button>
          ))}
        </div>
      )}
      {ownKing && (
        <p className="promotion-warning" role="alert">
          {pending.length === 1 && <strong>自分の王を捕食します</strong>}
          {bothKings ? '両方の王を捕食 → 引き分け' : '自分の王を捕食 → 敗北'}
        </p>
      )}
      <div className="promotion-actions">
        {pending.length > 1 ? (
          <>
            <button
              className="promotion-button keep-button"
              data-danger={interaction.pendingSafety[0]?.unsafe || undefined}
              onClick={() => chooseOption(pending[0])}
            >
              そのまま
            </button>
            <button
              className="promotion-button evolve-button"
              data-danger={interaction.pendingSafety[transformIndex]?.unsafe || undefined}
              onClick={() => chooseOption(transform)}
            >
              <Sparkles size={21} />
              成る
            </button>
          </>
        ) : (
          <button className="promotion-button evolve-button" onClick={() => chooseOption(choice)}>
            この手を指す
          </button>
        )}
        <button className="promotion-cancel" aria-label="移動を取り消す" onClick={clearChoice}>
          <X size={20} />
        </button>
      </div>
    </aside>
  );
}

function rotationLabel(candidate: ActionPreview, landing: ActionPreview) {
  const action = candidate.action;
  if (action.type !== 'move' || action.transformation?.type !== 'rotate') return '';
  const { direction, pivot } = action.transformation;
  return `${direction === 1 ? '右' : '左'}回転 · 軸 ${coordinate(landing.footprint[pivot])}`;
}

/** Every thumbnail uses the same board coordinates, so all four pivots compare directly. */
function RotationShape({
  candidate,
  options,
  human,
}: {
  candidate: ActionPreview;
  options: ActionPreview[];
  human: Player;
}) {
  const cells = options.flatMap((p) => p.captureCells);
  const minX = Math.min(...cells.map((c) => c.x));
  const maxX = Math.max(...cells.map((c) => c.x));
  const minY = Math.min(...cells.map((c) => c.y));
  const maxY = Math.max(...cells.map((c) => c.y));
  const action = candidate.action;
  const pivot =
    action.type === 'move' && action.transformation?.type === 'rotate'
      ? options[0].footprint[action.transformation.pivot]
      : null;
  const size = 15;
  const width = (maxX - minX + 1) * size;
  const height = (maxY - minY + 1) * size;
  return (
    <svg viewBox="0 0 64 52" aria-hidden="true">
      <g
        transform={`translate(32 26) rotate(${human === 'north' ? 180 : 0}) translate(${-width / 2} ${-height / 2})`}
      >
        {options[0].footprint.map((cell) => (
          <rect
            key={`old-${cell.x},${cell.y}`}
            x={(cell.x - minX) * size + 1}
            y={(cell.y - minY) * size + 1}
            width="13"
            height="13"
            rx="4"
            fill="none"
            stroke="currentColor"
            strokeDasharray="2 2"
            opacity=".4"
          />
        ))}
        {candidate.footprint.map((cell) => (
          <rect
            key={`${cell.x},${cell.y}`}
            x={(cell.x - minX) * size + 1}
            y={(cell.y - minY) * size + 1}
            width="13"
            height="13"
            rx="4"
            fill="currentColor"
          />
        ))}
        {pivot && candidate.footprint.some((c) => sameCell(c, pivot)) && (
          <circle
            cx={(pivot.x - minX) * size + 7.5}
            cy={(pivot.y - minY) * size + 7.5}
            r="3"
            fill="#fff0a6"
          />
        )}
      </g>
    </svg>
  );
}
