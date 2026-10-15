import { useCallback, useState } from 'react';
import type { GameRecord } from './record';
import { replayTimeline } from './replayLibrary';

export function useReplay() {
  const [session, setSession] = useState<{
    record: GameRecord;
    states: ReturnType<typeof replayTimeline>;
    cursor: number;
  } | null>(null);
  const [playing, setPlaying] = useState(false);
  const [speed, setSpeed] = useState(1);
  const [epoch, setEpoch] = useState(0);
  const open = (record: GameRecord) => {
    const states = replayTimeline(record);
    setSession({ record, states, cursor: 0 });
    setEpoch((n) => n + 1);
    setPlaying(true);
  };
  const seek = (cursor: number) => {
    setPlaying(false);
    setEpoch((n) => n + 1);
    setSession((s) => s && { ...s, cursor: Math.max(0, Math.min(s.states.length - 1, cursor)) });
  };
  const advance = useCallback(() => {
    setSession((s) => s && { ...s, cursor: Math.min(s.cursor + 1, s.states.length - 1) });
  }, []);
  const close = () => {
    setSession(null);
    setPlaying(false);
    setEpoch((n) => n + 1);
  };
  return {
    active: session !== null,
    record: session?.record,
    game: session?.states[session.cursor],
    cursor: session?.cursor ?? 0,
    total: session ? session.states.length - 1 : 0,
    playing,
    speed,
    epoch,
    open,
    close,
    seek,
    advance,
    setSpeed,
    pause: () => setPlaying(false),
    toggle: () => {
      if (playing) {
        setPlaying(false);
        return;
      }
      if (session && session.cursor === session.states.length - 1) seek(0);
      setPlaying(true);
    },
  };
}
export type ReplayController = ReturnType<typeof useReplay>;
