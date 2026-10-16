import { getThreats, moveCells, moveOptions } from './engine';
import { actionSafety } from './safety';
import type { ActionPreview, GameState, Player } from './types';

/** Find rescuers only when a threatened king has no safe move of its own. */
export function kingRescuers(state: GameState, owner: Player): string[] {
  if (state.phase !== 'playing' || state.turn !== owner) return [];
  const king = state.pieces.find((piece) => piece.owner === owner && piece.kind === 'walrus');
  if (!king || !getThreats(state, owner).some((threat) => threat.targetId === king.id)) return [];
  const savesKing = (preview: ActionPreview) => {
    if (preview.captured.some((piece) => piece.id === king.id)) return false;
    const safety = actionSafety(state, preview);
    return !safety.kingThreatened && !safety.losesGame;
  };
  const canSaveKing = (piece: typeof king) =>
    moveCells(state, piece).some((at) => moveOptions(state, piece, at).some(savesKing));
  if (canSaveKing(king)) return [];
  return state.pieces
    .filter((piece) => piece.owner === owner && piece.id !== king.id && canSaveKing(piece))
    .map((piece) => piece.id);
}
