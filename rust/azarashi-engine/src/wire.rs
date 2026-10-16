use crate::{
    evaluation::{evaluate, Evaluation},
    model::*,
    rules::{apply, legal_moves},
    search::{Profile, SearchResult},
};
use serde::{Deserialize, Serialize};

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Request {
    pub state: WirePosition,
    pub profile: Profile,
    #[serde(default)]
    pub seed: u32,
    #[serde(default)]
    pub position_history: Vec<String>,
}
#[derive(Serialize, Deserialize)]
pub struct WirePiece {
    pub id: String,
    pub kind: Kind,
    pub owner: Side,
    pub at: Cell,
    pub promoted: bool,
}
#[derive(Serialize, Deserialize)]
pub struct Stock {
    pub seal: u8,
    pub penguin: u8,
    pub bear: u8,
    pub orca: u8,
    pub walrus: u8,
}
impl Stock {
    fn array(&self) -> [u8; 5] {
        [self.seal, self.penguin, self.bear, self.orca, self.walrus]
    }
    fn from_array(v: [u8; 5]) -> Self {
        Self {
            seal: v[0],
            penguin: v[1],
            bear: v[2],
            orca: v[3],
            walrus: v[4],
        }
    }
}
#[derive(Serialize, Deserialize)]
pub struct Stocks {
    pub south: Stock,
    pub north: Stock,
}
#[derive(Serialize, Deserialize)]
pub struct Outcome {
    pub winner: Option<Side>,
    pub reason: String,
}
#[derive(Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct WirePosition {
    pub rules_version: u32,
    pub revision: u32,
    pub phase: String,
    pub turn: Side,
    pub pieces: Vec<WirePiece>,
    pub stocks: Stocks,
    pub result: Option<Outcome>,
}
#[derive(Serialize)]
#[serde(tag = "type", rename_all = "lowercase")]
pub enum Action {
    Move {
        #[serde(rename = "pieceId")]
        piece_id: String,
        to: Cell,
        #[serde(skip_serializing_if = "Option::is_none")]
        transformation: Option<Transform>,
    },
    Place {
        kind: Kind,
        at: Cell,
    },
}
#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct Preview {
    action: Action,
    piece: WirePiece,
    from: Option<Cell>,
    footprint: Vec<Cell>,
    capture_cells: Vec<Cell>,
    captured: Vec<WirePiece>,
    after: WirePosition,
}
#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ResultMessage {
    action: Option<Action>,
    score: f64,
    depth: u8,
    nodes: u64,
    elapsed_ms: f64,
    timed_out: bool,
}
#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
struct EvaluationMessage {
    score: f64,
    king_in_danger: bool,
    can_win_immediately: bool,
}
impl From<Evaluation> for EvaluationMessage {
    fn from(e: Evaluation) -> Self {
        Self {
            score: e.score,
            king_in_danger: e.king_in_danger,
            can_win_immediately: e.can_win_immediately,
        }
    }
}
#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct Inspection {
    rules_version: u32,
    position_identity: String,
    evaluation: EvaluationMessage,
    moves: Vec<Preview>,
}

pub fn decode(wire: &WirePosition) -> Result<(Position, Vec<String>), String> {
    if wire.rules_version != RULES_VERSION {
        return Err("Rule version does not match the Rust engine".into());
    }
    if wire.pieces.len() > MAX_PIECES {
        return Err("Too many pieces".into());
    }
    if wire.phase != "playing" && wire.phase != "finished" {
        return Err("Unknown phase".into());
    }
    let mut position = Position {
        turn: wire.turn,
        revision: wire.revision,
        finished: wire.phase == "finished",
        stocks: [wire.stocks.south.array(), wire.stocks.north.array()],
        result: match &wire.result {
            None => 0,
            Some(result) => match result.winner {
                Some(Side::South) => 1,
                Some(Side::North) => 2,
                None => 3,
            },
        },
        ..Position::default()
    };
    if position
        .stocks
        .iter()
        .flat_map(|s| s.iter())
        .map(|&v| v as usize)
        .sum::<usize>()
        + wire.pieces.len()
        > MAX_PIECES
    {
        return Err("Piece and stock count exceeds the ruleset limit".into());
    }
    let mut occupied = [false; 100];
    let mut names = vec![String::new(); MAX_PIECES];
    for (slot, p) in wire.pieces.iter().enumerate() {
        let piece = Piece {
            kind: p.kind,
            owner: p.owner,
            at: p.at,
            promoted: p.promoted,
        };
        if !piece.fits() || p.id.is_empty() || names[..slot].contains(&p.id) {
            return Err("Invalid piece".into());
        }
        for cell in piece.body().iter() {
            if occupied[cell.index()] {
                return Err("Overlapping pieces".into());
            }
            occupied[cell.index()] = true;
        }
        names[slot] = p.id.clone();
        position.pieces[slot] = piece;
        position.active |= 1 << slot;
    }
    Ok((position, names))
}
pub fn action(action: Move, names: &[String]) -> Action {
    if action.is_place() {
        Action::Place {
            kind: action.piece.kind,
            at: action.to,
        }
    } else {
        Action::Move {
            piece_id: names[action.source as usize].clone(),
            to: action.to,
            transformation: action.transformation,
        }
    }
}
pub fn action_key(action: Move, names: &[String]) -> String {
    if action.is_place() {
        return format!(
            "p:{}:{},{}",
            action.piece.kind.name(),
            action.to.x,
            action.to.y
        );
    }
    let change = match action.transformation {
        None => "-".into(),
        Some(Transform::Promote) => "t".into(),
        Some(Transform::Rotate { pivot, direction }) => format!("{pivot}:{direction}"),
    };
    format!(
        "m:{}:{},{}:{}",
        names[action.source as usize], action.to.x, action.to.y, change
    )
}
fn piece(piece: Piece, id: String) -> WirePiece {
    WirePiece {
        id,
        kind: piece.kind,
        owner: piece.owner,
        at: piece.at,
        promoted: piece.promoted,
    }
}
fn encode_position(position: &Position, names: &[String]) -> WirePosition {
    WirePosition {
        rules_version: RULES_VERSION,
        revision: position.revision,
        phase: if position.finished {
            "finished"
        } else {
            "playing"
        }
        .into(),
        turn: position.turn,
        pieces: position
            .slots()
            .map(|slot| piece(position.pieces[slot], names[slot].clone()))
            .collect(),
        stocks: Stocks {
            south: Stock::from_array(position.stocks[0]),
            north: Stock::from_array(position.stocks[1]),
        },
        result: match position.result {
            1 => Some(Outcome {
                winner: Some(Side::South),
                reason: "king-captured".into(),
            }),
            2 => Some(Outcome {
                winner: Some(Side::North),
                reason: "king-captured".into(),
            }),
            3 => Some(Outcome {
                winner: None,
                reason: "both-kings".into(),
            }),
            _ => None,
        },
    }
}
fn preview(position: &Position, m: Move, names: &[String]) -> Preview {
    let id = if m.is_place() {
        format!("p{}", position.revision)
    } else {
        names[m.source as usize].clone()
    };
    let body = if m.is_place() {
        Vec::new()
    } else {
        Piece {
            at: m.to,
            ..position.pieces[m.source as usize]
        }
        .body()
        .iter()
        .copied()
        .collect::<Vec<_>>()
    };
    let mut capture_cells = body;
    if m.transformation.is_some() {
        for &cell in m.piece.body().iter() {
            if !capture_cells.contains(&cell) {
                capture_cells.push(cell);
            }
        }
    }
    let board = position.board();
    let mut seen = 0u32;
    let mut captured = Vec::new();
    for cell in &capture_cells {
        let occupant = board[cell.index()];
        if occupant == 0 {
            continue;
        }
        let slot = occupant as usize - 1;
        if m.captured & (1 << slot) != 0 && seen & (1 << slot) == 0 {
            captured.push(piece(position.pieces[slot], names[slot].clone()));
            seen |= 1 << slot;
        }
    }
    let after = apply(position, m);
    let mut after_names = names.to_vec();
    if m.is_place() {
        after_names[(!position.active).trailing_zeros() as usize] = id.clone();
    }
    Preview {
        action: action(m, names),
        piece: piece(m.piece, id),
        from: if m.is_place() {
            None
        } else {
            Some(position.pieces[m.source as usize].at)
        },
        footprint: m.piece.body().iter().copied().collect(),
        capture_cells,
        captured,
        after: encode_position(&after, &after_names),
    }
}
pub fn inspect(position: &Position, names: &[String], profile: &Profile) -> Inspection {
    Inspection {
        rules_version: RULES_VERSION,
        position_identity: position.identity(),
        evaluation: evaluate(position, position.turn, &profile.values).into(),
        moves: legal_moves(position, true)
            .into_iter()
            .map(|m| preview(position, m, names))
            .collect(),
    }
}
pub fn result(result: SearchResult, names: &[String]) -> ResultMessage {
    ResultMessage {
        action: result.best.map(|m| action(m, names)),
        score: result.score,
        depth: result.depth,
        nodes: result.nodes,
        elapsed_ms: result.elapsed_ms,
        timed_out: result.timed_out,
    }
}
