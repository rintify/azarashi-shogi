import { applyPreview, legalPreviews } from './engine';
import { otherPlayer } from './types';
import type { ActionPreview, GameState, Player } from './types';

export interface ActionSafety {
  unsafe: boolean;
  pieceThreatened: boolean;
  kingThreatened: boolean;
  losesGame: boolean;
  /** Only the enemy king can eat this piece, and every such capture allows an immediate win. */
  kingCaptureTrap: boolean;
}

/** All king landing footprints must be punishable, not just one convenient reply. */
function kingCapturesAreTrapped(
  next: GameState,
  captures: ActionPreview[],
  owner: Player,
): boolean {
  if (!captures.length || captures.some((reply) => reply.piece.kind !== 'walrus')) return false;
  if (!next.pieces.some((piece) => piece.owner === owner && piece.kind === 'walrus')) return false;
  return captures.every((reply) => {
    const afterCapture = applyPreview(next, reply);
    // A capture ending the match cannot be answered, even if a defender's range covers the king.
    if (afterCapture.phase !== 'playing') return false;
    return legalPreviews(afterCapture, false).some(
      (counter) =>
        counter.captured.some((piece) => piece.id === reply.piece.id) &&
        applyPreview(afterCapture, counter).result?.winner === owner,
    );
  });
}

/** Assess a complete action after all captures and transformations, using actual enemy replies. */
export function actionSafety(state: GameState, preview: ActionPreview): ActionSafety {
  const next = applyPreview(state, preview);
  const owner = preview.piece.owner;
  const losesGame = next.phase === 'finished' && next.result?.winner === otherPlayer(owner);
  if (next.phase === 'finished')
    return {
      unsafe: losesGame,
      pieceThreatened: false,
      kingThreatened: false,
      losesGame,
      kingCaptureTrap: false,
    };
  const replies = legalPreviews(next, false);
  const pieceCaptures = replies.filter((reply) =>
    reply.captured.some((piece) => piece.id === preview.piece.id),
  );
  const pieceThreatened = pieceCaptures.length > 0;
  const kingThreatened = replies.some((reply) =>
    reply.captured.some((piece) => piece.owner === owner && piece.kind === 'walrus'),
  );
  return {
    unsafe: pieceThreatened || kingThreatened,
    pieceThreatened,
    kingThreatened,
    losesGame: false,
    kingCaptureTrap:
      !kingThreatened &&
      preview.piece.kind !== 'walrus' &&
      kingCapturesAreTrapped(next, pieceCaptures, owner),
  };
}
