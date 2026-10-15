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
  onCell,
  onHover,
}: {
  game: GameState;
  human: Player;
  legalCells: Cell[];
  onCell: (cell: Cell) => void;
  onHover: (cell: Cell) => void;
}) {
  return (
    <div className="coordinate-board" aria-label="マス一覧で操作">
      {Array.from({ length: 100 }, (_, index) => {
        const i = human === 'south' ? index : 99 - index;
        const cell = { x: i % 10, y: Math.floor(i / 10) };
        const piece = pieceAt(game, cell);
        const legal = legalCells.some((c) => sameCell(c, cell));
        return (
          <button
            key={i}
            className={`${legal ? 'legal' : ''} ${piece ? (piece.owner === human ? 'own' : 'enemy') : ''}`}
            aria-label={`${coordinate(cell)}${piece ? ` ${pieceName(piece)}` : ''}${legal ? ' 選択可能' : ''}`}
            onClick={() => onCell(cell)}
            onFocus={() => onHover(cell)}
            onMouseEnter={() => onHover(cell)}
          >
            {piece ? <AnimalIcon kind={piece.kind} promoted={piece.promoted} /> : coordinate(cell)}
          </button>
        );
      })}
    </div>
  );
}
