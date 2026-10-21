import { captureMoment, hasTransformation, landingMoment, type MoveMotion } from './motion';

export const TONE_CUES = {
  move: [440, 0.09, 0.025],
  kingLanding: [85, 0.3, 0.1],
  captureLanding: [160, 0.18, 0.025],
  landing: [260, 0.18, 0.065],
  transform660: [660, 0.22, 0.022],
  transform880: [880, 0.22, 0.022],
  transform1320: [1320, 0.22, 0.022],
} as const;
export type ToneCue = keyof typeof TONE_CUES;
export interface MotionAudioCue {
  clip: ToneCue | 'bite';
  at: number;
}

/** Seconds from the beginning of this motion stage. */
export function motionAudioCues(motion: MoveMotion): MotionAudioCue[] {
  if (motion.stage === 'return') return [];
  const cues: MotionAudioCue[] = [];
  if (motion.stage !== 'resolve') cues.push({ clip: 'move', at: 0.01 });
  if (motion.stage === 'choice') return cues;
  const duration = motion.duration / 1000;
  for (const bite of new Set(motion.action.captured.map((victim) => captureMoment(motion, victim))))
    cues.push({ clip: 'bite', at: bite * duration });
  cues.push({
    clip:
      motion.action.piece.kind === 'walrus'
        ? 'kingLanding'
        : motion.action.captured.length
          ? 'captureLanding'
          : 'landing',
    at: duration * landingMoment(motion),
  });
  if (hasTransformation(motion)) {
    const start = motion.stage === 'resolve' ? 0.18 : 0.44;
    (['transform660', 'transform880', 'transform1320'] as const).forEach((clip, i) =>
      cues.push({ clip, at: duration * start + i * 0.08 }),
    );
  }
  return cues;
}

/** Schedule a tone using the Web Audio oscillator and envelope. */
export function scheduleTone(ctx: BaseAudioContext, start: number, cue: ToneCue): () => void {
  const [frequency, length, volume] = TONE_CUES[cue];
  const oscillator = ctx.createOscillator(),
    gain = ctx.createGain();
  oscillator.type = 'sine';
  oscillator.frequency.setValueAtTime(frequency, start);
  oscillator.frequency.exponentialRampToValueAtTime(frequency * 0.45, start + length);
  gain.gain.setValueAtTime(0.0001, start);
  gain.gain.exponentialRampToValueAtTime(volume, start + 0.012);
  gain.gain.exponentialRampToValueAtTime(0.0001, start + length);
  oscillator.connect(gain);
  gain.connect(ctx.destination);
  oscillator.start(start);
  oscillator.stop(start + length + 0.02);
  oscillator.onended = () => {
    oscillator.disconnect();
    gain.disconnect();
  };
  return () => {
    try {
      oscillator.stop();
    } catch {
      /* Already ended. */
    }
  };
}
