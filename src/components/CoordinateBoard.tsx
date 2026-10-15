import { GUIDE_COLORS } from '../presentation/guideStyle';
import { useRef, useState, type CSSProperties } from 'react';
import { pieceAt } from '../game/engine';
import { pieceName } from '../game/pieces';
import { sameCell, type Cell, type GameState, type Player } from '../game/types';
import { AnimalIcon } from './AnimalIcon';
import { coordinate } from './coordinates';

/** Accessible alternative uses exactly the same cell intents as the 3D board. */
export function CoordinateBoard({
  game,
  human,
  legalCells,
  reachableCells = [],
  unsafeCells = [],
  onCell,
  onHover,
}: {
  game: GameState;
  human: Player;
  legalCells: Cell[];
  reachableCells?: Cell[];
  unsafeCells?: Cell[];
  onCell: (cell: Cell) => void;
  onHover: (cell: Cell) => void;
}) {
  const [focused, setFocused] = useState(0);
  const ref = useRef<HTMLDivElement>(null);
  return (
    <div
      ref={ref}
      className="coordinate-board"
      aria-label="マス一覧で操作"
      style={{ '--danger-color': GUIDE_COLORS.danger } as CSSProperties}
    >
      {Array.from({ length: 100 }, (_, index) => {
        const i = human === 'south' ? index : 99 - index;
        const cell = { x: i % 10, y: Math.floor(i / 10) };
        const piece = pieceAt(game, cell);
        const legal = legalCells.some((c) => sameCell(c, cell));
        const reachable = reachableCells.some((c) => sameCell(c, cell));
        const unsafe = unsafeCells.some((c) => sameCell(c, cell));
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
            className={`${reachable ? 'reachable' : ''} ${unsafe ? 'unsafe' : ''} ${legal ? 'legal' : ''} ${piece ? (piece.owner === human ? 'own' : 'enemy') : ''}`}
            aria-label={`${coordinate(cell)}${piece ? ` ${pieceName(piece)}` : ''}${legal ? ' 選択可能' : ''}${unsafe ? ' 捕食の危険' : ''}`}
            onClick={() => onCell(cell)}
            onFocus={() => {
              setFocused(index);
              onHover(cell);
            }}
            onMouseEnter={() => onHover(cell)}
          >
            {piece ? <AnimalIcon kind={piece.kind} promoted={piece.promoted} /> : coordinate(cell)}
          </button>
        );
      })}
    </div>
  );
}
