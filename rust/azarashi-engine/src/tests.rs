use crate::{
    model::*,
    rules::*,
    search::{search, Host, Profile},
};

fn piece(kind: Kind, x: i8, y: i8, owner: Side, promoted: bool) -> Piece {
    Piece {
        kind,
        at: Cell { x, y },
        owner,
        promoted,
    }
}
fn position(pieces: &[Piece]) -> Position {
    let mut p = Position::default();
    for (slot, &piece) in pieces.iter().enumerate() {
        p.pieces[slot] = piece;
        p.active |= 1 << slot;
    }
    p
}
fn profile() -> Profile {
    Profile {
        budget_ms: 1000.0,
        max_depth: 3,
        noise: 0.0,
        tactical_depth: 2,
        advanced: true,
        values: [100.0, 230.0, 320.0, 470.0, 50000.0],
        max_nodes: None,
    }
}
#[derive(Default)]
struct Clock {
    time: f64,
}
impl Host for Clock {
    fn now(&mut self) -> f64 {
        self.time += 0.01;
        self.time
    }
    fn progress(&mut self, _: u8, _: u64, _: f64) {}
}
#[test]
fn movement_ranges_and_square_edges() {
    for (kind, promoted, expected) in [
        (Kind::Seal, false, 1),
        (Kind::Seal, true, 8),
        (Kind::Penguin, false, 8),
        (Kind::Penguin, true, 1),
        (Kind::Bear, false, 16),
        (Kind::Orca, false, 14),
        (Kind::Orca, true, 14),
        (Kind::Walrus, false, 24),
    ] {
        let p = position(&[piece(kind, 4, 4, Side::South, promoted)]);
        assert_eq!(destinations(&p, 0, &p.board()).len, expected);
    }
    let p = position(&[piece(Kind::Walrus, 0, 0, Side::South, false)]);
    assert!(legal_moves(&p, true).iter().all(|m| m.piece.fits()));
}
#[test]
fn jet_stops_at_first_friendly_piece() {
    let p = position(&[
        piece(Kind::Penguin, 4, 7, Side::South, true),
        piece(Kind::Seal, 4, 4, Side::South, false),
        piece(Kind::Seal, 4, 2, Side::North, false),
    ]);
    let base = legal_moves(&p, false)
        .into_iter()
        .find(|m| m.source == 0 && m.transformation.is_none())
        .unwrap();
    assert_eq!(base.to, Cell { x: 4, y: 4 });
    assert_eq!(base.captured, 1 << 1);
}
#[test]
fn l_capture_can_finish_as_a_draw_without_stocking_kings() {
    let p = position(&[
        piece(Kind::Walrus, 2, 2, Side::South, false),
        piece(Kind::Walrus, 4, 2, Side::North, false),
        piece(Kind::Orca, 3, 5, Side::South, false),
    ]);
    let m = legal_moves(&p, false)
        .into_iter()
        .find(|m| {
            m.source == 2
                && m.to == Cell { x: 3, y: 3 }
                && m.transformation
                    == Some(Transform::Rotate {
                        pivot: 0,
                        direction: -1,
                    })
        })
        .unwrap();
    let next = apply(&p, m);
    assert!(next.finished);
    assert_eq!(next.result, 3);
    assert_eq!(next.stocks[0][Kind::Walrus.index()], 0);
}
#[test]
fn every_generated_action_conserves_nonroyal_material() {
    let p = position(&[
        piece(Kind::Walrus, 0, 8, Side::South, false),
        piece(Kind::Walrus, 8, 0, Side::North, false),
        piece(Kind::Orca, 4, 6, Side::South, false),
        piece(Kind::Seal, 4, 4, Side::South, false),
        piece(Kind::Penguin, 5, 4, Side::North, false),
    ]);
    let count = |p: &Position| {
        p.slots()
            .filter(|&slot| p.pieces[slot].kind != Kind::Walrus)
            .count()
            + p.stocks
                .iter()
                .map(|s| s[..4].iter().map(|&v| v as usize).sum::<usize>())
                .sum::<usize>()
    };
    for m in legal_moves(&p, true) {
        assert_eq!(count(&p), count(&apply(&p, m)));
    }
}
#[test]
fn search_finds_l_wins_and_returns_legal_timeout_fallbacks() {
    let p = position(&[
        piece(Kind::Walrus, 0, 8, Side::South, false),
        piece(Kind::Walrus, 5, 3, Side::North, false),
        piece(Kind::Orca, 3, 6, Side::South, false),
        piece(Kind::Seal, 4, 4, Side::South, false),
    ]);
    let names: Vec<_> = (0..MAX_PIECES).map(|i| format!("p{i}")).collect();
    let result = search(&p, &names, profile(), 12, &[], &mut Clock::default());
    assert!(is_win(&p, result.best.unwrap(), Side::South));
    let p = position(&[
        piece(Kind::Walrus, 0, 8, Side::South, false),
        piece(Kind::Walrus, 8, 0, Side::North, false),
    ]);
    let result = search(
        &p,
        &names,
        Profile {
            budget_ms: 0.0,
            ..profile()
        },
        12,
        &[],
        &mut Clock::default(),
    );
    assert!(result.timed_out);
    assert!(legal_moves(&p, true)
        .iter()
        .any(|m| m.key() == result.best.unwrap().key()));
}
#[test]
fn malformed_requests_fail_without_running_search() {
    assert!(crate::process(b"not json", false).is_err());
    assert!(crate::process(b"{}", false).is_err());
}
