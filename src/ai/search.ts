import { actionKey, applyPreview, legalPreviews } from '../game/engine';
import { DEFINITIONS, KINDS } from '../game/pieces';
import type { ActionPreview, GameAction, GameState, Player } from '../game/types';
import type { Difficulty } from '../match/record';
import { LEVELS, THINKING_MS } from './levels';
import { randomSeed, seededValue } from '../shared/random';
import { evaluatePosition, type PositionEvaluation } from './evaluation';
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
// Store mate distances relative to the cached node, not the root path that reached it.
const toTableScore = (score: number, ply: number) =>
  score > WIN / 2 ? score + ply : score < -WIN / 2 ? score - ply : score;
const fromTableScore = (score: number, ply: number) =>
  score > WIN / 2 ? score - ply : score < -WIN / 2 ? score + ply : score;
interface Entry {
  depth: number;
  score: number;
  bound: 'exact' | 'lower' | 'upper';
  best: string | null;
}
/** Position identity omits history: this ruleset has no repetition adjudication. */
export function positionKey(state: GameState): string {
  return `${state.phase}/${state.turn}/${state.pieces
    .map((p) => `${p.id}:${p.owner}:${p.kind}:${+p.promoted}:${p.at.x},${p.at.y}`)
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
  const config = LEVELS[options.difficulty];
  const seed = options.seed ?? randomSeed();
  const variety = (move: ActionPreview) =>
    seededValue(`${state.revision}:${actionKey(move.action)}`, seed);
  const table = new Map<string, Entry>();
  const evaluations = new Map<string, PositionEvaluation>();
  const killers = new Map<number, string[]>();
  const history = new Map<string, number>();
  let nodes = 0,
    completedDepth = 0,
    timedOut = false;
  // Vary equivalent move order at every level; the top levels use no evaluation noise.
  let rootMoves = legalPreviews(state).sort(
    (a, b) => priority(b, root) - priority(a, root) || variety(b) - variety(a),
  );
  let best: ActionPreview | null = rootMoves[0] ?? null;
  let bestScore = 0;
  function check() {
    if (options.cancelled?.() || now() >= deadline) throw TIMEOUT;
  }
  function evaluation(position: GameState): PositionEvaluation {
    if (!config.advanced) return evaluatePosition(position, root);
    const key = positionKey(position);
    const cached = evaluations.get(key);
    if (cached) return cached;
    const value = evaluatePosition(position, root);
    if (evaluations.size >= 20000) evaluations.clear();
    evaluations.set(key, value);
    return value;
  }
  function ordered(moves: ActionPreview[], turn: Player, ply: number, preferred?: string | null) {
    return moves
      .map((move) => {
        const key = actionKey(move.action);
        const learned = config.advanced
          ? move.captured.length
            ? 10000
            : (killers.get(ply)?.includes(key) ? 5000 : 0) + (history.get(`${turn}/${key}`) ?? 0)
          : 0;
        return { move, score: key === preferred ? WIN * 3 : priority(move, turn) + learned };
      })
      .sort((a, b) => b.score - a.score)
      .map(({ move }) => move);
  }
  function rememberCutoff(move: ActionPreview, turn: Player, ply: number, depth: number) {
    if (!config.advanced || move.captured.length) return;
    const key = actionKey(move.action);
    killers.set(ply, [key, ...(killers.get(ply) ?? []).filter((old) => old !== key)].slice(0, 2));
    const historyKey = `${turn}/${key}`;
    history.set(historyKey, Math.min(3000, (history.get(historyKey) ?? 0) + depth * depth));
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
    const assessed = evaluation(position);
    if (config.advanced && assessed.canWinImmediately)
      return position.turn === root ? WIN - ply - 1 : -WIN + ply + 1;
    const standing = assessed.score;
    if (remaining === 0 || position.phase !== 'playing') return standing;
    const maximizing = position.turn === root;
    const inDanger = assessed.kingInDanger;
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
      ply,
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
    if (depth === 0) return tactical(position, alpha, beta, config.tacticalDepth, ply);
    const key = positionKey(position),
      cached = table.get(key),
      originalAlpha = alpha,
      originalBeta = beta;
    if (cached && cached.depth >= depth) {
      const score = fromTableScore(cached.score, ply);
      if (cached.bound === 'exact') return score;
      if (cached.bound === 'lower') alpha = Math.max(alpha, score);
      else beta = Math.min(beta, score);
      if (alpha >= beta) return score;
    }
    const moves = ordered(legalPreviews(position), position.turn, ply, cached?.best);
    if (!moves.length) return evaluation(position).score;
    const maximizing = position.turn === root;
    let value = maximizing ? -Infinity : Infinity,
      chosen: string | null = null;
    for (let index = 0; index < moves.length; index++) {
      const move = moves[index];
      const next = applyPreview(position, move);
      let score: number;
      if (config.advanced && index > 0 && Number.isFinite(maximizing ? alpha : beta)) {
        // Probe later moves cheaply; any improvement inside the window gets a full re-search.
        score = maximizing
          ? visit(next, depth - 1, alpha, Math.min(beta, alpha + 1), ply + 1)
          : visit(next, depth - 1, Math.max(alpha, beta - 1), beta, ply + 1);
        if (score > alpha && score < beta) score = visit(next, depth - 1, alpha, beta, ply + 1);
      } else score = visit(next, depth - 1, alpha, beta, ply + 1);
      if (maximizing ? score > value : score < value) {
        value = score;
        chosen = actionKey(move.action);
      }
      if (maximizing) alpha = Math.max(alpha, value);
      else beta = Math.min(beta, value);
      if (alpha >= beta) {
        rememberCutoff(move, position.turn, ply, depth);
        break;
      }
    }
    if (table.size > (config.advanced ? 150000 : 50000)) table.clear();
    table.set(key, {
      depth,
      score: toTableScore(value, ply),
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
  const maxDepth = config.maxDepth;
  const variation = config.noise;
  try {
    if (config.advanced) {
      // First inspect every root reply for an immediate royal loss. A long tactical branch
      // must not consume the whole budget before an available saving move is even considered.
      const prepared: { move: ActionPreview; score: number }[] = [];
      let preparedScore = -Infinity;
      for (const move of rootMoves) {
        check();
        nodes++;
        const next = applyPreview(state, move);
        const end = terminal(next, root, 1);
        const assessed = end === null ? evaluation(next) : null;
        const score = end ?? (assessed!.canWinImmediately ? -WIN + 2 : assessed!.score);
        prepared.push({ move, score });
        if (score > preparedScore) {
          preparedScore = score;
          best = move;
          bestScore = score;
        }
      }
      // Only proven immediate losses are discarded, and only when a better reply exists.
      const candidates = prepared.some(({ score }) => score > -WIN / 2)
        ? prepared.filter(({ score }) => score > -WIN / 2)
        : prepared;
      rootMoves = candidates.sort((a, b) => b.score - a.score).map(({ move }) => move);
    }
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
