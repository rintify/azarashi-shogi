import { actionKey, applyPreview, getThreats, legalPreviews, moveCells } from '../game/engine';
import { DEFINITIONS, KINDS } from '../game/pieces';
import { otherPlayer } from '../game/types';
import type { ActionPreview, GameAction, GameState, Player } from '../game/types';
import type { Difficulty } from '../match/record';
import { LEVELS, THINKING_MS } from './levels';
import { randomSeed, seededValue } from '../shared/random';
export { THINKING_MS } from './levels';
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
export interface SearchOptions {
  seed?: number;
  difficulty: Difficulty;
  budgetMs?: number;
  now?: () => number;
  onProgress?: (progress: SearchProgress) => void;
  cancelled?: () => boolean;
}
const WIN = 1_000_000;
const TIMEOUT = Symbol('search-timeout');
interface Entry {
  depth: number;
  score: number;
  bound: 'exact' | 'lower' | 'upper';
  best: string | null;
}
/** Position identity omits history: this ruleset has no repetition adjudication. */
export function positionKey(state: GameState): string {
  return `${state.phase}/${state.turn}/${state.pieces
    .map(
      (p) => `${p.id}:${p.owner}:${p.kind}:${+p.promoted}:${p.heading ?? '-'}:${p.at.x},${p.at.y}`,
    )
    .sort()
    .join(
      ';',
    )}/${(['south', 'north'] as const).map((side) => KINDS.map((k) => state.stocks[side][k]).join(',')).join('/')}`;
}
function terminal(state: GameState, root: Player, ply: number): number | null {
  return !state.result
    ? null
    : state.result.winner === null
      ? 0
      : state.result.winner === root
        ? WIN - ply
        : -WIN + ply;
}
function evaluate(state: GameState, root: Player): number {
  let score = 0;
  for (const side of [root, otherPlayer(root)]) {
    const sign = side === root ? 1 : -1;
    for (const kind of KINDS)
      if (kind !== 'walrus')
        score += sign * state.stocks[side][kind] * DEFINITIONS[kind].value * 0.72;
    for (const p of state.pieces)
      if (p.owner === side) {
        const center = 9 - Math.abs(p.at.x - 4.5) - Math.abs(p.at.y - 4.5);
        score +=
          sign *
          (DEFINITIONS[p.kind].value +
            (p.promoted && p.kind === 'seal' ? 145 : p.promoted && p.kind === 'penguin' ? 30 : 0) +
            center * (p.kind === 'walrus' ? 0.8 : 2.3) +
            moveCells(state, p).length * 1.5);
      }
    // A royal threat matters far more than material. It includes orca rotation captures.
    const threats = getThreats(state, side);
    for (const t of threats) {
      const target = state.pieces.find((p) => p.id === t.targetId)!;
      const cost =
        target.kind === 'walrus'
          ? state.turn === side
            ? 17000
            : 35000
          : DEFINITIONS[target.kind].value * 0.18;
      score -= sign * cost;
    }
  }
  return score;
}
function priority(preview: ActionPreview, turn: Player): number {
  const kings = preview.captured.filter((p) => p.kind === 'walrus');
  if (kings.length === 2) return 500;
  if (kings.length === 1) return kings[0].owner === turn ? -WIN * 2 : WIN * 2;
  let score = preview.captured.reduce(
    (s, p) => s + DEFINITIONS[p.kind].value * (p.owner === turn ? -0.28 : 1.72),
    0,
  );
  if (preview.action.type === 'move' && preview.action.transformation) score += 65;
  if (preview.action.type === 'place') score += 10 + DEFINITIONS[preview.piece.kind].value * 0.02;
  return score;
}
/** Iterative alpha-beta with a bounded capture extension; no rule shortcuts or hidden information. */
export function searchBestAction(state: GameState, options: SearchOptions): SearchResult {
  const now = options.now ?? (() => performance.now());
  const start = now(),
    deadline = start + (options.budgetMs ?? THINKING_MS[options.difficulty]);
  const root = state.turn;
  const seed = options.seed ?? randomSeed();
  const variety = (move: ActionPreview) =>
    seededValue(`${state.revision}:${actionKey(move.action)}`, seed);
  const table = new Map<string, Entry>();
  let nodes = 0,
    completedDepth = 0,
    timedOut = false;
  // Vary equivalent move order even at Lv.5; its evaluation itself remains noise-free.
  let rootMoves = legalPreviews(state).sort(
    (a, b) => priority(b, root) - priority(a, root) || variety(b) - variety(a),
  );
  let best: ActionPreview | null = rootMoves[0] ?? null;
  let bestScore = 0;
  function check() {
    if (options.cancelled?.() || now() >= deadline) throw TIMEOUT;
  }
  function ordered(moves: ActionPreview[], turn: Player, preferred?: string | null) {
    return moves.sort(
      (a, b) =>
        (actionKey(b.action) === preferred ? WIN * 3 : priority(b, turn)) -
        (actionKey(a.action) === preferred ? WIN * 3 : priority(a, turn)),
    );
  }
  function tactical(
    position: GameState,
    alpha: number,
    beta: number,
    remaining: number,
    ply: number,
  ): number {
    nodes++;
    check();
    const end = terminal(position, root, ply);
    if (end !== null) return end;
    const standing = evaluate(position, root);
    if (remaining === 0 || position.phase !== 'playing') return standing;
    const maximizing = position.turn === root;
    const ownKing = position.pieces.find((p) => p.owner === position.turn && p.kind === 'walrus');
    const inDanger =
      ownKing && getThreats(position, position.turn).some((t) => t.targetId === ownKing.id);
    let value = inDanger ? (maximizing ? -Infinity : Infinity) : standing;
    if (!inDanger) {
      if (maximizing) {
        if (value >= beta) return value;
        alpha = Math.max(alpha, value);
      } else {
        if (value <= alpha) return value;
        beta = Math.min(beta, value);
      }
    }
    const moves = ordered(
      legalPreviews(position, !!inDanger).filter((m) => inDanger || m.captured.length > 0),
      position.turn,
    );
    if (!moves.length) return standing;
    for (const move of moves) {
      const score = tactical(applyPreview(position, move), alpha, beta, remaining - 1, ply + 1);
      value = maximizing ? Math.max(value, score) : Math.min(value, score);
      if (maximizing) alpha = Math.max(alpha, value);
      else beta = Math.min(beta, value);
      if (alpha >= beta) break;
    }
    return value;
  }
  function visit(
    position: GameState,
    depth: number,
    alpha: number,
    beta: number,
    ply: number,
  ): number {
    nodes++;
    check();
    const end = terminal(position, root, ply);
    if (end !== null) return end;
    if (depth === 0) return tactical(position, alpha, beta, options.difficulty >= 3 ? 2 : 0, ply);
    const key = positionKey(position),
      cached = table.get(key),
      originalAlpha = alpha,
      originalBeta = beta;
    if (cached && cached.depth >= depth) {
      if (cached.bound === 'exact') return cached.score;
      if (cached.bound === 'lower') alpha = Math.max(alpha, cached.score);
      else beta = Math.min(beta, cached.score);
      if (alpha >= beta) return cached.score;
    }
    const moves = ordered(legalPreviews(position), position.turn, cached?.best);
    if (!moves.length) return evaluate(position, root);
    const maximizing = position.turn === root;
    let value = maximizing ? -Infinity : Infinity,
      chosen: string | null = null;
    for (const move of moves) {
      const score = visit(applyPreview(position, move), depth - 1, alpha, beta, ply + 1);
      if (maximizing ? score > value : score < value) {
        value = score;
        chosen = actionKey(move.action);
      }
      if (maximizing) alpha = Math.max(alpha, value);
      else beta = Math.min(beta, value);
      if (alpha >= beta) break;
    }
    if (table.size > 50000) table.clear();
    table.set(key, {
      depth,
      score: value,
      best: chosen,
      bound: value <= originalAlpha ? 'upper' : value >= originalBeta ? 'lower' : 'exact',
    });
    return value;
  }
  const immediate = rootMoves.find((m) => {
    const result = applyPreview(state, m).result;
    return result?.winner === root;
  });
  if (immediate)
    return {
      action: immediate.action,
      score: WIN - 1,
      depth: 1,
      nodes: rootMoves.length,
      elapsedMs: now() - start,
      timedOut: false,
    };
  const maxDepth = LEVELS[options.difficulty].maxDepth;
  const variation = LEVELS[options.difficulty].noise;
  try {
    for (let depth = 1; depth <= maxDepth && rootMoves.length; depth++) {
      check();
      let iterationBest: ActionPreview | null = null,
        iterationScore = -Infinity,
        alpha = -Infinity;
      const scored: { move: ActionPreview; score: number }[] = [];
      for (const move of rootMoves) {
        check();
        const raw = visit(applyPreview(state, move), depth - 1, alpha - variation * 2, Infinity, 1);
        const score = raw + (variety(move) * 2 - 1) * variation;
        scored.push({ move, score });
        if (score > iterationScore) {
          iterationScore = score;
          iterationBest = move;
        }
        alpha = Math.max(alpha, score);
        // A partial first pass is still better than the initial move-order fallback.
        if (completedDepth === 0) {
          best = iterationBest;
          bestScore = iterationScore;
        }
      }
      if (iterationBest) {
        best = iterationBest;
        bestScore = iterationScore;
      }
      completedDepth = depth;
      options.onProgress?.({ depth, nodes, elapsedMs: now() - start });
      rootMoves = scored.sort((a, b) => b.score - a.score).map((v) => v.move);
      if (bestScore > WIN - 100 || bestScore < -WIN + 100) break;
    }
  } catch (error) {
    if (error !== TIMEOUT) throw error;
    timedOut = true;
  }
  return {
    action: best?.action ?? null,
    score: bestScore,
    depth: completedDepth,
    nodes,
    elapsedMs: now() - start,
    timedOut,
  };
}
