import type { GameState } from '../game/types';
import type { Difficulty } from '../match/record';
import type { SearchProgress, SearchResult } from './search';
export interface ThinkRequest {
  state: GameState;
  difficulty: Difficulty;
  revision: number;
}
export type ThinkResponse =
  | { type: 'progress'; revision: number; progress: SearchProgress }
  | { type: 'result'; revision: number; result: SearchResult }
  | { type: 'error'; revision: number; message: string };
