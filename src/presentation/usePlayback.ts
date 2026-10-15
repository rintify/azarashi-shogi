import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import type { ActionPreview, GameState } from '../game/types';
import { createMotion, hasTransformation, progress, sampleMotion, type MoveMotion } from './motion';

/** Choice flights are transient; canonical state changes only after confirmation. */
export function usePlayback(game: GameState, reduced = false) {
  const [settled, setSettled] = useState(game);
  const [motion, setMotion] = useState<MoveMotion | null>(null);
  const [choiceReady, setChoiceReady] = useState(false);
  const staged = useRef<{ game: GameState; motion: MoveMotion } | null>(null);
  const presentChoice = useCallback(
    (action: ActionPreview | null) => {
      setChoiceReady(false);
      if (!action) {
        const previous = staged.current?.motion;
        staged.current = null;
        if (previous?.before) {
          const now = performance.now();
          setMotion({
            ...previous,
            stage: 'return',
            startedAt: now,
            duration: reduced ? 1 : 500,
            choicePreview: undefined,
            resolveFrom: sampleMotion(previous, progress(previous, now), now),
            action: { ...previous.action, captured: [] },
          });
        }
        return;
      }
      const next: MoveMotion = {
        stage: 'choice',
        before: game.pieces.find((p) => p.id === action.piece.id) ?? null,
        action,
        startedAt: performance.now(),
        duration: reduced ? 1 : 620,
        reduced,
      };
      staged.current = { game, motion: next };
      setMotion(next);
    },
    [game, reduced],
  );
  const previewChoice = useCallback((target: ActionPreview | null) => {
    const current = staged.current?.motion;
    if (
      !current ||
      !target ||
      target.piece.kind !== 'orca' ||
      target.piece.id !== current.action.piece.id
    )
      return;
    if (current.choicePreview?.target === target) return;
    const now = performance.now();
    const next: MoveMotion = {
      ...current,
      choicePreview: {
        target,
        from: sampleMotion(current, progress(current, now), now),
        startedAt: Math.max(now, current.startedAt + current.duration),
      },
    };
    // The flight completes first. Selection changes then animate in place.
    if (now < current.startedAt + current.duration)
      next.choicePreview!.from = sampleMotion(current, 1, current.startedAt + current.duration);
    staged.current = { game: staged.current!.game, motion: next };
    setMotion(next);
  }, []);
  const arrivalAt = motion?.stage === 'choice' ? motion.startedAt + motion.duration : null;
  useEffect(() => {
    if (arrivalAt === null) return;
    const timer = window.setTimeout(
      () => setChoiceReady(true),
      Math.max(0, arrivalAt - performance.now()),
    );
    return () => window.clearTimeout(timer);
  }, [arrivalAt]);

  useEffect(() => {
    if (motion?.stage !== 'return') return;
    const timer = window.setTimeout(() => setMotion(null), motion.duration);
    return () => window.clearTimeout(timer);
  }, [motion]);

  useLayoutEffect(() => {
    if (game === settled) return;
    const next = createMotion(settled, game, performance.now(), reduced);
    if (
      next &&
      staged.current?.game === settled &&
      staged.current.motion.action.piece.id === next.action.piece.id
    ) {
      const previous = staged.current.motion;
      const now = performance.now();
      next.resolveFrom = sampleMotion(previous, progress(previous, now), now);
      next.stage = 'resolve';
      next.duration = reduced ? 180 : hasTransformation(next) ? 1150 : 620;
    }
    staged.current = null;
    setChoiceReady(false);
    setMotion(next);
    if (!next) {
      setSettled(game);
      return;
    }
    const timer = window.setTimeout(() => {
      setMotion(null);
      setSettled(game);
    }, next.duration);
    return () => window.clearTimeout(timer);
  }, [game, settled, reduced]);
  return {
    motion,
    busy: game !== settled || motion?.stage === 'choice' || motion?.stage === 'return',
    resolving: game !== settled || motion?.stage === 'return',
    choiceReady,
    presentChoice,
    previewChoice,
    settled,
  };
}
