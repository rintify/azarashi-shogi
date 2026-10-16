use crate::model::*;

pub struct Targets {
    pub cells: [Cell; 24],
    pub len: usize,
}
impl Targets {
    fn new() -> Self {
        Self {
            cells: [Cell::default(); 24],
            len: 0,
        }
    }
    fn push(&mut self, cell: Cell) {
        self.cells[self.len] = cell;
        self.len += 1;
    }
    pub fn iter(&self) -> impl Iterator<Item = &Cell> {
        self.cells[..self.len].iter()
    }
}
pub fn destinations(position: &Position, slot: usize, board: &[u8; 100]) -> Targets {
    let mut targets = Targets::new();
    if position.finished {
        return targets;
    }
    let piece = position.pieces[slot];
    let forward = if piece.owner == Side::South { -1 } else { 1 };
    if piece.kind == Kind::Penguin && piece.promoted {
        let mut y = piece.at.y + forward;
        let mut target = None;
        while (0..SIZE).contains(&y) {
            let cell = Cell { x: piece.at.x, y };
            target = Some(cell);
            let occupied = board[cell.index()];
            if occupied != 0 && occupied != slot as u8 + 1 {
                break;
            }
            y += forward;
        }
        if let Some(cell) = target {
            targets.push(cell);
        }
        return targets;
    }
    let max_x = if matches!(piece.kind, Kind::Walrus | Kind::Bear)
        || (piece.kind == Kind::Orca && piece.promoted)
    {
        2i8
    } else {
        1
    };
    let max_y = if matches!(piece.kind, Kind::Walrus | Kind::Bear)
        || (piece.kind == Kind::Orca && !piece.promoted)
    {
        2i8
    } else {
        1
    };
    for dy in -max_y..=max_y {
        for dx in -max_x..=max_x {
            if dx == 0 && dy == 0 {
                continue;
            }
            if piece.kind == Kind::Seal && !piece.promoted && (dx != 0 || dy != forward) {
                continue;
            }
            if piece.kind == Kind::Bear && dx.abs().max(dy.abs()) != 2 {
                continue;
            }
            let moved = Piece {
                at: Cell {
                    x: piece.at.x + dx,
                    y: piece.at.y + dy,
                },
                ..piece
            };
            if moved.fits() {
                targets.push(moved.at);
            }
        }
    }
    targets
}
fn victims(body: &Body, board: &[u8; 100], source: usize) -> u32 {
    let mut mask = 0;
    for cell in body.iter() {
        let occupant = board[cell.index()];
        if occupant > 0 && occupant as usize != source + 1 {
            mask |= 1 << (occupant - 1);
        }
    }
    mask
}
fn rotate(piece: Piece, pivot: u8, direction: i8) -> Option<Piece> {
    let body = piece.body();
    let pivot_cell = body.cells[pivot as usize];
    let tip = body.cells[1 - pivot as usize];
    let rotated = Cell {
        x: pivot_cell.x - (tip.y - pivot_cell.y) * direction,
        y: pivot_cell.y + (tip.x - pivot_cell.x) * direction,
    };
    let transformed = Piece {
        at: Cell {
            x: pivot_cell.x.min(rotated.x),
            y: pivot_cell.y.min(rotated.y),
        },
        promoted: !piece.promoted,
        ..piece
    };
    transformed.fits().then_some(transformed)
}
fn append_moves(position: &Position, slot: usize, board: &[u8; 100], output: &mut Vec<Move>) {
    let original = position.pieces[slot];
    for &to in destinations(position, slot, board).iter() {
        let piece = Piece { at: to, ..original };
        let body = piece.body();
        let captured = victims(&body, board, slot);
        let base = Move {
            source: slot as u8,
            to,
            transformation: None,
            piece,
            captured,
        };
        output.push(base);
        if captured == 0 || !piece.can_transform() {
            continue;
        }
        if piece.kind != Kind::Orca {
            output.push(Move {
                piece: Piece {
                    promoted: !piece.promoted,
                    ..piece
                },
                transformation: Some(Transform::Promote),
                ..base
            });
            continue;
        }
        for pivot in 0..=1 {
            for direction in [-1, 1] {
                let Some(transformed) = rotate(piece, pivot, direction) else {
                    continue;
                };
                let after = transformed.body();
                // Rotation must keep an occupied cell of the initial landing under its final body.
                if !after.iter().any(|cell| {
                    body.iter().any(|landing| {
                        let occupant = board[landing.index()];
                        cell == landing && occupant != 0 && occupant as usize != slot + 1
                    })
                }) {
                    continue;
                }
                output.push(Move {
                    piece: transformed,
                    transformation: Some(Transform::Rotate { pivot, direction }),
                    captured: captured | victims(&after, board, slot),
                    ..base
                });
            }
        }
    }
}
fn append_placements(position: &Position, board: &[u8; 100], output: &mut Vec<Move>) {
    if position.active.count_ones() as usize >= MAX_PIECES {
        return;
    }
    let mut adjacent = [false; 100];
    for slot in position
        .slots()
        .filter(|&slot| position.pieces[slot].owner == position.turn)
    {
        for cell in position.pieces[slot].body().iter() {
            for dy in -1..=1 {
                for dx in -1..=1 {
                    if dx == 0 && dy == 0 {
                        continue;
                    }
                    let target = Cell {
                        x: cell.x + dx,
                        y: cell.y + dy,
                    };
                    if (0..SIZE).contains(&target.x) && (0..SIZE).contains(&target.y) {
                        adjacent[target.index()] = true;
                    }
                }
            }
        }
    }
    for kind in KINDS.into_iter().filter(|&kind| {
        kind != Kind::Walrus && position.stocks[position.turn.index()][kind.index()] > 0
    }) {
        for y in 0..SIZE {
            for x in 0..SIZE {
                let piece = Piece {
                    kind,
                    owner: position.turn,
                    at: Cell { x, y },
                    promoted: false,
                };
                if !piece.fits() {
                    continue;
                }
                let body = piece.body();
                if body.iter().any(|cell| board[cell.index()] != 0)
                    || !body.iter().any(|cell| adjacent[cell.index()])
                {
                    continue;
                }
                output.push(Move {
                    source: u8::MAX,
                    to: piece.at,
                    transformation: None,
                    piece,
                    captured: 0,
                });
            }
        }
    }
}
pub fn legal_moves(position: &Position, include_placements: bool) -> Vec<Move> {
    let mut result = Vec::with_capacity(if include_placements { 256 } else { 128 });
    if position.finished {
        return result;
    }
    let board = position.board();
    for slot in position
        .slots()
        .filter(|&slot| position.pieces[slot].owner == position.turn)
    {
        append_moves(position, slot, &board, &mut result);
    }
    if include_placements {
        append_placements(position, &board, &mut result);
    }
    result
}
pub fn apply(position: &Position, action: Move) -> Position {
    let mut next = *position;
    next.active &= !action.captured;
    let slot = if action.is_place() {
        next.stocks[position.turn.index()][action.piece.kind.index()] -= 1;
        (!next.active).trailing_zeros() as usize
    } else {
        action.source as usize
    };
    let mut dead_kings = 0u8;
    for victim in bits(action.captured).map(|index| position.pieces[index]) {
        if victim.kind == Kind::Walrus {
            dead_kings |= 1 << victim.owner.index();
        } else {
            next.stocks[position.turn.index()][victim.kind.index()] += 1;
        }
    }
    next.pieces[slot] = action.piece;
    next.active |= 1 << slot;
    if dead_kings != 0 {
        next.finished = true;
        next.result = match dead_kings {
            1 => 2,
            2 => 1,
            _ => 3,
        };
    }
    next.turn = position.turn.other();
    next.revision += 1;
    next
}
pub fn is_win(position: &Position, action: Move, side: Side) -> bool {
    let mut dead = 0;
    for slot in bits(action.captured) {
        let piece = position.pieces[slot];
        if piece.kind == Kind::Walrus {
            dead |= 1 << piece.owner.index();
        }
    }
    dead == 1 << side.other().index()
}
