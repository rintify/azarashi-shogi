import type { ActionPreview, GameState, Piece } from '../game/types';
import { dimensions, footprint } from '../game/pieces';
import { headingYaw, jetHeading } from '../game/headings';
export type Vec3 = [number, number, number];
export interface MotionPose {
  position: Vec3;
  scale: number;
  yaw: number;
  promoted: boolean;
  jetBlend?: number;
}
export interface MoveMotion {
  choicePreview?: { target: ActionPreview; from: MotionPose; startedAt: number };
  resolveFrom?: MotionPose;
  stage?: 'choice' | 'resolve' | 'return';
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
export function facing(piece: Pick<Piece, 'owner' | 'kind' | 'promoted' | 'heading'>): number {
  if (piece.kind === 'penguin' && piece.promoted) return headingYaw(jetHeading(piece));
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
          ? 1850
          : action.captured.length
            ? 1100
            : original?.kind === 'walrus'
              ? 1050
              : 760
        : 640,
  };
}
export function progress(motion: MoveMotion, now: number) {
  return clamp((now - motion.startedAt) / motion.duration);
}
export const IMPACT = 0.56;
export const HOVER_HEIGHT = 1.45;
export const hasTransformation = (motion: MoveMotion) =>
  motion.action.action.type === 'move' && !!motion.action.action.transformation;
export function transformationProgress(motion: MoveMotion, t: number) {
  if (motion.stage === 'choice' || !hasTransformation(motion)) return 0;
  const start = motion.stage === 'resolve' ? 0.08 : 0.4;
  const end = motion.stage === 'resolve' ? 0.62 : 0.74;
  return smooth((t - start) / (end - start));
}
export function landingMoment(motion: MoveMotion) {
  if (motion.stage === 'choice') return Infinity;
  if (motion.stage === 'resolve' || hasTransformation(motion)) return 0.84;
  return motion.before ? IMPACT : 0.66;
}
/** A deterministic path shared by staged player choices and complete NPC actions. */
function samplePath(motion: MoveMotion, t: number) {
  const after = motion.action.piece;
  const before = motion.before;
  const final = center(after);
  if (motion.reduced) {
    const waiting = motion.stage === 'choice';
    return {
      position:
        waiting && before
          ? ([
              center({ ...before, at: after.at })[0],
              HOVER_HEIGHT,
              center({ ...before, at: after.at })[2],
            ] as Vec3)
          : final,
      scale: 1,
      yaw: facing(waiting && before ? before : after),
      promoted: waiting && before ? before.promoted : after.promoted,
    };
  }
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
  const aerial =
    motion.stage === 'choice' || motion.stage === 'resolve' || hasTransformation(motion);
  const move =
    motion.stage === 'resolve'
      ? 1
      : smooth(t / (motion.stage === 'choice' ? 1 : aerial ? 0.34 : IMPACT));
  const change = transformationProgress(motion, t);
  let position: Vec3 = [
    start[0] + (landing[0] - start[0]) * move,
    0,
    start[2] + (landing[2] - start[2]) * move,
  ];
  let yaw = facing(before);
  if (action.transformation?.type === 'rotate' && change > 0) {
    const pivot = footprint(landingPiece)[action.transformation.pivot];
    const px = pivot.x - 4.5,
      pz = pivot.y - 4.5;
    const angle = ((action.transformation.direction * Math.PI) / 2) * change;
    const dx = landing[0] - px,
      dz = landing[2] - pz;
    position = [
      px + dx * Math.cos(angle) - dz * Math.sin(angle),
      0,
      pz + dx * Math.sin(angle) + dz * Math.cos(angle),
    ];
    yaw += (facing(after) - facing(before)) * change;
  }
  if (before.kind === 'penguin') yaw += angleDelta(facing(before), facing(after)) * change;
  if (aerial) {
    const landingStart =
      motion.stage === 'resolve' ? (hasTransformation(motion) ? 0.68 : 0.1) : 0.78;
    const descent = motion.stage === 'choice' ? 0 : smooth((t - landingStart) / (1 - landingStart));
    position[1] = HOVER_HEIGHT * move * (1 - descent);
  } else {
    const hop =
      before.kind === 'bear'
        ? 1.65
        : before.kind === 'orca'
          ? 0.12
          : before.kind === 'walrus'
            ? 0.55
            : before.kind === 'penguin' && before.promoted
              ? 0.15
              : 0.28;
    position[1] = Math.sin(move * Math.PI) * hop;
  }
  return {
    position,
    scale: hasTransformation(motion) ? 1 + Math.sin(change * Math.PI) * 0.12 : 1,
    yaw,
    promoted: change > 0.5 ? after.promoted : before.promoted,
    jetBlend: Number(before.promoted) + (Number(after.promoted) - Number(before.promoted)) * change,
  };
}
export function captureMoment(motion: MoveMotion, victim: Piece) {
  if (motion.stage === 'choice' || motion.stage === 'return') return Infinity;
  let at = landingMoment(motion);
  if (motion.before && motion.action.action.type === 'move') {
    const landing = footprint({ ...motion.before, at: motion.action.action.to });
    const immediate = footprint(victim).some((c) =>
      landing.some((l) => c.x === l.x && c.y === l.y),
    );
    if (!immediate) at = hasTransformation(motion) || motion.stage === 'resolve' ? 0.86 : 0.83;
  }
  return motion.reduced ? 0 : at;
}
export function captureProgress(motion: MoveMotion, victim: Piece, t: number) {
  if (motion.stage === 'choice' || motion.stage === 'return') return 0;
  return smooth(
    (t - captureMoment(motion, victim)) /
      (hasTransformation(motion) || motion.stage === 'resolve' ? 0.12 : 0.16),
  );
}

/** Preview poses are presentation data only; they never modify a legal action or match state. */
export function sampleMotion(
  motion: MoveMotion,
  t: number,
  now = motion.startedAt + t * motion.duration,
): MotionPose {
  if (motion.stage === 'return' && motion.before && motion.resolveFrom) {
    const blend = motion.reduced ? 1 : smooth(t);
    const returned = blendPose(
      motion.resolveFrom,
      {
        position: center(motion.before),
        yaw: facing(motion.before),
        scale: 1,
        promoted: motion.before.promoted,
        jetBlend: Number(motion.before.promoted),
      },
      blend,
    );
    if (!motion.reduced) returned.position[1] += Math.sin(Math.PI * t) * 0.18;
    return returned;
  }
  const pose: MotionPose = samplePath(motion, t);
  if (motion.stage === 'choice' && motion.choicePreview && now >= motion.choicePreview.startedAt) {
    const preview = motion.choicePreview;
    const target = preview.target;
    const blend = motion.reduced ? 1 : smooth((now - preview.startedAt) / 280);
    return blendPose(
      preview.from,
      {
        position: [center(target.piece)[0], HOVER_HEIGHT, center(target.piece)[2]],
        yaw: facing(target.piece),
        scale: 1,
        promoted: target.piece.promoted,
        jetBlend: Number(target.piece.promoted),
      },
      blend,
    );
  }
  if (motion.stage === 'resolve' && motion.resolveFrom) {
    const blend = motion.reduced ? 1 : smooth(t / 0.62);
    const target: MotionPose = {
      ...pose,
      position: [center(motion.action.piece)[0], pose.position[1], center(motion.action.piece)[2]],
      yaw: facing(motion.action.piece),
    };
    const result = blendPose(motion.resolveFrom, target, blend);
    result.position[1] = pose.position[1];
    result.scale = pose.scale;
    result.promoted =
      (hasTransformation(motion) ? transformationProgress(motion, t) : blend) > 0.5
        ? motion.action.piece.promoted
        : motion.resolveFrom.promoted;
    result.jetBlend =
      (motion.resolveFrom.jetBlend ?? Number(motion.resolveFrom.promoted)) +
      (Number(motion.action.piece.promoted) -
        (motion.resolveFrom.jetBlend ?? Number(motion.resolveFrom.promoted))) *
        blend;
    return result;
  }
  return pose;
}
const angleDelta = (from: number, to: number) =>
  Math.atan2(Math.sin(to - from), Math.cos(to - from));
function blendPose(from: MotionPose, to: MotionPose, t: number): MotionPose {
  return {
    position: from.position.map((v, i) => v + (to.position[i] - v) * t) as Vec3,
    yaw: from.yaw + angleDelta(from.yaw, to.yaw) * t,
    scale: from.scale + (to.scale - from.scale) * t,
    promoted: t > 0.5 ? to.promoted : from.promoted,
    jetBlend:
      (from.jetBlend ?? Number(from.promoted)) +
      ((to.jetBlend ?? Number(to.promoted)) - (from.jetBlend ?? Number(from.promoted))) * t,
  };
}
