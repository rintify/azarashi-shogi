import { describe, expect, it } from 'vitest';
import { createGame, legalPreviews, applyPreview } from '../game/engine';
import { offeredMoveOptions, requiresChoice } from './choiceOptions';

describe('capture UI offers', () => {
  it('retains confirmation before a player captures their own king', () => {
    let game = createGame();
    for (const kind of ['penguin', 'seal'] as const) {
      const placement = legalPreviews(game).find(
        (p) =>
          p.action.type === 'place' &&
          p.action.kind === kind &&
          p.piece.at.x === 4 &&
          p.piece.at.y === (kind === 'penguin' ? 7 : 2),
      )!;
      game = applyPreview(game, placement);
    }
    const raw = legalPreviews(game).filter(
      (p) =>
        p.action.type === 'move' &&
        p.piece.kind === 'penguin' &&
        p.captured.some((v) => v.kind === 'walrus' && v.owner === game.turn),
    );
    expect(raw.length).toBeGreaterThan(0);
    const offered = offeredMoveOptions(
      game.pieces.find((p) => p.id === raw[0].piece.id),
      raw,
    );
    expect(offered).toHaveLength(1);
    expect(requiresChoice(offered, game.turn)).toBe(true);
    expect(requiresChoice(offered, game.turn === 'south' ? 'north' : 'south')).toBe(false);
  });
});
