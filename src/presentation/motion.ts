import type { ActionPreview, GameState, Piece } from '../game/types';
import { dimensions, footprint } from '../game/pieces';
export type Vec3 = [number, number, number];
export interface MoveMotion {
  before: Piece | null;
  action: ActionPreview;
  startedAt: number;
  duration: number;
  reduced: boolean;
}
export const clamp = (n: number) => Math.max(0, Math.min(1, n));
export const smooth = (n: number) => {
  const t = clamp(n);
  return t * t * (3 - 2 * t);
};
export function center(piece: Pick<Piece, 'at' | 'kind' | 'promoted'>): Vec3 {
  const [w, h] = dimensions(piece);
  return [piece.at.x - 5 + w / 2, 0, piece.at.y - 5 + h / 2];
}
/** Models are authored facing local +Z. Board south advances toward world -Z. */
export function facing(piece: Pick<Piece, 'owner' | 'kind' | 'promoted'>): number {
  return (
    (piece.owner === 'south' ? Math.PI : 0) -
    (piece.kind === 'orca' && piece.promoted ? Math.PI / 2 : 0)
  );
}
export function createMotion(
  before: GameState,
  after: GameState,
  now: number,
  reduced = false,
): MoveMotion | null {
  if (after.revision !== before.revision + 1 || !after.lastAction) return null;
  const action = after.lastAction;
  const original =
    action.action.type === 'move'
      ? (before.pieces.find((p) => p.id === action.piece.id) ?? null)
      : null;
  const transform = action.action.type === 'move' && action.action.transformation;
  return {
    before: original,
    action,
    startedAt: now,
    reduced,
    duration: reduced
      ? 180
      : action.from
        ? transform
          ? 1450
          : action.captured.length
            ? 1100
            : 760
        : 640,
  };
}
export function progress(motion: MoveMotion, now: number) {
  return clamp((now - motion.startedAt) / motion.duration);
}
export const IMPACT = 0.56;
/** A deterministic, testable animation path; rendering does not own game state. */
export function sampleMotion(motion: MoveMotion, t: number) {
  const after = motion.action.piece;
  const before = motion.before;
  const final = center(after);
  if (motion.reduced)
    return { position: final, scale: 1, yaw: facing(after), promoted: after.promoted };
  if (!before || motion.action.action.type === 'place') {
    const land = smooth(t / 0.7);
    return {
      position: [final[0], (1 - land) * 1.8, final[2]] as Vec3,
      scale: 0.5 + 0.5 * smooth(t / 0.45),
      yaw: facing(after),
      promoted: after.promoted,
    };
  }
  const action = motion.action.action;
  const landingPiece = { ...before, at: action.to };
  const start = center(before),
    landing = center(landingPiece);
  const move = smooth(t / IMPACT);
  const hop =
    before.kind === 'bear' ? 1.65 : before.kind === 'penguin' && before.promoted ? 0.15 : 0.28;
  let position: Vec3 = [
    start[0] + (landing[0] - start[0]) * move,
    Math.sin(move * Math.PI) * hop,
    start[2] + (landing[2] - start[2]) * move,
  ];
  let yaw = facing(before);
  const change = smooth((t - IMPACT) / (0.92 - IMPACT));
  if (action.transformation?.type === 'rotate' && t >= IMPACT) {
    const pivot = footprint(landingPiece)[action.transformation.pivot];
    const px = pivot.x - 4.5,
      pz = pivot.y - 4.5;
    const angle = ((action.transformation.direction * Math.PI) / 2) * change;
    const dx = landing[0] - px,
      dz = landing[2] - pz;
    position = [
      px + dx * Math.cos(angle) - dz * Math.sin(angle),
      Math.sin(change * Math.PI) * 0.35,
      pz + dx * Math.sin(angle) + dz * Math.cos(angle),
    ];
    yaw += (facing(after) - facing(before)) * change;
  }
  return {
    position,
    scale: action.transformation ? 1 + Math.sin(change * Math.PI) * 0.12 : 1,
    yaw,
    promoted: change > 0.5 ? after.promoted : before.promoted,
  };
}
export function captureProgress(motion: MoveMotion, victim: Piece, t: number) {
  let at = IMPACT;
  if (motion.before && motion.action.action.type === 'move') {
    const landing = footprint({ ...motion.before, at: motion.action.action.to });
    const immediate = footprint(victim).some((c) =>
      landing.some((l) => c.x === l.x && c.y === l.y),
    );
    if (!immediate) at = 0.83;
  }
  return smooth((t - (motion.reduced ? 0 : at)) / 0.16);
}
