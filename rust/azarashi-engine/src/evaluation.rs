use crate::model::*;
use crate::rules::{destinations, is_win, legal_moves};

#[derive(Clone, Copy)]
pub struct Evaluation {
    pub score: f64,
    pub king_in_danger: bool,
    pub can_win_immediately: bool,
}

pub fn evaluate(position: &Position, root: Side, values: &[f64; 5]) -> Evaluation {
    let board = position.board();
    let mut result = Evaluation {
        score: 0.0,
        king_in_danger: false,
        can_win_immediately: false,
    };
    for side in [root, root.other()] {
        let sign = if side == root { 1.0 } else { -1.0 };
        for kind in KINDS.into_iter().filter(|&kind| kind != Kind::Walrus) {
            result.score += sign
                * position.stocks[side.index()][kind.index()] as f64
                * values[kind.index()]
                * 0.72;
        }
        for slot in position
            .slots()
            .filter(|&slot| position.pieces[slot].owner == side)
        {
            let p = position.pieces[slot];
            let center = 9.0 - (p.at.x as f64 - 4.5).abs() - (p.at.y as f64 - 4.5).abs();
            let promoted = if p.promoted && p.kind == Kind::Seal {
                145.0
            } else if p.promoted && p.kind == Kind::Penguin {
                30.0
            } else {
                0.0
            };
            result.score += sign
                * (values[p.kind.index()]
                    + promoted
                    + center * if p.kind == Kind::Walrus { 0.8 } else { 2.3 }
                    + destinations(position, slot, &board).len as f64 * 1.5);
        }
        let attacker = side.other();
        let mut attacking = *position;
        attacking.turn = attacker;
        let mut threatened = 0;
        for action in legal_moves(&attacking, false) {
            threatened |= action.captured;
            if attacker == position.turn && is_win(position, action, attacker) {
                result.can_win_immediately = true;
            }
        }
        for target in bits(threatened)
            .map(|slot| position.pieces[slot])
            .filter(|p| p.owner == side)
        {
            let cost = if target.kind == Kind::Walrus {
                if position.turn == side {
                    17000.0
                } else {
                    35000.0
                }
            } else {
                values[target.kind.index()] * 0.18
            };
            result.score -= sign * cost;
            if target.kind == Kind::Walrus && position.turn == side {
                result.king_in_danger = true;
            }
        }
    }
    result
}
