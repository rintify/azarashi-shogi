import type { GameState } from '../game/types';
import type { Difficulty } from '../match/record';
import type { SearchProgress, SearchResult } from './searchTypes';

export interface SearchInput {
  seed: number;
  /** Played positions including the current position; repeated visits affect root choices. */
  positionHistory: readonly string[];
  state: GameState;
  difficulty: Difficulty;
}
export interface ThinkRequest extends SearchInput {
  id: number;
  type: 'think' | 'ponder';
}
export type ThinkResponse =
  | { type: 'forecast'; id: number; input: SearchInput }
  | { type: 'progress'; id: number; progress: SearchProgress }
  | { type: 'result'; id: number; result: SearchResult }
  | { type: 'error'; id: number; message: string };
