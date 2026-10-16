interface OrbitPoint {
  x: number;
  y: number;
  z: number;
}

export const TURN_ROTATION_MS = 900;
/** Interpolate around the board, rather than cutting through its center between sides. */
export function sampleCameraOrbit(from: OrbitPoint, to: OrbitPoint, progress: number) {
  const t = Math.max(0, Math.min(1, progress));
  const ease = t * t * (3 - 2 * t);
  const fromAngle = Math.atan2(from.x, from.z);
  const toAngle = Math.atan2(to.x, to.z);
  let turn = Math.atan2(Math.sin(toAngle - fromAngle), Math.cos(toAngle - fromAngle));
  if (Math.abs(Math.abs(turn) - Math.PI) < 0.00001) turn = Math.PI;
  const angle = fromAngle + turn * ease;
  const radius = Math.hypot(from.x, from.z) * (1 - ease) + Math.hypot(to.x, to.z) * ease;
  return {
    x: Math.sin(angle) * radius,
    y: from.y + (to.y - from.y) * ease,
    z: Math.cos(angle) * radius,
  };
}
