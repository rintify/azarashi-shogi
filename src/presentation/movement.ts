import { clamp, hasTransformation, IMPACT, landingMoment, smooth, type MoveMotion } from './motion';

/** Timing and body dynamics shared by models, trails, impact effects and tests. */
export function travelEnd(motion: MoveMotion) {
  return motion.stage === 'choice' ? 1 : hasTransformation(motion) ? 0.34 : IMPACT;
}
export function bodyDynamics(motion: MoveMotion, t: number) {
  const traveling = !!motion.before && motion.stage !== 'resolve' && motion.stage !== 'return';
  const u = clamp(t / travelEnd(motion));
  const envelope = traveling ? Math.sin(u * Math.PI) : 0;
  const impactAt = landingMoment(motion);
  const impact =
    !motion.reduced && t >= impactAt ? Math.sin(clamp((t - impactAt) / 0.18) * Math.PI) : 0;
  const kind = motion.before?.kind ?? motion.action.piece.kind;
  const jet = kind === 'penguin' && !!motion.before?.promoted;
  if (motion.reduced)
    return { pitch: 0, roll: 0, stretch: [1, 1, 1] as [number, number, number], thrust: 0 };
  return {
    pitch:
      kind === 'orca'
        ? Math.sin(u * Math.PI * 2) * 0.18 * envelope
        : jet
          ? -0.12 * envelope
          : kind === 'walrus'
            ? 0.1 * envelope
            : 0,
    roll: jet
      ? Math.sin(u * Math.PI * 3) * 0.13 * envelope
      : kind === 'orca'
        ? Math.sin(u * Math.PI * 2) * 0.08 * envelope
        : 0,
    stretch: (kind === 'walrus'
      ? [1 + impact * 0.13, 1 - impact * 0.2, 1 + impact * 0.1]
      : jet
        ? [1 - envelope * 0.07, 1 - envelope * 0.09, 1 + envelope * 0.12]
        : [1, 1, 1]) as [number, number, number],
    thrust: jet && traveling ? smooth(u / 0.12) * (1 - smooth((u - 0.8) / 0.2)) : 0,
  };
}
