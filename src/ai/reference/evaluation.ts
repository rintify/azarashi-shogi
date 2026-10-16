import { legalPreviews, moveCells } from '../../game/engine';
import { DEFINITIONS, KINDS } from '../../game/pieces';
import { otherPlayer, type GameState, type Piece, type Player } from '../../game/types';

export interface PositionEvaluation {
  score: number;
  kingInDanger: boolean;
  canWinImmediately: boolean;
}

/** Score and tactical facts share the same complete capture analysis, including L rotations. */
export function evaluatePosition(state: GameState, root: Player): PositionEvaluation {
  let score = 0;
  let kingInDanger = false;
  let canWinImmediately = false;
  for (const side of [root, otherPlayer(root)]) {
    const sign = side === root ? 1 : -1;
    for (const kind of KINDS)
      if (kind !== 'walrus')
        score += sign * state.stocks[side][kind] * DEFINITIONS[kind].value * 0.72;
    for (const piece of state.pieces)
      if (piece.owner === side) {
        const center = 9 - Math.abs(piece.at.x - 4.5) - Math.abs(piece.at.y - 4.5);
        score +=
          sign *
          (DEFINITIONS[piece.kind].value +
            (piece.promoted && piece.kind === 'seal'
              ? 145
              : piece.promoted && piece.kind === 'penguin'
                ? 30
                : 0) +
            center * (piece.kind === 'walrus' ? 0.8 : 2.3) +
            moveCells(state, piece).length * 1.5);
      }
    const attacker = otherPlayer(side);
    const threatened = new Map<string, Piece>();
    for (const move of legalPreviews({ ...state, turn: attacker }, false)) {
      for (const victim of move.captured)
        if (victim.owner === side) threatened.set(victim.id, victim);
      if (
        attacker === state.turn &&
        move.captured.some((piece) => piece.owner === side && piece.kind === 'walrus') &&
        !move.captured.some((piece) => piece.owner === attacker && piece.kind === 'walrus')
      )
        canWinImmediately = true;
    }
    for (const target of threatened.values()) {
      const cost =
        target.kind === 'walrus'
          ? state.turn === side
            ? 17000
            : 35000
          : DEFINITIONS[target.kind].value * 0.18;
      score -= sign * cost;
      if (target.kind === 'walrus' && state.turn === side) kingInDanger = true;
    }
  }
  return { score, kingInDanger, canWinImmediately };
}
