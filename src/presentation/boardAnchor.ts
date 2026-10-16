import { dimensions } from '../game/pieces';
import type { Cell, Piece, Player } from '../game/types';

/** The same visible top-left corner is used from either player's side of the board. */
export function displayAnchor(
  at: Cell,
  body: Pick<Piece, 'kind' | 'promoted'>,
  viewer: Player,
): Cell {
  const [width, height] = dimensions(body);
  return viewer === 'north' ? { x: at.x + width - 1, y: at.y + height - 1 } : at;
}

/** One status badge at the visible top-right, including pieces occupying several cells. */
export function markerCell(piece: Pick<Piece, 'kind' | 'promoted' | 'at'>, viewer: Player): Cell {
  const [width, height] = dimensions(piece);
  return viewer === 'north'
    ? { x: piece.at.x, y: piece.at.y + height - 1 }
    : { x: piece.at.x + width - 1, y: piece.at.y };
}
