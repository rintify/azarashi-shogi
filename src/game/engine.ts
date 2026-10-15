import { BOARD_SIZE, canTransform, fits, footprint, initialStock, KINDS } from './pieces';
import { cellKey, otherPlayer, sameCell } from './types';
import type { ActionPreview, Cell, GameAction, GameState, Kind, Piece, Player, Threat, Transformation } from './types';

export function createGame(): GameState {
  return { rulesVersion: 1, revision: 0, phase: 'setup-south', turn: 'south', pieces: [], stocks: { south: initialStock(), north: initialStock() }, result: null, lastAction: null };
}
function occupancy(state: GameState, excludeId?: string): Map<string, Piece> {
  const map = new Map<string, Piece>();
  for (const piece of state.pieces) if (piece.id !== excludeId) for (const c of footprint(piece)) map.set(cellKey(c), piece);
  return map;
}
function victims(cells: Cell[], occupied: Map<string, Piece>): Piece[] {
  return [...new Map(cells.flatMap(c => { const p = occupied.get(cellKey(c)); return p ? [[p.id, p] as const] : []; })).values()];
}
export function pieceAt(state: GameState, at: Cell): Piece | undefined {
  return state.pieces.find(p => footprint(p).some(c => sameCell(c, at)));
}
export function placementCells(state: GameState, kind: Kind): Cell[] {
  if (state.phase === 'finished' || state.stocks[state.turn][kind] <= 0) return [];
  const setup = state.phase !== 'playing';
  if (setup && kind !== 'walrus') return [];
  if (!setup && kind === 'walrus') return [];
  const occupied = occupancy(state);
  const allied = state.pieces.filter(p => p.owner === state.turn).flatMap(footprint);
  const cells: Cell[] = [];
  for (let y = 0; y < BOARD_SIZE; y++) for (let x = 0; x < BOARD_SIZE; x++) {
    const piece: Piece = { id: '', kind, owner: state.turn, at: { x, y }, promoted: false };
    const body = footprint(piece);
    if (!fits(piece) || body.some(c => occupied.has(cellKey(c)))) continue;
    if (setup) {
      if (!body.every(c => state.turn === 'south' ? c.y >= 5 : c.y < 5)) continue;
    } else if (!body.some(c => allied.some(a => Math.max(Math.abs(c.x - a.x), Math.abs(c.y - a.y)) === 1))) continue;
    cells.push({ x, y });
  }
  return cells;
}
export function moveCells(state: GameState, piece: Piece): Cell[] {
  if (state.phase !== 'playing') return [];
  const forward = piece.owner === 'south' ? -1 : 1;
  if (piece.kind === 'penguin' && piece.promoted) {
    const occupied = occupancy(state, piece.id);
    let target: Cell | null = null;
    for (let y = piece.at.y + forward; y >= 0 && y < BOARD_SIZE; y += forward) {
      target = { x: piece.at.x, y };
      if (occupied.has(cellKey(target))) break;
    }
    return target ? [target] : [];
  }
  const result: Cell[] = [];
  const maxX = piece.kind === 'walrus' || piece.kind === 'bear' || (piece.kind === 'orca' && piece.promoted) ? 2 : 1;
  const maxY = piece.kind === 'walrus' || piece.kind === 'bear' || (piece.kind === 'orca' && !piece.promoted) ? 2 : 1;
  for (let dy = -maxY; dy <= maxY; dy++) for (let dx = -maxX; dx <= maxX; dx++) {
    if (dx === 0 && dy === 0) continue;
    if (piece.kind === 'seal' && !piece.promoted && (dx !== 0 || dy !== forward)) continue;
    if (piece.kind === 'bear' && Math.max(Math.abs(dx), Math.abs(dy)) !== 2) continue;
    const at = { x: piece.at.x + dx, y: piece.at.y + dy };
    if (fits({ ...piece, at })) result.push(at);
  }
  return result;
}
function transformedPiece(piece: Piece, transformation: Transformation): Piece | null {
  if (transformation.type === 'promote') {
    if (piece.kind === 'orca') return null;
    return { ...piece, promoted: !piece.promoted };
  }
  if (piece.kind !== 'orca' || ![0, 1].includes(transformation.pivot) || ![-1, 1].includes(transformation.direction)) return null;
  const body = footprint(piece);
  const pivot = body[transformation.pivot];
  const tip = body[1 - transformation.pivot];
  const dx = tip.x - pivot.x, dy = tip.y - pivot.y;
  const rotated = { x: pivot.x - dy * transformation.direction, y: pivot.y + dx * transformation.direction };
  const at = { x: Math.min(pivot.x, rotated.x), y: Math.min(pivot.y, rotated.y) };
  const changed = { ...piece, promoted: !piece.promoted, at };
  return fits(changed) ? changed : null;
}
/** Validates and previews the entire atomic action, including extra rotation captures. */
export function previewAction(state: GameState, action: GameAction): ActionPreview | null {
  if (state.phase === 'finished') return null;
  if (action.type === 'place') {
    if (!KINDS.includes(action.kind)) return null;
    if (!placementCells(state, action.kind).some(c => sameCell(c, action.at))) return null;
    const piece: Piece = { id: `p${state.revision}`, owner: state.turn, kind: action.kind, at: { ...action.at }, promoted: false };
    return { action, piece, from: null, footprint: footprint(piece), captureCells: [], captured: [] };
  }
  const original = state.pieces.find(p => p.id === action.pieceId && p.owner === state.turn);
  if (!original || !moveCells(state, original).some(c => sameCell(c, action.to))) return null;
  return buildMovePreview(state, original, action);
}
function buildMovePreview(state: GameState, original: Piece, action: Extract<GameAction, { type: 'move' }>): ActionPreview | null {
  let piece = { ...original, at: { ...action.to } };
  const occupied = occupancy(state, original.id);
  let captureCells = footprint(piece);
  let captured = victims(captureCells, occupied);
  if (action.transformation) {
    if (!captured.length || !canTransform(piece)) return null;
    const transformed = transformedPiece(piece, action.transformation);
    if (!transformed) return null;
    piece = transformed;
    captureCells = [...new Map([...captureCells, ...footprint(piece)].map(c => [cellKey(c), c])).values()];
    captured = victims(captureCells, occupied);
  }
  return { action, piece, from: original.at, footprint: footprint(piece), captureCells, captured };
}
export function actionKey(action: GameAction): string {
  if (action.type === 'place') return `p:${action.kind}:${cellKey(action.at)}`;
  const t = action.transformation;
  return `m:${action.pieceId}:${cellKey(action.to)}:${!t ? '-' : t.type === 'promote' ? 't' : `${t.pivot}:${t.direction}`}`;
}
export function moveOptions(state: GameState, piece: Piece, to: Cell): ActionPreview[] {
  const action: GameAction = { type: 'move', pieceId: piece.id, to };
  const base = buildMovePreview(state, piece, action);
  if (!base) return [];
  const results = [base];
  if (base.captured.length && canTransform(piece)) {
    const transformations: Transformation[] = piece.kind === 'orca'
      ? ([0, 1] as const).flatMap(pivot => ([-1, 1] as const).map(direction => ({ type: 'rotate' as const, pivot, direction })))
      : [{ type: 'promote' }];
    for (const transformation of transformations) {
      const p = buildMovePreview(state, piece, { ...action, transformation });
      if (p) results.push(p);
    }
  }
  return results;
}
export function legalPreviews(state: GameState, includePlacements = true): ActionPreview[] {
  if (state.phase === 'finished') return [];
  const result: ActionPreview[] = [];
  if (state.phase === 'playing') for (const p of state.pieces) if (p.owner === state.turn) {
    for (const to of moveCells(state, p)) result.push(...moveOptions(state, p, to));
  }
  if (includePlacements) for (const kind of KINDS) for (const at of placementCells(state, kind)) {
    const piece: Piece = { id: `p${state.revision}`, owner: state.turn, kind, at, promoted: false };
    result.push({ action: { type: 'place', kind, at }, piece, from: null, footprint: footprint(piece), captureCells: [], captured: [] });
  }
  return result;
}
/** Internal fast path for already-generated previews; external callers use applyAction. */
export function applyPreview(state: GameState, preview: ActionPreview): GameState {
  const { action, piece, captured } = preview;
  const removed = new Set(captured.map(p => p.id));
  if (action.type === 'move') removed.add(action.pieceId);
  const stocks = { south: { ...state.stocks.south }, north: { ...state.stocks.north } };
  if (action.type === 'place') stocks[state.turn][action.kind]--;
  for (const p of captured) if (p.kind !== 'walrus') stocks[state.turn][p.kind]++;
  const deadKings = captured.filter(p => p.kind === 'walrus').map(p => p.owner);
  let phase = state.phase;
  let turn = otherPlayer(state.turn);
  let result = state.result;
  if (phase === 'setup-south') phase = 'setup-north';
  else if (phase === 'setup-north') { phase = 'playing'; turn = 'south'; }
  if (deadKings.length) {
    phase = 'finished';
    result = deadKings.length === 2 ? { winner: null, reason: 'both-kings' } : { winner: otherPlayer(deadKings[0]), reason: 'king-captured' };
  }
  return { ...state, revision: state.revision + 1, phase, turn, stocks, pieces: [...state.pieces.filter(p => !removed.has(p.id)), piece], result, lastAction: preview };
}
export function applyAction(state: GameState, action: GameAction, expectedRevision = state.revision): GameState {
  if (expectedRevision !== state.revision) throw new Error('局面が更新されています。');
  const preview = previewAction(state, action);
  if (!preview) throw new Error('この手は指せません。');
  return applyPreview(state, preview);
}
export function getThreats(state: GameState, defender: Player): Threat[] {
  if (state.phase !== 'playing') return [];
  const attacking = { ...state, turn: otherPlayer(defender) };
  const threats = new Map<string, Set<string>>();
  for (const p of legalPreviews(attacking, false)) for (const victim of p.captured) if (victim.owner === defender) {
    if (!threats.has(victim.id)) threats.set(victim.id, new Set());
    threats.get(victim.id)!.add(p.piece.id);
  }
  return [...threats].map(([targetId, ids]) => ({ targetId, attackerIds: [...ids] }));
}
