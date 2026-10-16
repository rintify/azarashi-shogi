import { KINDS } from './pieces';
import type { GameState } from './types';

/** Board identity for repetition analysis; interchangeable piece IDs and move numbers do not matter. */
export function positionIdentity(state: GameState): string {
  const pieces = state.pieces
    .map((piece) => `${piece.owner}:${piece.kind}:${+piece.promoted}:${piece.at.x},${piece.at.y}`)
    .sort()
    .join(';');
  const stocks = (['south', 'north'] as const)
    .map((side) => KINDS.map((kind) => state.stocks[side][kind]).join(','))
    .join('/');
  return `${state.phase}/${state.turn}/${pieces}/${stocks}`;
}
