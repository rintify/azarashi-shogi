import type { SearchInput } from './protocol';
import { positionIdentity } from '../game/position';

/** Exact reuse includes identities, revision, profile, entropy and repetition context. */
export function searchIdentity(input: SearchInput): string {
  return JSON.stringify({
    position: positionIdentity(input.state),
    rules: input.state.rulesVersion,
    revision: input.state.revision,
    pieces: input.state.pieces
      .map((p) => [p.id, p.kind, p.owner, p.promoted, p.at.x, p.at.y])
      .sort(),
    result: input.state.result,
    difficulty: input.difficulty,
    seed: input.seed,
    history: input.positionHistory,
  });
}
