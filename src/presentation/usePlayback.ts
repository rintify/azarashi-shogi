import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import type { ActionPreview, GameState } from '../game/types';
import { createMotion, hasTransformation, type MoveMotion } from './motion';

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
        staged.current = null;
        setMotion((current) => (current?.stage === 'choice' ? null : current));
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
  useEffect(() => {
    if (motion?.stage !== 'choice') return;
    const timer = window.setTimeout(() => setChoiceReady(true), motion.duration);
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
    busy: game !== settled || motion?.stage === 'choice',
    resolving: game !== settled,
    choiceReady,
    presentChoice,
    settled,
  };
}
