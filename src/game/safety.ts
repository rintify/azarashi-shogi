import { applyPreview, getThreats } from './engine';
import { otherPlayer } from './types';
import type { ActionPreview, GameState } from './types';

export interface ActionSafety {
  unsafe: boolean;
  pieceThreatened: boolean;
  kingThreatened: boolean;
  losesGame: boolean;
}

/** Assess a complete action after all captures and transformations, using actual enemy replies. */
export function actionSafety(state: GameState, preview: ActionPreview): ActionSafety {
  const next = applyPreview(state, preview);
  const owner = preview.piece.owner;
  const losesGame = next.phase === 'finished' && next.result?.winner === otherPlayer(owner);
  if (next.phase === 'finished')
    return { unsafe: losesGame, pieceThreatened: false, kingThreatened: false, losesGame };
  const threatened = new Set(getThreats(next, owner).map((threat) => threat.targetId));
  const pieceThreatened = threatened.has(preview.piece.id);
  const kingThreatened = next.pieces.some(
    (piece) => piece.owner === owner && piece.kind === 'walrus' && threatened.has(piece.id),
  );
  return {
    unsafe: pieceThreatened || kingThreatened,
    pieceThreatened,
    kingThreatened,
    losesGame: false,
  };
}
