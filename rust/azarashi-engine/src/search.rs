use crate::{
    evaluation::{evaluate, Evaluation},
    model::*,
    rules::{apply, is_win, legal_moves},
    wire::action_key,
};
use serde::Deserialize;
use std::collections::HashMap;

const WIN: f64 = 1_000_000.0;
#[derive(Clone, Copy, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Profile {
    pub budget_ms: f64,
    pub max_depth: u8,
    pub noise: f64,
    pub tactical_depth: u8,
    pub advanced: bool,
    pub values: [f64; 5],
    #[serde(default)]
    pub max_nodes: Option<u64>,
}
impl Profile {
    pub fn validate(&self) -> Result<(), String> {
        if !self.budget_ms.is_finite()
            || self.budget_ms < 0.0
            || self.budget_ms > 120000.0
            || self.max_depth == 0
            || self.max_depth > 64
            || self.tactical_depth > 16
            || !self.noise.is_finite()
            || self.noise < 0.0
            || self.values.iter().any(|v| !v.is_finite() || *v <= 0.0)
        {
            return Err("Invalid search profile".into());
        }
        Ok(())
    }
}
pub trait Host {
    fn now(&mut self) -> f64;
    fn progress(&mut self, depth: u8, nodes: u64, elapsed_ms: f64);
}
pub struct SearchResult {
    pub best: Option<Move>,
    pub score: f64,
    pub depth: u8,
    pub nodes: u64,
    pub elapsed_ms: f64,
    pub timed_out: bool,
}
#[derive(Clone, Copy)]
enum Bound {
    Exact,
    Lower,
    Upper,
}
#[derive(Clone, Copy)]
struct Entry {
    depth: u8,
    score: f64,
    bound: Bound,
    best: Option<u64>,
}
#[derive(Clone, Copy)]
struct RootMove {
    action: Move,
    cost: f64,
    variety: f64,
    score: f64,
}
#[derive(Debug)]
struct Timeout;
type Score = Result<f64, Timeout>;

struct Search<'a, H: Host> {
    host: &'a mut H,
    profile: Profile,
    root: Side,
    start: f64,
    deadline: f64,
    nodes: u64,
    table: HashMap<u64, Entry>,
    evaluations: HashMap<u64, Evaluation>,
    killers: HashMap<u16, Vec<u64>>,
    quiet_history: HashMap<(Side, u64), u32>,
}
/// Owned by the engine instance across turns. Bounds use root-relative scores.
#[derive(Default)]
pub struct Cache {
    context: Option<(Side, u8, bool, [f64; 5])>,
    table: HashMap<u64, Entry>,
    evaluations: HashMap<u64, Evaluation>,
}

fn terminal(position: &Position, root: Side, ply: u16) -> Option<f64> {
    match position.result {
        0 => None,
        3 => Some(0.0),
        result => Some(if result == root as u8 + 1 {
            WIN - ply as f64
        } else {
            -WIN + ply as f64
        }),
    }
}
fn to_table(score: f64, ply: u16) -> f64 {
    if score > WIN / 2.0 {
        score + ply as f64
    } else if score < -WIN / 2.0 {
        score - ply as f64
    } else {
        score
    }
}
fn from_table(score: f64, ply: u16) -> f64 {
    if score > WIN / 2.0 {
        score - ply as f64
    } else if score < -WIN / 2.0 {
        score + ply as f64
    } else {
        score
    }
}
fn seeded_value(key: &str, seed: u32) -> f64 {
    let mut hash = seed;
    for ch in key.encode_utf16() {
        hash = (hash ^ ch as u32).wrapping_mul(16777619);
    }
    hash = (hash ^ (hash >> 16)).wrapping_mul(2246822507);
    hash = (hash ^ (hash >> 13)).wrapping_mul(3266489909);
    (hash ^ (hash >> 16)) as f64 / 4294967296.0
}
impl<H: Host> Search<'_, H> {
    fn check(&mut self, force: bool) -> Result<(), Timeout> {
        if self
            .profile
            .max_nodes
            .is_some_and(|limit| self.nodes >= limit)
        {
            return Err(Timeout);
        }
        // Poll the JS clock in batches; the full search tree never crosses the WASM boundary.
        if (force || self.nodes & 63 == 0) && self.host.now() >= self.deadline {
            return Err(Timeout);
        }
        Ok(())
    }
    fn priority(&self, position: &Position, action: Move) -> f64 {
        let mut kings = 0;
        let mut score = 0.0;
        for victim in bits(action.captured).map(|slot| position.pieces[slot]) {
            if victim.kind == Kind::Walrus {
                kings |= 1 << victim.owner.index();
            }
            score += self.profile.values[victim.kind.index()]
                * if victim.owner == position.turn {
                    -0.28
                } else {
                    1.72
                };
        }
        if kings == 3 {
            return 500.0;
        }
        if kings != 0 {
            return if kings == 1 << position.turn.index() {
                -WIN * 2.0
            } else {
                WIN * 2.0
            };
        }
        if action.transformation.is_some() {
            score += 65.0;
        }
        if action.is_place() {
            score += 10.0 + self.profile.values[action.piece.kind.index()] * 0.02;
        }
        score
    }
    fn assessment(&mut self, position: &Position) -> Evaluation {
        if !self.profile.advanced {
            return evaluate(position, self.root, &self.profile.values);
        }
        let key = position.hash();
        if let Some(value) = self.evaluations.get(&key) {
            return *value;
        }
        let value = evaluate(position, self.root, &self.profile.values);
        if self.evaluations.len() >= 20000 {
            self.evaluations.clear();
        }
        self.evaluations.insert(key, value);
        value
    }
    fn ordered(
        &self,
        position: &Position,
        moves: Vec<Move>,
        ply: u16,
        preferred: Option<u64>,
    ) -> Vec<Move> {
        let mut scored: Vec<_> = moves
            .into_iter()
            .map(|action| {
                let key = action.key();
                let learned = if !self.profile.advanced {
                    0.0
                } else if action.captured != 0 {
                    10000.0
                } else {
                    (if self
                        .killers
                        .get(&ply)
                        .is_some_and(|keys| keys.contains(&key))
                    {
                        5000.0
                    } else {
                        0.0
                    }) + *self.quiet_history.get(&(position.turn, key)).unwrap_or(&0) as f64
                };
                let score = if preferred == Some(key) {
                    WIN * 3.0
                } else {
                    self.priority(position, action) + learned
                };
                (action, score)
            })
            .collect();
        scored.sort_by(|a, b| b.1.total_cmp(&a.1));
        scored.into_iter().map(|(action, _)| action).collect()
    }
    fn remember(&mut self, action: Move, turn: Side, ply: u16, depth: u8) {
        if !self.profile.advanced || action.captured != 0 {
            return;
        }
        let key = action.key();
        let killers = self.killers.entry(ply).or_default();
        killers.retain(|&old| old != key);
        killers.insert(0, key);
        killers.truncate(2);
        let history = self.quiet_history.entry((turn, key)).or_default();
        *history = (*history + depth as u32 * depth as u32).min(3000);
    }
    fn tactical(
        &mut self,
        position: &Position,
        mut alpha: f64,
        mut beta: f64,
        remaining: u8,
        ply: u16,
    ) -> Score {
        self.nodes += 1;
        self.check(false)?;
        if let Some(score) = terminal(position, self.root, ply) {
            return Ok(score);
        }
        let assessed = self.assessment(position);
        if self.profile.advanced && assessed.can_win_immediately {
            return Ok(if position.turn == self.root {
                WIN - ply as f64 - 1.0
            } else {
                -WIN + ply as f64 + 1.0
            });
        }
        let standing = assessed.score;
        if remaining == 0 || position.finished {
            return Ok(standing);
        }
        let maximizing = position.turn == self.root;
        let mut value = if assessed.king_in_danger {
            if maximizing {
                f64::NEG_INFINITY
            } else {
                f64::INFINITY
            }
        } else {
            standing
        };
        if !assessed.king_in_danger {
            if maximizing {
                if value >= beta {
                    return Ok(value);
                }
                alpha = alpha.max(value);
            } else {
                if value <= alpha {
                    return Ok(value);
                }
                beta = beta.min(value);
            }
        }
        let moves = legal_moves(position, assessed.king_in_danger)
            .into_iter()
            .filter(|m| assessed.king_in_danger || m.captured != 0)
            .collect();
        let moves = self.ordered(position, moves, ply, None);
        if moves.is_empty() {
            return Ok(standing);
        }
        for action in moves {
            let score = self.tactical(
                &apply(position, action),
                alpha,
                beta,
                remaining - 1,
                ply + 1,
            )?;
            value = if maximizing {
                value.max(score)
            } else {
                value.min(score)
            };
            if maximizing {
                alpha = alpha.max(value);
            } else {
                beta = beta.min(value);
            }
            if alpha >= beta {
                break;
            }
        }
        Ok(value)
    }
    fn visit(
        &mut self,
        position: &Position,
        depth: u8,
        mut alpha: f64,
        mut beta: f64,
        ply: u16,
    ) -> Score {
        self.nodes += 1;
        self.check(false)?;
        if let Some(score) = terminal(position, self.root, ply) {
            return Ok(score);
        }
        if depth == 0 {
            return self.tactical(position, alpha, beta, self.profile.tactical_depth, ply);
        }
        let key = position.hash();
        let cached = self.table.get(&key).copied();
        let original_alpha = alpha;
        let original_beta = beta;
        if let Some(entry) = cached.filter(|entry| entry.depth >= depth) {
            let score = from_table(entry.score, ply);
            match entry.bound {
                Bound::Exact => return Ok(score),
                Bound::Lower => alpha = alpha.max(score),
                Bound::Upper => beta = beta.min(score),
            }
            if alpha >= beta {
                return Ok(score);
            }
        }
        let moves = self.ordered(
            position,
            legal_moves(position, true),
            ply,
            cached.and_then(|entry| entry.best),
        );
        if moves.is_empty() {
            return Ok(self.assessment(position).score);
        }
        let maximizing = position.turn == self.root;
        let mut value = if maximizing {
            f64::NEG_INFINITY
        } else {
            f64::INFINITY
        };
        let mut chosen = None;
        for (index, action) in moves.into_iter().enumerate() {
            let next = apply(position, action);
            let mut score;
            if self.profile.advanced
                && index > 0
                && (if maximizing { alpha } else { beta }).is_finite()
            {
                score = if maximizing {
                    self.visit(&next, depth - 1, alpha, beta.min(alpha + 1.0), ply + 1)?
                } else {
                    self.visit(&next, depth - 1, alpha.max(beta - 1.0), beta, ply + 1)?
                };
                if score > alpha && score < beta {
                    score = self.visit(&next, depth - 1, alpha, beta, ply + 1)?;
                }
            } else {
                score = self.visit(&next, depth - 1, alpha, beta, ply + 1)?;
            }
            if if maximizing {
                score > value
            } else {
                score < value
            } {
                value = score;
                chosen = Some(action.key());
            }
            if maximizing {
                alpha = alpha.max(value);
            } else {
                beta = beta.min(value);
            }
            if alpha >= beta {
                self.remember(action, position.turn, ply, depth);
                break;
            }
        }
        if self.table.len() > if self.profile.advanced { 150000 } else { 50000 } {
            self.table.clear();
        }
        self.table.insert(
            key,
            Entry {
                depth,
                score: to_table(value, ply),
                best: chosen,
                bound: if value <= original_alpha {
                    Bound::Upper
                } else if value >= original_beta {
                    Bound::Lower
                } else {
                    Bound::Exact
                },
            },
        );
        Ok(value)
    }
    fn root_search(
        &mut self,
        position: &Position,
        names: &[String],
        seed: u32,
        history: &[String],
    ) -> SearchResult {
        let mut occurrences = HashMap::<&str, u32>::new();
        for key in history {
            *occurrences.entry(key.as_str()).or_default() += 1;
        }
        let mut moves: Vec<_> = legal_moves(position, true)
            .into_iter()
            .map(|action| {
                let count = if occurrences.is_empty() {
                    0
                } else {
                    *occurrences
                        .get(apply(position, action).identity().as_str())
                        .unwrap_or(&0)
                } as f64;
                let cost = (80.0 * count * count).min(25000.0);
                RootMove {
                    action,
                    cost,
                    variety: seeded_value(
                        &format!("{}:{}", position.revision, action_key(action, names)),
                        seed,
                    ),
                    score: self.priority(position, action) - cost,
                }
            })
            .collect();
        moves.sort_by(|a, b| {
            b.score
                .total_cmp(&a.score)
                .then_with(|| b.variety.total_cmp(&a.variety))
        });
        let mut best = moves.first().map(|m| m.action);
        let mut best_score = 0.0;
        let mut completed_depth = 0;
        if let Some(winner) = moves.iter().find(|m| is_win(position, m.action, self.root)) {
            return SearchResult {
                best: Some(winner.action),
                score: WIN - 1.0,
                depth: 1,
                nodes: moves.len() as u64,
                elapsed_ms: self.host.now() - self.start,
                timed_out: false,
            };
        }
        let attempt = (|| -> Result<(), Timeout> {
            if self.profile.advanced || moves.iter().any(|m| m.cost > 0.0) {
                let mut prepared_score = f64::NEG_INFINITY;
                for m in &mut moves {
                    self.check(true)?;
                    self.nodes += 1;
                    let next = apply(position, m.action);
                    m.score = match terminal(&next, self.root, 1) {
                        Some(score) => score,
                        None => {
                            let assessed = self.assessment(&next);
                            if assessed.can_win_immediately {
                                -WIN + 2.0
                            } else {
                                assessed.score
                            }
                        }
                    } - m.cost;
                    if m.score > prepared_score {
                        prepared_score = m.score;
                        best = Some(m.action);
                        best_score = m.score;
                    }
                }
                if moves.iter().any(|m| m.score > -WIN / 2.0) {
                    moves.retain(|m| m.score > -WIN / 2.0);
                }
                moves.sort_by(|a, b| b.score.total_cmp(&a.score));
            }
            for depth in 1..=self.profile.max_depth {
                if moves.is_empty() {
                    break;
                }
                self.check(true)?;
                let mut iteration_best = None;
                let mut iteration_score = f64::NEG_INFINITY;
                let mut alpha = f64::NEG_INFINITY;
                for m in &mut moves {
                    self.check(true)?;
                    let bias = (m.variety * 2.0 - 1.0) * self.profile.noise - m.cost;
                    let raw = self.visit(
                        &apply(position, m.action),
                        depth - 1,
                        alpha - bias,
                        f64::INFINITY,
                        1,
                    )?;
                    m.score = raw + bias;
                    if m.score > iteration_score {
                        iteration_score = m.score;
                        iteration_best = Some(m.action);
                    }
                    alpha = alpha.max(m.score);
                    if completed_depth == 0 {
                        best = iteration_best;
                        best_score = iteration_score;
                    }
                }
                if iteration_best.is_some() {
                    best = iteration_best;
                    best_score = iteration_score;
                }
                completed_depth = depth;
                let elapsed = self.host.now() - self.start;
                self.host.progress(depth, self.nodes, elapsed);
                moves.sort_by(|a, b| b.score.total_cmp(&a.score));
                if best_score.abs() > WIN / 2.0 {
                    break;
                }
            }
            Ok(())
        })();
        SearchResult {
            best,
            score: best_score,
            depth: completed_depth,
            nodes: self.nodes,
            elapsed_ms: self.host.now() - self.start,
            timed_out: attempt.is_err(),
        }
    }
}
#[cfg(test)]
pub fn search<H: Host>(
    position: &Position,
    names: &[String],
    profile: Profile,
    seed: u32,
    history: &[String],
    host: &mut H,
) -> SearchResult {
    search_cached(
        position,
        names,
        profile,
        seed,
        history,
        host,
        &mut Cache::default(),
    )
}

pub fn search_cached<H: Host>(
    position: &Position,
    names: &[String],
    profile: Profile,
    seed: u32,
    history: &[String],
    host: &mut H,
    cache: &mut Cache,
) -> SearchResult {
    let context = (
        position.turn,
        profile.tactical_depth,
        profile.advanced,
        profile.values,
    );
    if cache.context != Some(context) {
        *cache = Cache::default();
        cache.context = Some(context);
    }
    let start = host.now();
    let mut search = Search {
        host,
        profile,
        root: position.turn,
        start,
        deadline: start + profile.budget_ms,
        nodes: 0,
        table: std::mem::take(&mut cache.table),
        evaluations: std::mem::take(&mut cache.evaluations),
        killers: HashMap::new(),
        quiet_history: HashMap::new(),
    };
    let result = search.root_search(position, names, seed, history);
    cache.table = search.table;
    cache.evaluations = search.evaluations;
    result
}
