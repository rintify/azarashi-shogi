import { useEffect, useState } from 'react';
import { AnimatedPresence } from './AnimatedUI';

export interface ThinkingSession {
  startedAt: number;
  budgetMs: number;
}

/** Wall-clock timing stays responsive even while the search Worker is busy. */
export function ThinkingClock({ session }: { session: ThinkingSession | null }) {
  const [now, setNow] = useState(() => performance.now());
  useEffect(() => {
    if (!session) return;
    setNow(performance.now());
    const timer = window.setInterval(() => setNow(performance.now()), 50);
    return () => window.clearInterval(timer);
  }, [session]);
  const elapsed = session ? Math.max(0, now - session.startedAt) : 0;
  const progress = session ? Math.min(1, elapsed / session.budgetMs) : 0;
  return (
    <AnimatedPresence
      show={!!session && elapsed > 3500}
      className="thinking-clock-presence"
      exitDurationMs={280}
    >
      <div className="thinking-clock" aria-label="AIの思考時間">
        <svg viewBox="0 0 40 40" aria-hidden="true">
          <circle className="thinking-clock-track" cx="20" cy="20" r="16" />
          <circle
            className="thinking-clock-progress"
            cx="20"
            cy="20"
            r="16"
            pathLength="1"
            strokeDasharray={`${progress} 1`}
          />
          <path className="thinking-clock-hands" d="M20 10v10l6 4" />
        </svg>
        <div>
          <small>AI 思考中</small>
          <span>
            <b>{Math.floor(elapsed / 1000)}</b>
            <small> / {(session?.budgetMs ?? 0) / 1000}秒</small>
          </span>
        </div>
      </div>
    </AnimatedPresence>
  );
}
