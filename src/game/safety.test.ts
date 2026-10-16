import { describe, expect, it } from 'vitest';
import { applyPreview, createGame, legalPreviews, moveOptions, previewAction } from './engine';
import { actionSafety, stationarySafety } from './safety';
import type { GameAction, GameState, Kind, Piece, Player } from './types';
const p = (
  id: string,
  kind: Kind,
  x: number,
  y: number,
  owner: Player = 'south',
  promoted = false,
): Piece => ({ id, kind, at: { x, y }, owner, promoted });
const board = (...pieces: Piece[]): GameState => ({
  ...createGame(),
  pieces: [p('own', 'walrus', 0, 8), p('enemy', 'walrus', 8, 0, 'north'), ...pieces],
});
const safety = (state: GameState, action: GameAction) => {
  const preview = previewAction(state, action);
  expect(preview).not.toBeNull();
  return actionSafety(state, preview!);
};
describe('complete action danger', () => {
  for (const [kind, promoted] of [
    ['seal', false],
    ['seal', true],
    ['penguin', false],
    ['penguin', true],
    ['bear', false],
    ['orca', false],
    ['orca', true],
  ] as const) {
    it(`detects capture of ${kind} ${promoted ? 'transformed' : 'base'} after moving`, () => {
      const mover = p('m', kind, 4, kind === 'bear' ? 6 : 5, 'south', promoted);
      // Jet stops on food at its destination; the enemy bear jumps to the resulting body.
      const state = board(mover, p('food', 'seal', 4, 4), p('hunter', 'bear', 6, 4, 'north'));
      const result = safety(state, { type: 'move', pieceId: 'm', to: { x: 4, y: 4 } });
      expect(result.pieceThreatened).toBe(true);
      expect(result.unsafe).toBe(true);
    });
  }
  it('evaluates new placements, including partial contact with a large body', () => {
    const state = board(p('friend', 'seal', 4, 6), p('hunter', 'bear', 6, 4, 'north'));
    expect(safety(state, { type: 'place', kind: 'orca', at: { x: 4, y: 4 } }).pieceThreatened).toBe(
      true,
    );
    expect(safety(state, { type: 'place', kind: 'seal', at: { x: 3, y: 6 } }).unsafe).toBe(false);
  });
  it('removes a captured attacker before testing danger but keeps other attackers', () => {
    const mover = p('m', 'penguin', 4, 5),
      hunter = p('hunter', 'seal', 4, 4, 'north');
    const state = board(mover, hunter);
    expect(safety(state, { type: 'move', pieceId: 'm', to: { x: 4, y: 4 } }).unsafe).toBe(false);
    expect(
      safety(
        { ...state, pieces: [...state.pieces, p('second', 'bear', 6, 4, 'north')] },
        { type: 'move', pieceId: 'm', to: { x: 4, y: 4 } },
      ).unsafe,
    ).toBe(true);
  });
  it('sees a jet revealed by removing its first blocker', () => {
    const state = board(
      p('m', 'penguin', 4, 5),
      p('blocker', 'seal', 4, 4, 'north'),
      p('jet', 'penguin', 4, 0, 'north', true),
    );
    expect(safety(state, { type: 'move', pieceId: 'm', to: { x: 4, y: 4 } }).pieceThreatened).toBe(
      true,
    );
    expect(
      safety(
        { ...state, pieces: [...state.pieces, p('stop', 'seal', 4, 2, 'north')] },
        { type: 'move', pieceId: 'm', to: { x: 4, y: 4 } },
      ).pieceThreatened,
    ).toBe(false);
  });
  it('checks the king when an otherwise safe move removes its blocker', () => {
    const state = {
      ...board(),
      pieces: [
        p('own', 'walrus', 4, 8),
        p('enemy', 'walrus', 8, 0, 'north'),
        p('jet', 'penguin', 4, 0, 'north', true),
        p('m', 'penguin', 4, 6),
      ],
    };
    const exposed = safety(state, { type: 'move', pieceId: 'm', to: { x: 3, y: 6 } });
    expect(exposed.pieceThreatened).toBe(false);
    expect(exposed.kingThreatened).toBe(true);
    expect(exposed.unsafe).toBe(true);
    const blocking = safety(state, { type: 'move', pieceId: 'm', to: { x: 4, y: 5 } });
    expect(blocking.kingThreatened).toBe(false);
    expect(blocking.pieceThreatened).toBe(true);
  });
  it('ignores unrelated endangered non-royal allies', () => {
    const state = board(
      p('m', 'penguin', 6, 7),
      p('ally', 'seal', 3, 4),
      p('hunter', 'seal', 3, 3, 'north'),
    );
    expect(safety(state, { type: 'move', pieceId: 'm', to: { x: 6, y: 6 } }).unsafe).toBe(false);
  });
  it('reassesses every own orca rotation instead of reusing landing danger', () => {
    const orca = p('m', 'orca', 4, 6);
    const state = board(orca, p('food', 'seal', 4, 4), p('hunter', 'seal', 5, 3, 'north'));
    const options = moveOptions(state, orca, { x: 4, y: 4 });
    expect(actionSafety(state, options[0]).unsafe).toBe(false);
    for (const option of options.slice(1))
      expect(actionSafety(state, option).unsafe).toBe(option.footprint.some((c) => c.x === 5));
    const capture = board(orca, p('food', 'seal', 4, 4), p('hunter', 'penguin', 5, 4, 'north'));
    const escaped = moveOptions(capture, orca, { x: 4, y: 4 }).find((o) =>
      o.captured.some((p) => p.id === 'hunter'),
    )!;
    expect(actionSafety(capture, moveOptions(capture, orca, { x: 4, y: 4 })[0]).unsafe).toBe(true);
    expect(actionSafety(capture, escaped).unsafe).toBe(false);
  });
  it('includes legal enemy L captures and excludes rotations that abandon the captured cell', () => {
    const state = board(
      p('m', 'bear', 6, 7),
      p('orca', 'orca', 4, 6, 'north'),
      p('food', 'seal', 5, 4, 'north'),
    );
    const action = { type: 'move' as const, pieceId: 'm', to: { x: 6, y: 5 } };
    expect(safety(state, action).unsafe).toBe(false);
    expect(
      safety(
        { ...state, pieces: [...state.pieces, p('second-food', 'seal', 5, 5, 'north')] },
        action,
      ).pieceThreatened,
    ).toBe(true);
  });
  it('uses each owner’s forward direction', () => {
    const state = {
      ...createGame(),
      turn: 'north' as const,
      pieces: [
        p('own', 'walrus', 0, 0, 'north'),
        p('enemy', 'walrus', 8, 8),
        p('m', 'penguin', 4, 3, 'north'),
        p('hunter', 'seal', 4, 5),
      ],
    };
    expect(safety(state, { type: 'move', pieceId: 'm', to: { x: 4, y: 4 } }).pieceThreatened).toBe(
      true,
    );
  });
  it('marks immediate own-king loss red, but a win or draw ends reply danger', () => {
    const mover = p('m', 'bear', 4, 4);
    const action = { type: 'move' as const, pieceId: 'm', to: { x: 4, y: 2 } };
    expect(
      safety(
        {
          ...board(mover, p('hunter', 'bear', 6, 2, 'north')),
          pieces: [mover, p('enemy', 'walrus', 4, 1, 'north'), p('hunter', 'bear', 6, 2, 'north')],
        },
        action,
      ).unsafe,
    ).toBe(false);
    expect(
      safety(
        {
          ...board(),
          pieces: [mover, p('own', 'walrus', 4, 1), p('enemy', 'walrus', 8, 0, 'north')],
        },
        action,
      ).losesGame,
    ).toBe(true);
    const draw = {
      ...board(),
      pieces: [p('m', 'orca', 3, 5), p('own', 'walrus', 2, 2), p('enemy', 'walrus', 4, 2, 'north')],
    };
    expect(
      safety(draw, {
        type: 'move',
        pieceId: 'm',
        to: { x: 3, y: 3 },
        transformation: { type: 'rotate', pivot: 0, direction: -1 },
      }).unsafe,
    ).toBe(false);
  });
  it('does not mutate the match during risk analysis', () => {
    const state = board(p('m', 'penguin', 4, 5), p('food', 'seal', 4, 4, 'north'));
    const original = structuredClone(state);
    safety(state, { type: 'move', pieceId: 'm', to: { x: 4, y: 4 } });
    expect(state).toEqual(original);
  });
});

describe('yellow king capture traps', () => {
  const action: GameAction = { type: 'move', pieceId: 'bait', to: { x: 4, y: 4 } };
  const trapBoard = (...extra: Piece[]): GameState => ({
    ...createGame(),
    pieces: [
      p('own', 'walrus', 0, 8),
      p('enemy', 'walrus', 4, 2, 'north'),
      p('bait', 'penguin', 3, 4),
      p('guard', 'penguin', 4, 8, 'south', true),
      ...extra,
    ],
  });
  const kingReplies = (state: GameState) => {
    const next = applyPreview(state, previewAction(state, action)!);
    return legalPreviews(next, false)
      .filter((reply) => reply.captured.some((victim) => victim.id === 'bait'))
      .map((reply) => applyPreview(next, reply));
  };
  it('requires every king capture footprint to allow a winning reply on the resulting board', () => {
    const state = trapBoard();
    const original = structuredClone(state);
    const result = safety(state, action);
    expect(result).toMatchObject({
      unsafe: true,
      pieceThreatened: true,
      kingThreatened: false,
      kingCaptureTrap: true,
    });
    const replies = kingReplies(state);
    expect(replies.length).toBeGreaterThan(1);
    for (const reply of replies)
      expect(
        legalPreviews(reply, false).some(
          (counter) => applyPreview(reply, counter).result?.winner === 'south',
        ),
      ).toBe(true);
    expect(state).toEqual(original);
  });
  it('stays red if even one king capture is safe, despite other punished captures', () => {
    const state = trapBoard();
    state.pieces = state.pieces.map((piece) =>
      piece.id === 'guard' ? p('guard', 'seal', 4, 6) : piece,
    );
    const punished = kingReplies(state).map((reply) =>
      legalPreviews(reply, false).some(
        (counter) => applyPreview(reply, counter).result?.winner === 'south',
      ),
    );
    expect(punished).toContain(true);
    expect(punished).toContain(false);
    expect(safety(state, action)).toMatchObject({ unsafe: true, kingCaptureTrap: false });
  });
  it('removes guards captured together with the bait before looking for retaliation', () => {
    const state = trapBoard();
    state.pieces = state.pieces.map((piece) =>
      piece.id === 'guard' ? p('guard', 'penguin', 4, 5, 'south', true) : piece,
    );
    expect(
      kingReplies(state).some((reply) => !reply.pieces.some((piece) => piece.id === 'guard')),
    ).toBe(true);
    expect(safety(state, action)).toMatchObject({ pieceThreatened: true, kingCaptureTrap: false });
  });
  it('stays red when a non-king attacker can also capture the bait', () => {
    expect(safety(trapBoard(p('bear', 'bear', 6, 4, 'north')), action)).toMatchObject({
      pieceThreatened: true,
      kingCaptureTrap: false,
    });
  });
  it('includes an enemy orca capturing the bait only through its L-shaped rotation', () => {
    const state = trapBoard(p('orca', 'orca', 6, 6, 'north'), p('food', 'seal', 5, 4, 'north'));
    const next = applyPreview(state, previewAction(state, action)!);
    const orcaCaptures = legalPreviews(next, false).filter(
      (reply) => reply.piece.id === 'orca' && reply.captured.some((piece) => piece.id === 'bait'),
    );
    expect(orcaCaptures.length).toBeGreaterThan(0);
    expect(
      orcaCaptures.every(
        (reply) => reply.action.type === 'move' && reply.action.transformation?.type === 'rotate',
      ),
    ).toBe(true);
    expect(safety(state, action).kingCaptureTrap).toBe(false);
  });
  it('never masks a threat to our king, even from an unrelated enemy piece', () => {
    const state = trapBoard(p('hunter', 'penguin', 0, 0, 'north', true));
    expect(safety(state, action)).toMatchObject({ kingThreatened: true, kingCaptureTrap: false });
  });
  it('does not promise a reply after the capturing king has already won the game', () => {
    const state = trapBoard();
    state.pieces = state.pieces.map((piece) =>
      piece.id === 'own' ? p('own', 'walrus', 3, 5) : piece,
    );
    expect(
      kingReplies(state).some(
        (reply) => reply.phase === 'finished' && reply.result?.winner === 'north',
      ),
    ).toBe(true);
    expect(safety(state, action).kingCaptureTrap).toBe(false);
  });
  it('includes a legal L-shaped winning recapture and rejects it when its enabling food is missing', () => {
    const state = trapBoard(p('food', 'seal', 3, 4));
    // Move the bait from another empty square; the food must stay to enable the guard rotation.
    state.pieces = state.pieces.map((piece) =>
      piece.id === 'guard'
        ? p('guard', 'orca', 2, 6)
        : piece.id === 'bait'
          ? p('bait', 'penguin', 3, 3)
          : piece,
    );
    const replies = kingReplies(state);
    const rotationOnly = replies.find((reply) => {
      const winning = legalPreviews(reply, false).filter(
        (counter) => applyPreview(reply, counter).result?.winner === 'south',
      );
      return (
        winning.length > 0 &&
        winning.every(
          (counter) =>
            counter.action.type === 'move' && counter.action.transformation?.type === 'rotate',
        )
      );
    });
    expect(rotationOnly).toBeDefined();
    expect(safety(state, action).kingCaptureTrap).toBe(true);
    expect(
      safety({ ...state, pieces: state.pieces.filter((piece) => piece.id !== 'food') }, action)
        .kingCaptureTrap,
    ).toBe(false);
  });
  it('checks the final footprint of large placed pieces, including partial king contact', () => {
    const state = trapBoard(p('neighbor', 'seal', 3, 6));
    state.pieces = state.pieces.filter((piece) => piece.id !== 'bait');
    expect(safety(state, { type: 'place', kind: 'orca', at: { x: 4, y: 4 } })).toMatchObject({
      pieceThreatened: true,
      kingCaptureTrap: true,
    });
  });
  it('works for the north player using its own forward direction', () => {
    const state = trapBoard();
    state.turn = 'north';
    state.pieces = state.pieces.map((piece) => ({
      ...piece,
      owner: piece.owner === 'south' ? 'north' : 'south',
      at: {
        x: 10 - (piece.kind === 'walrus' ? 2 : 1) - piece.at.x,
        y: 10 - (piece.kind === 'walrus' ? 2 : 1) - piece.at.y,
      },
    }));
    expect(
      safety(state, { type: 'move', pieceId: 'bait', to: { x: 5, y: 5 } }).kingCaptureTrap,
    ).toBe(true);
  });
  it('keeps safe actions, own king moves and completed games out of yellow', () => {
    expect(safety(board(p('bait', 'penguin', 3, 4)), action).kingCaptureTrap).toBe(false);
    const state = trapBoard();
    expect(
      safety(state, { type: 'move', pieceId: 'own', to: { x: 0, y: 7 } }).kingCaptureTrap,
    ).toBe(false);
    state.pieces = state.pieces.map((piece) =>
      piece.id === 'enemy' ? p('enemy', 'walrus', 4, 4, 'north') : piece,
    );
    expect(safety(state, action).kingCaptureTrap).toBe(false);
  });
});

describe('staying-put guide safety', () => {
  it('evaluates the current piece without a move, capture, promotion or state mutation', () => {
    const selected = p('m', 'seal', 4, 4);
    const state = board(selected, p('hunter', 'bear', 6, 4, 'north'));
    const original = structuredClone(state);
    expect(stationarySafety(state, selected)).toMatchObject({
      pieceThreatened: true,
      unsafe: true,
    });
    expect(state).toEqual(original);
    expect(
      previewAction(state, { type: 'move', pieceId: selected.id, to: selected.at }),
    ).toBeNull();
  });
  it('distinguishes a safe current position, king exposure and king-only capture traps', () => {
    const selected = p('m', 'penguin', 4, 4);
    const state = board(selected, p('guard', 'penguin', 4, 8, 'south', true));
    expect(stationarySafety(state, selected).unsafe).toBe(false);
    const trapped = {
      ...state,
      pieces: state.pieces.map((piece) =>
        piece.id === 'enemy' ? p('enemy', 'walrus', 4, 2, 'north') : piece,
      ),
    };
    expect(stationarySafety(trapped, selected).kingCaptureTrap).toBe(true);
    const exposed = {
      ...trapped,
      pieces: [...trapped.pieces, p('hunter', 'penguin', 0, 0, 'north', true)],
    };
    expect(stationarySafety(exposed, selected)).toMatchObject({
      kingThreatened: true,
      kingCaptureTrap: false,
    });
  });
  it('uses the opposing side for threats even when the selected piece is north', () => {
    const selected = p('m', 'penguin', 4, 4, 'north');
    const state = { ...board(selected, p('hunter', 'seal', 4, 5)), turn: 'north' as const };
    expect(stationarySafety(state, selected).pieceThreatened).toBe(true);
  });
});
