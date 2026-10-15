export const RULES_VERSION = 2 as const;

/** Serializable contracts shared by the UI, worker, and a future match server. */
export type Player = 'south' | 'north';
export type Kind = 'seal' | 'penguin' | 'bear' | 'orca' | 'walrus';
export interface Cell {
  x: number;
  y: number;
}
export interface Piece {
  id: string;
  owner: Player;
  kind: Kind;
  promoted: boolean;
  /** Top-left of the piece's footprint in absolute board coordinates. */
  at: Cell;
}
export type Stock = Record<Kind, number>;
export type Phase = 'playing' | 'finished';
export interface GameState {
  rulesVersion: typeof RULES_VERSION;
  revision: number;
  phase: Phase;
  turn: Player;
  pieces: Piece[];
  stocks: Record<Player, Stock>;
  result: { winner: Player | null; reason: 'king-captured' | 'both-kings' } | null;
  lastAction: ActionPreview | null;
}
export type Transformation =
  { type: 'promote' } | { type: 'rotate'; pivot: 0 | 1; direction: -1 | 1 };
export type GameAction =
  | { type: 'place'; kind: Kind; at: Cell }
  | { type: 'move'; pieceId: string; to: Cell; transformation?: Transformation };
export interface ActionPreview {
  action: GameAction;
  piece: Piece;
  from: Cell | null;
  footprint: Cell[];
  captureCells: Cell[];
  captured: Piece[];
}
export interface Threat {
  targetId: string;
  attackerIds: string[];
}
export const otherPlayer = (player: Player): Player => (player === 'south' ? 'north' : 'south');
export const sameCell = (a: Cell, b: Cell) => a.x === b.x && a.y === b.y;
export const cellKey = (p: Cell) => `${p.x},${p.y}`;
