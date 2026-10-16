import { GUIDE_COLORS } from '../presentation/guideStyle';
import { useRef, useState, type CSSProperties } from 'react';
import { pieceAt } from '../game/engine';
import { pieceName } from '../game/pieces';
import { sameCell, type Cell, type GameState, type Player } from '../game/types';
import { AnimalIcon } from './AnimalIcon';
import { pieceMark, PieceMarkIcon, MARK_LABELS } from './PieceMark';
import { coordinate } from './coordinates';

/** Accessible alternative uses exactly the same cell intents as the 3D board. */
export function CoordinateBoard({
  game,
  human,
  legalCells,
  reachableCells = [],
  inspectingEnemy = false,
  unsafeCells = [],
  kingCaptureIds = [],
  helperIds = [],
  threatenedIds = [],
  kingDangerCells = [],
  onCell,
  onHover,
}: {
  game: GameState;
  human: Player;
  legalCells: Cell[];
  reachableCells?: Cell[];
  inspectingEnemy?: boolean;
  unsafeCells?: Cell[];
  kingCaptureIds?: string[];
  helperIds?: string[];
  threatenedIds?: string[];
  kingDangerCells?: Cell[];
  onCell: (cell: Cell) => void;
  onHover: (cell: Cell) => void;
}) {
  const [focused, setFocused] = useState(0);
  const ref = useRef<HTMLDivElement>(null);
  return (
    <div
      ref={ref}
      className={`coordinate-board ${inspectingEnemy ? 'inspecting-enemy' : ''}`}
      aria-label="マス一覧で操作"
      style={
        {
          '--danger-color': GUIDE_COLORS.danger,
          '--king-danger-color': GUIDE_COLORS.kingDanger,
          '--enemy-guide-color': GUIDE_COLORS.enemy,
        } as CSSProperties
      }
    >
      {Array.from({ length: 100 }, (_, index) => {
        const i = human === 'south' ? index : 99 - index;
        const cell = { x: i % 10, y: Math.floor(i / 10) };
        const piece = pieceAt(game, cell);
        const legal = legalCells.some((c) => sameCell(c, cell));
        const reachable = reachableCells.some((c) => sameCell(c, cell));
        const unsafe = !inspectingEnemy && unsafeCells.some((c) => sameCell(c, cell));
        const kingCapture = game.turn === human && !!piece && kingCaptureIds.includes(piece.id);
        const kingDanger = !inspectingEnemy && kingDangerCells.some((c) => sameCell(c, cell));
        const mark =
          game.turn === human && piece
            ? pieceMark(kingCapture, helperIds.includes(piece.id), threatenedIds.includes(piece.id))
            : null;
        return (
          <button
            key={i}
            data-index={index}
            tabIndex={index === focused ? 0 : -1}
            onKeyDown={(event) => {
              const offsets: Record<string, number> = {
                ArrowLeft: -1,
                ArrowRight: 1,
                ArrowUp: -10,
                ArrowDown: 10,
              };
              if (!(event.key in offsets)) return;
              event.preventDefault();
              const next = Math.max(0, Math.min(99, index + offsets[event.key]));
              setFocused(next);
              ref.current
                ?.querySelector<HTMLButtonElement>(`button[data-index="${next}"]`)
                ?.focus();
            }}
            className={`${reachable ? 'reachable' : ''} ${unsafe ? 'unsafe' : ''} ${kingDanger ? 'king-risk' : ''} ${legal && !inspectingEnemy ? 'legal' : ''} ${piece ? (piece.owner === human ? 'own' : 'enemy') : ''}`}
            aria-label={`${coordinate(cell)}${piece ? ` ${pieceName(piece)}` : ''}${legal ? (inspectingEnemy ? ' 敵の移動範囲' : ' 選択可能') : ''}${unsafe ? ' 捕食の危険' : ''}${mark ? ` ${MARK_LABELS[mark]}` : ''}${kingDanger ? ' 王が捕食される危険' : ''}`}
            onClick={() => onCell(cell)}
            onFocus={() => {
              setFocused(index);
              onHover(cell);
            }}
            onMouseEnter={() => onHover(cell)}
          >
            {piece ? <AnimalIcon kind={piece.kind} promoted={piece.promoted} /> : null}
            {mark && (
              <span
                className={`coordinate-mark ${mark === 'king' ? 'king-capture-badge' : mark === 'helper' ? 'helper-badge' : ''}`}
                aria-hidden="true"
              >
                <PieceMarkIcon mark={mark} size={13} />
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}
