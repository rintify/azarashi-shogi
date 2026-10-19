import { useCallback, useEffect, useRef, useState } from 'react';
import type { MoveMotion } from './motion';
import { scheduleBite } from './biteAudio';
import { motionAudioCues, scheduleTone } from './motionAudio';
/** Synthesized game cues; audio starts only after a user gesture. */
export function useGameAudio(motion: MoveMotion | null) {
  const context = useRef<AudioContext | null>(null);
  const [enabled, setEnabled] = useState(() => {
    try {
      return localStorage.getItem('azarashi-shogi.sound') !== 'off';
    } catch {
      return true;
    }
  });
  useEffect(() => {
    try {
      localStorage.setItem('azarashi-shogi.sound', enabled ? 'on' : 'off');
    } catch {
      /* Gameplay does not depend on preference storage. */
    }
  }, [enabled]);
  const unlock = useCallback(() => {
    if (!enabled || !('AudioContext' in window)) return;
    try {
      context.current ??= new AudioContext();
      void context.current.resume().catch(() => {});
    } catch {
      /* Audio is optional. */
    }
  }, [enabled]);
  useEffect(() => {
    const ctx = context.current;
    if (!ctx || !motion || motion.stage === 'return' || !enabled || ctx.state !== 'running') return;
    const cleanups: (() => void)[] = [];
    const elapsed = Math.max(0, (performance.now() - motion.startedAt) / 1000);
    for (const cue of motionAudioCues(motion)) {
      if (cue.at < elapsed - 0.04) continue;
      const start = ctx.currentTime + Math.max(0, cue.at - elapsed);
      cleanups.push(
        cue.clip === 'bite' ? scheduleBite(ctx, start) : scheduleTone(ctx, start, cue.clip),
      );
    }
    return () => cleanups.forEach((stop) => stop());
    // Airborne preview changes share one flight and must not replay its sound.
  }, [motion?.startedAt, motion?.stage, enabled]);
  useEffect(
    () => () => {
      void context.current?.close();
    },
    [],
  );
  return { enabled, toggle: () => setEnabled((e) => !e), unlock };
}
