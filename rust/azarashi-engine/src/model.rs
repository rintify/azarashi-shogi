use serde::{Deserialize, Serialize};

pub const SIZE: i8 = 10;
pub const MAX_PIECES: usize = 26;
pub const RULES_VERSION: u32 = 2;

#[derive(Clone, Copy, Debug, Default, PartialEq, Eq, Hash, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum Side {
    #[default]
    South,
    North,
}
impl Side {
    pub fn index(self) -> usize {
        self as usize
    }
    pub fn other(self) -> Self {
        if self == Self::South {
            Self::North
        } else {
            Self::South
        }
    }
    pub fn name(self) -> &'static str {
        if self == Self::South {
            "south"
        } else {
            "north"
        }
    }
}

#[derive(Clone, Copy, Debug, Default, PartialEq, Eq, Hash, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum Kind {
    #[default]
    Seal,
    Penguin,
    Bear,
    Orca,
    Walrus,
}
pub const KINDS: [Kind; 5] = [
    Kind::Seal,
    Kind::Penguin,
    Kind::Bear,
    Kind::Orca,
    Kind::Walrus,
];
impl Kind {
    pub fn index(self) -> usize {
        self as usize
    }
    pub fn name(self) -> &'static str {
        ["seal", "penguin", "bear", "orca", "walrus"][self.index()]
    }
}

#[derive(Clone, Copy, Debug, Default, PartialEq, Eq, Hash, Serialize, Deserialize)]
pub struct Cell {
    pub x: i8,
    pub y: i8,
}
impl Cell {
    pub fn index(self) -> usize {
        (self.y * SIZE + self.x) as usize
    }
}

#[derive(Clone, Copy, Debug, Default, PartialEq, Eq)]
pub struct Piece {
    pub kind: Kind,
    pub owner: Side,
    pub at: Cell,
    pub promoted: bool,
}
impl Piece {
    pub fn dimensions(self) -> (i8, i8) {
        match self.kind {
            Kind::Walrus => (2, 2),
            Kind::Orca if self.promoted => (2, 1),
            Kind::Orca => (1, 2),
            _ => (1, 1),
        }
    }
    pub fn fits(self) -> bool {
        let (w, h) = self.dimensions();
        self.at.x >= 0 && self.at.y >= 0 && self.at.x + w <= SIZE && self.at.y + h <= SIZE
    }
    pub fn body(self) -> Body {
        let (w, h) = self.dimensions();
        let mut body = Body::default();
        for dy in 0..h {
            for dx in 0..w {
                body.push(Cell {
                    x: self.at.x + dx,
                    y: self.at.y + dy,
                });
            }
        }
        body
    }
    pub fn can_transform(self) -> bool {
        matches!(self.kind, Kind::Penguin | Kind::Orca)
            || (self.kind == Kind::Seal && !self.promoted)
    }
}

#[derive(Clone, Copy, Default)]
pub struct Body {
    pub cells: [Cell; 4],
    pub len: usize,
}
impl Body {
    fn push(&mut self, cell: Cell) {
        self.cells[self.len] = cell;
        self.len += 1;
    }
    pub fn iter(&self) -> impl Iterator<Item = &Cell> {
        self.cells[..self.len].iter()
    }
}

#[derive(Clone, Copy, Debug, PartialEq, Eq, Hash, Serialize, Deserialize)]
#[serde(tag = "type", rename_all = "lowercase")]
pub enum Transform {
    Promote,
    Rotate { pivot: u8, direction: i8 },
}

#[derive(Clone, Copy)]
pub struct Move {
    // 255 means stock placement; all other sources are stable piece slots.
    pub source: u8,
    pub to: Cell,
    pub transformation: Option<Transform>,
    pub piece: Piece,
    pub captured: u32,
}
impl Move {
    pub fn is_place(self) -> bool {
        self.source == u8::MAX
    }
    pub fn key(self) -> u64 {
        let transformation = match self.transformation {
            None => 0,
            Some(Transform::Promote) => 1,
            Some(Transform::Rotate { pivot, direction }) => 2 + pivot * 2 + u8::from(direction > 0),
        };
        self.source as u64
            | ((self.piece.kind as u64) << 8)
            | ((self.to.index() as u64) << 16)
            | ((transformation as u64) << 24)
    }
}

// Fixed slots and capture bitsets avoid allocating a full object tree at every search node.
#[derive(Clone, Copy)]
pub struct Position {
    pub pieces: [Piece; MAX_PIECES],
    pub active: u32,
    pub stocks: [[u8; 5]; 2],
    pub turn: Side,
    pub revision: u32,
    pub finished: bool,
    // 0 = ongoing/no result, 1 = south win, 2 = north win, 3 = draw.
    pub result: u8,
}
impl Default for Position {
    fn default() -> Self {
        Self {
            pieces: [Piece::default(); MAX_PIECES],
            active: 0,
            stocks: [[0; 5]; 2],
            turn: Side::South,
            revision: 0,
            finished: false,
            result: 0,
        }
    }
}
impl Position {
    pub fn slots(&self) -> impl Iterator<Item = usize> {
        bits(self.active)
    }
    pub fn board(&self) -> [u8; 100] {
        let mut board = [0; 100];
        for slot in self.slots() {
            for cell in self.pieces[slot].body().iter() {
                board[cell.index()] = slot as u8 + 1;
            }
        }
        board
    }
    pub fn hash(&self) -> u64 {
        let mut hash = 0xcbf29ce484222325u64;
        let mut mix = |value: u8| {
            hash = (hash ^ value as u64).wrapping_mul(0x100000001b3);
        };
        mix(self.turn as u8);
        mix(self.finished as u8);
        mix(self.result);
        for slot in self.slots() {
            let p = self.pieces[slot];
            mix(slot as u8);
            mix(p.owner as u8);
            mix(p.kind as u8);
            mix(p.promoted as u8);
            mix(p.at.index() as u8);
        }
        mix(255);
        for stock in self.stocks {
            for value in stock {
                mix(value);
            }
        }
        hash
    }
    pub fn identity(&self) -> String {
        let mut pieces: Vec<_> = self
            .slots()
            .map(|slot| {
                let p = self.pieces[slot];
                format!(
                    "{}:{}:{}:{},{}",
                    p.owner.name(),
                    p.kind.name(),
                    p.promoted as u8,
                    p.at.x,
                    p.at.y
                )
            })
            .collect();
        pieces.sort();
        let stocks: Vec<_> = self
            .stocks
            .iter()
            .map(|stock| {
                stock
                    .iter()
                    .map(u8::to_string)
                    .collect::<Vec<_>>()
                    .join(",")
            })
            .collect();
        format!(
            "{}/{}/{}/{}/{}",
            if self.finished { "finished" } else { "playing" },
            self.turn.name(),
            pieces.join(";"),
            stocks[0],
            stocks[1]
        )
    }
}
pub fn bits(mut mask: u32) -> impl Iterator<Item = usize> {
    std::iter::from_fn(move || {
        if mask == 0 {
            return None;
        }
        let slot = mask.trailing_zeros() as usize;
        mask &= mask - 1;
        Some(slot)
    })
}
