import type { GameState } from '../game/types';
import type { Difficulty } from '../match/record';
import type { SearchProgress, SearchResult } from './search';
export interface ThinkRequest {
  seed: number;
  /** Canonical positions already played, including the current position. */
  positionHistory: readonly string[];
  state: GameState;
  difficulty: Difficulty;
  revision: number;
}
export type ThinkResponse =
  | { type: 'progress'; revision: number; progress: SearchProgress }
  | { type: 'result'; revision: number; result: SearchResult }
  | { type: 'error'; revision: number; message: string };
