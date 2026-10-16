export const DIFFICULTIES = [1, 2, 3, 4, 5, 6] as const;
export type Difficulty = (typeof DIFFICULTIES)[number];
export const MAX_DIFFICULTY = DIFFICULTIES[DIFFICULTIES.length - 1];
export const isDifficulty = (value: unknown): value is Difficulty =>
  DIFFICULTIES.some((level) => level === value);
export const LEVELS: Record<
  Difficulty,
  {
    name: string;
    thinkingMs: number;
    maxDepth: number;
    noise: number;
    tacticalDepth: number;
    advanced: boolean;
  }
> = {
  1: {
    name: 'おさんぽ',
    thinkingMs: 100,
    maxDepth: 1,
    noise: 150,
    tacticalDepth: 0,
    advanced: false,
  },
  2: { name: '見習い', thinkingMs: 300, maxDepth: 2, noise: 65, tacticalDepth: 0, advanced: false },
  3: {
    name: 'しっかり',
    thinkingMs: 1000,
    maxDepth: 4,
    noise: 20,
    tacticalDepth: 2,
    advanced: false,
  },
  4: { name: '達人', thinkingMs: 3000, maxDepth: 6, noise: 5, tacticalDepth: 2, advanced: false },
  5: { name: '極', thinkingMs: 10000, maxDepth: 10, noise: 0, tacticalDepth: 2, advanced: false },
  6: { name: '覇王', thinkingMs: 30000, maxDepth: 16, noise: 0, tacticalDepth: 4, advanced: true },
};
export const THINKING_MS = Object.fromEntries(
  Object.entries(LEVELS).map(([level, config]) => [level, config.thinkingMs]),
) as Record<Difficulty, number>;
