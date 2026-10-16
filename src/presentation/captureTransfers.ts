import type { Piece } from '../game/types';
import { captureMoment, type MoveMotion } from './motion';

export interface CaptureTransfer {
  victim: Piece;
  launchAt: number;
  arriveAt: number;
}
/** One shared clock drives the light flight, stock count and handoff to the next turn. */
export function captureTransfers(motion: MoveMotion | null): CaptureTransfer[] {
  if (!motion || motion.stage === 'choice' || motion.stage === 'return') return [];
  return motion.action.captured
    .filter((piece) => piece.kind !== 'walrus')
    .map((victim, index) => {
      const launchAt =
        motion.startedAt +
        captureMoment(motion, victim) * motion.duration +
        (motion.reduced ? 0 : Math.min(90, motion.duration * 0.06) + Math.min(index * 35, 210));
      return {
        victim,
        launchAt,
        arriveAt: launchAt + (motion.reduced ? 100 : Math.min(650, motion.duration * 0.55)),
      };
    });
}
export function playbackDuration(motion: MoveMotion) {
  return Math.max(
    motion.duration,
    ...captureTransfers(motion).map((flight) => flight.arriveAt - motion.startedAt + 120),
  );
}
export function transferPoint(
  from: { x: number; y: number },
  to: { x: number; y: number },
  t: number,
) {
  const u = Math.max(0, Math.min(1, t));
  const ease = u * u * (3 - 2 * u);
  const arc = Math.min(100, Math.hypot(to.x - from.x, to.y - from.y) * 0.23);
  return {
    x: from.x + (to.x - from.x) * ease + Math.sin(u * Math.PI) * arc * 0.3,
    y: from.y + (to.y - from.y) * ease - Math.sin(u * Math.PI) * arc,
  };
}
