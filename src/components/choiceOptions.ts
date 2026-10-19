import type { ActionPreview, Piece, Player } from '../game/types';

/** The actions offered by the existing capture UI; rule authority stays in the engine. */
export function offeredMoveOptions(
  selected: Pick<Piece, 'kind' | 'promoted'> | undefined,
  moves: ActionPreview[],
) {
  const preferred =
    selected?.kind === 'seal' && !selected.promoted && moves.some((p) => p.piece.promoted)
      ? moves.filter((p) => p.piece.promoted)
      : moves;
  return preferred[0]?.captured.some((piece) => piece.kind === 'walrus')
    ? preferred.slice(0, 1)
    : preferred;
}

export function requiresChoice(options: ActionPreview[], human: Player) {
  return (
    options.length > 1 ||
    !!options[0]?.captured.some((piece) => piece.kind === 'walrus' && piece.owner === human)
  );
}
