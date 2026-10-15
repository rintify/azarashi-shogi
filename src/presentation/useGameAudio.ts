import { useCallback, useEffect, useRef, useState } from 'react';
import { hasTransformation, landingMoment, type MoveMotion } from './motion';
/** Small synthesized ice/wood cues; audio starts only after a user gesture. */
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
    if (!ctx || !motion || !enabled || ctx.state !== 'running') return;
    const nodes: OscillatorNode[] = [];
    function tone(delay: number, frequency: number, length: number, volume: number) {
      const oscillator = ctx!.createOscillator(),
        gain = ctx!.createGain();
      const start = ctx!.currentTime + delay;
      oscillator.type = 'sine';
      oscillator.frequency.setValueAtTime(frequency, start);
      oscillator.frequency.exponentialRampToValueAtTime(frequency * 0.45, start + length);
      gain.gain.setValueAtTime(0.0001, start);
      gain.gain.exponentialRampToValueAtTime(volume, start + 0.012);
      gain.gain.exponentialRampToValueAtTime(0.0001, start + length);
      oscillator.connect(gain);
      gain.connect(ctx!.destination);
      oscillator.start(start);
      oscillator.stop(start + length + 0.02);
      nodes.push(oscillator);
    }
    if (motion.stage !== 'resolve') tone(0.01, 440, 0.09, 0.025);
    if (motion.stage !== 'choice') {
      tone(
        (motion.duration / 1000) * landingMoment(motion),
        motion.action.captured.length ? 160 : 260,
        0.18,
        0.065,
      );
      if (hasTransformation(motion)) {
        const start = motion.stage === 'resolve' ? 0.18 : 0.44;
        [660, 880, 1320].forEach((frequency, i) =>
          tone((motion.duration / 1000) * start + i * 0.08, frequency, 0.22, 0.022),
        );
      }
    }
    return () =>
      nodes.forEach((node) => {
        try {
          node.stop();
        } catch {
          /* An already ended cue needs no cleanup. */
        }
      });
  }, [motion, enabled]);
  useEffect(
    () => () => {
      void context.current?.close();
    },
    [],
  );
  return { enabled, toggle: () => setEnabled((e) => !e), unlock };
}
