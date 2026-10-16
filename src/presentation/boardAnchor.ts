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
