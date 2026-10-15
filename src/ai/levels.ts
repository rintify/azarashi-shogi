import type { Difficulty } from '../match/record';
export const LEVELS: Record<
  Difficulty,
  { name: string; thinkingMs: number; maxDepth: number; noise: number }
> = {
  1: { name: 'おさんぽ', thinkingMs: 100, maxDepth: 1, noise: 150 },
  2: { name: '見習い', thinkingMs: 300, maxDepth: 2, noise: 65 },
  3: { name: 'しっかり', thinkingMs: 1000, maxDepth: 4, noise: 20 },
  4: { name: '達人', thinkingMs: 3000, maxDepth: 6, noise: 5 },
  5: { name: '極', thinkingMs: 10000, maxDepth: 10, noise: 0 },
};
export const THINKING_MS = Object.fromEntries(
  Object.entries(LEVELS).map(([level, config]) => [level, config.thinkingMs]),
) as Record<Difficulty, number>;
