import type { GameAction } from '../game/types';

export interface SearchProgress {
  depth: number;
  nodes: number;
  elapsedMs: number;
}
export interface SearchResult extends SearchProgress {
  action: GameAction | null;
  score: number;
  timedOut: boolean;
}
