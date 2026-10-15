import { createGame, moveCells } from '../game/engine';
import { footprint } from '../game/pieces';
import type { Piece } from '../game/types';
export function MovementDiagram({ piece }: { piece: Piece }) {
  const sample = { ...piece, at: { x: 4, y: 4 }, owner: 'south' as const };
  const state = { ...createGame(), phase: 'playing' as const, pieces: [sample] };
  const moves = moveCells(state, sample);
  const body = footprint(sample);
  const jet = piece.kind === 'penguin' && piece.promoted;
  return <div className="movement-diagram" aria-label="移動範囲の図。上が前方です">
    {Array.from({ length: 49 }, (_, i) => {
      const x = i % 7 + 1, y = Math.floor(i / 7) + 1;
      const current = body.some(c => c.x === x && c.y === y);
      const legal = moves.some(c => c.x === x && c.y === y) || (jet && x === 4 && y < 4);
      return <span key={i} className={current ? 'body-cell' : legal ? 'move-cell' : ''}>{current ? '●' : legal ? (jet ? '↑' : '·') : ''}</span>;
    })}
  </div>;
}
