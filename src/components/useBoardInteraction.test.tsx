// @vitest-environment jsdom
import { act, cleanup, render, renderHook, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { createGame } from '../game/engine';
import type { Piece } from '../game/types';
import { useBoardInteraction } from './useBoardInteraction';
import { ActionDock } from './ActionDock';
afterEach(cleanup);
const penguin: Piece = {
  id: 'p',
  kind: 'penguin',
  owner: 'south',
  at: { x: 4, y: 7 },
  promoted: false,
};
const food: Piece = { id: 's', kind: 'seal', owner: 'south', at: { x: 3, y: 7 }, promoted: false };
describe('guided board interaction', () => {
  it('lets touch users compare transformation footprints before confirming a capture', () => {
    const submit = vi.fn();
    const game = { ...createGame(), phase: 'playing' as const, pieces: [penguin, food] };
    const hook = renderHook(() => useBoardInteraction(game, 'south', submit));
    act(() => hook.result.current.clickCell(penguin.at));
    act(() => hook.result.current.clickCell(food.at));
    expect(submit).not.toHaveBeenCalled();
    expect(hook.result.current.pending).toHaveLength(2);
    act(() => hook.result.current.setOptionIndex(1));
    expect(hook.result.current.preview?.piece.promoted).toBe(true);
    act(() => hook.result.current.chooseOption(hook.result.current.preview!));
    expect(submit).toHaveBeenCalledWith(
      { type: 'move', pieceId: 'p', to: food.at, transformation: { type: 'promote' } },
      0,
    );
  });
  it('cancels a capture choice without changing canonical state', () => {
    const submit = vi.fn();
    const game = { ...createGame(), phase: 'playing' as const, pieces: [penguin, food] };
    const hook = renderHook(() => useBoardInteraction(game, 'south', submit));
    act(() => hook.result.current.clickCell(penguin.at));
    act(() => hook.result.current.clickCell(food.at));
    act(() => hook.result.current.clearChoice());
    expect(hook.result.current.pending).toBeNull();
    expect(hook.result.current.selected?.id).toBe('p');
    expect(submit).not.toHaveBeenCalled();
  });
});

it('executes a capture with no transformation choice immediately', () => {
  const submit = vi.fn();
  const bear: Piece = { ...penguin, kind: 'bear', at: { x: 4, y: 5 } };
  const target: Piece = { ...food, at: { x: 4, y: 3 } };
  const game = { ...createGame(), phase: 'playing' as const, pieces: [bear, target] };
  const hook = renderHook(() => useBoardInteraction(game, 'south', submit));
  act(() => hook.result.current.clickCell(bear.at));
  act(() => hook.result.current.clickCell(target.at));
  expect(hook.result.current.pending).toBeNull();
  expect(submit).toHaveBeenCalledWith({ type: 'move', pieceId: 'p', to: target.at }, 0);
});
it('blocks board and stock input during animation, and supports explicit selection cancellation', () => {
  const submit = vi.fn(),
    game = { ...createGame(), phase: 'playing' as const, pieces: [penguin, food] };
  const hook = renderHook(({ enabled }) => useBoardInteraction(game, 'south', submit, enabled), {
    initialProps: { enabled: false },
  });
  act(() => {
    hook.result.current.clickCell(penguin.at);
    hook.result.current.selectStock('seal');
  });
  expect(hook.result.current.selected).toBeNull();
  expect(hook.result.current.activeKind).toBeNull();
  hook.rerender({ enabled: true });
  act(() => hook.result.current.clickCell(penguin.at));
  expect(hook.result.current.selected).not.toBeNull();
  act(() => hook.result.current.clearSelection());
  expect(hook.result.current.selected).toBeNull();
  expect(submit).not.toHaveBeenCalled();
});

it('shows a warning-only confirmation for a single-option friendly king capture', () => {
  const submit = vi.fn();
  const bear: Piece = { ...penguin, kind: 'bear', at: { x: 4, y: 5 } };
  const king: Piece = { ...food, kind: 'walrus', at: { x: 4, y: 2 } };
  const game = { ...createGame(), phase: 'playing' as const, pieces: [bear, king] };
  const hook = renderHook(() => useBoardInteraction(game, 'south', submit));
  act(() => hook.result.current.clickCell(bear.at));
  act(() => hook.result.current.clickCell({ x: 4, y: 3 }));
  expect(hook.result.current.pending).toHaveLength(1);
  expect(submit).not.toHaveBeenCalled();
  render(
    <ActionDock
      game={game}
      settings={{ human: 'south', difficulty: 3 }}
      interaction={hook.result.current}
      onHelp={() => {}}
    />,
  );
  expect(screen.getByText('自分の王を捕食します')).toBeTruthy();
  expect(screen.queryByRole('heading', { name: '変身を選択' })).toBeNull();
  expect(screen.queryByRole('button', { name: '次の変身候補' })).toBeNull();
  expect(screen.getByRole('button', { name: 'この手を指す' })).toBeTruthy();
});
it('marks risky king destinations without removing legal moves', () => {
  const own: Piece = { ...penguin, id: 'own', kind: 'walrus', at: { x: 4, y: 8 } };
  const enemy: Piece = { ...own, id: 'enemy', owner: 'north', at: { x: 3, y: 3 } };
  const game = { ...createGame(), phase: 'playing' as const, pieces: [own, enemy] };
  const submit = vi.fn();
  const hook = renderHook(() => useBoardInteraction(game, 'south', submit));
  act(() => hook.result.current.clickCell(own.at));
  expect(hook.result.current.unsafeCells).toContainEqual({ x: 4, y: 6 });
  expect(hook.result.current.legalCells).toContainEqual({ x: 4, y: 6 });
  act(() => hook.result.current.clickCell({ x: 4, y: 6 }));
  expect(submit).toHaveBeenCalledWith({ type: 'move', pieceId: 'own', to: { x: 4, y: 6 } }, 0);
});

it('shades the entire reachable footprint without treating trailing cells as destination anchors', () => {
  const orca: Piece = { ...penguin, kind: 'orca', at: { x: 4, y: 5 } };
  const game = { ...createGame(), phase: 'playing' as const, pieces: [orca] };
  const hook = renderHook(() => useBoardInteraction(game, 'south', vi.fn()));
  act(() => hook.result.current.clickCell(orca.at));
  expect(hook.result.current.legalCells).toContainEqual({ x: 4, y: 7 });
  expect(hook.result.current.legalCells).not.toContainEqual({ x: 4, y: 8 });
  expect(hook.result.current.reachableCells).toContainEqual({ x: 4, y: 8 });
  const keys = hook.result.current.reachableCells.map(({ x, y }) => `${x},${y}`);
  expect(new Set(keys).size).toBe(keys.length);
  act(() => hook.result.current.clearSelection());
  expect(hook.result.current.reachableCells).toEqual([]);
});

it('includes all legal orca rotation footprints in the same reachable guide', () => {
  const orca: Piece = { ...penguin, kind: 'orca', at: { x: 4, y: 6 } };
  const target: Piece = { ...food, owner: 'north', at: { x: 5, y: 4 } };
  const game = {
    ...createGame(),
    phase: 'playing' as const,
    pieces: [orca, target, { ...target, id: 'second', at: { x: 5, y: 5 } }],
  };
  const notify = vi.fn();
  const hook = renderHook(() => useBoardInteraction(game, 'south', vi.fn(), true, notify));
  act(() => hook.result.current.clickCell(orca.at));
  expect(hook.result.current.reachableCells).toContainEqual({ x: 6, y: 4 });
  expect(hook.result.current.legalCells).not.toContainEqual({ x: 6, y: 4 });
  act(() => hook.result.current.clickCell(target.at));
  expect(notify).toHaveBeenCalledOnce();
  expect(hook.result.current.pending).toHaveLength(5);
  expect(hook.result.current.reachableCells).toContainEqual({ x: 6, y: 4 });
});

it('automatically promotes a white seal after capture without opening a choice', () => {
  const seal: Piece = { ...penguin, kind: 'seal' };
  const target: Piece = { ...food, owner: 'north', at: { x: 4, y: 6 } };
  const game = { ...createGame(), phase: 'playing' as const, pieces: [seal, target] };
  const submit = vi.fn(),
    present = vi.fn();
  const hook = renderHook(() => useBoardInteraction(game, 'south', submit, true, present));
  act(() => hook.result.current.clickCell(seal.at));
  act(() => hook.result.current.clickCell(target.at));
  expect(hook.result.current.pending).toBeNull();
  expect(present).not.toHaveBeenCalled();
  expect(submit).toHaveBeenCalledWith(
    { type: 'move', pieceId: seal.id, to: target.at, transformation: { type: 'promote' } },
    0,
  );
});
it('retains an ordinary white seal move and the friendly king loss warning', () => {
  const seal: Piece = { ...penguin, kind: 'seal' };
  const game = { ...createGame(), phase: 'playing' as const, pieces: [seal] };
  const submit = vi.fn();
  const hook = renderHook(() => useBoardInteraction(game, 'south', submit));
  act(() => hook.result.current.clickCell(seal.at));
  act(() => hook.result.current.clickCell({ x: 4, y: 6 }));
  expect(submit).toHaveBeenCalledWith({ type: 'move', pieceId: seal.id, to: { x: 4, y: 6 } }, 0);
  const king: Piece = { ...food, kind: 'walrus', at: { x: 4, y: 5 } };
  const danger = renderHook(() =>
    useBoardInteraction({ ...game, pieces: [seal, king] }, 'south', submit),
  );
  submit.mockClear();
  act(() => danger.result.current.clickCell(seal.at));
  act(() => danger.result.current.clickCell({ x: 4, y: 6 }));
  expect(danger.result.current.pending).toHaveLength(1);
  expect(danger.result.current.pending![0].piece.promoted).toBe(true);
  expect(submit).not.toHaveBeenCalled();
});

it('shows a blue safe destination after capturing its attacker rather than using the old board', () => {
  const own: Piece = { ...penguin, id: 'king', kind: 'walrus', at: { x: 4, y: 7 } };
  const attacker: Piece = {
    ...penguin,
    id: 'attacker',
    owner: 'north',
    kind: 'bear',
    at: { x: 5, y: 5 },
  };
  const game = { ...createGame(), pieces: [own, attacker] };
  const hook = renderHook(() => useBoardInteraction(game, 'south', vi.fn()));
  expect(hook.result.current.threats.some((t) => t.targetId === own.id)).toBe(true);
  act(() => hook.result.current.clickCell(own.at));
  expect(hook.result.current.legalCells).toContainEqual({ x: 4, y: 5 });
  expect(hook.result.current.unsafeCells).not.toContainEqual({ x: 4, y: 5 });
  expect(hook.result.current.unsafeCells.length).toBeGreaterThan(0);
});

it('marks ordinary moves and stock placements red, with matching hover previews', () => {
  const mover: Piece = { ...penguin, at: { x: 4, y: 5 } };
  const hunter: Piece = { ...food, id: 'hunter', kind: 'bear', owner: 'north', at: { x: 6, y: 4 } };
  const game = { ...createGame(), pieces: [...createGame().pieces, mover, hunter] };
  const hook = renderHook(() => useBoardInteraction(game, 'south', vi.fn()));
  act(() => hook.result.current.clickCell(mover.at));
  expect(hook.result.current.unsafeCells).toContainEqual({ x: 4, y: 4 });
  act(() => hook.result.current.setHover({ x: 4, y: 4 }));
  expect(hook.result.current.previewUnsafe).toBe(true);
  act(() => hook.result.current.selectStock('orca'));
  expect(hook.result.current.unsafeCells).toContainEqual({ x: 4, y: 3 });
  act(() => hook.result.current.setHover({ x: 4, y: 3 }));
  expect(hook.result.current.preview?.action.type).toBe('place');
  expect(hook.result.current.previewUnsafe).toBe(true);
});
it('updates danger for the exact airborne orca candidate rather than the unrotated landing', () => {
  const orca: Piece = { ...penguin, kind: 'orca', at: { x: 4, y: 6 } };
  const game = {
    ...createGame(),
    pieces: [
      ...createGame().pieces,
      orca,
      { ...food, at: { x: 4, y: 4 } },
      { ...food, id: 'hunter', owner: 'north' as const, at: { x: 5, y: 3 } },
    ],
  };
  const hook = renderHook(() => useBoardInteraction(game, 'south', vi.fn()));
  act(() => hook.result.current.clickCell(orca.at));
  expect(hook.result.current.unsafeCells).not.toContainEqual({ x: 4, y: 4 });
  act(() => hook.result.current.clickCell({ x: 4, y: 4 }));
  expect(hook.result.current.pending).toHaveLength(3);
  expect(hook.result.current.optionIndex).toBe(0);
  expect(
    hook.result.current.preview?.action.type === 'move' &&
      hook.result.current.preview.action.transformation,
  ).toBeUndefined();
  expect(hook.result.current.previewUnsafe).toBe(false);
  act(() => hook.result.current.setOptionIndex(1));
  expect(hook.result.current.previewUnsafe).toBe(true);
  act(() => hook.result.current.setOptionIndex(2));
  expect(hook.result.current.previewUnsafe).toBe(false);
});

it('marks a king capturer even when the same piece is threatened, and clears it when the king moves', () => {
  const bear: Piece = { ...penguin, id: 'bear', kind: 'bear', at: { x: 4, y: 4 } };
  const king: Piece = {
    ...food,
    id: 'enemy-king',
    kind: 'walrus',
    owner: 'north',
    at: { x: 6, y: 4 },
  };
  const hunter: Piece = { ...food, id: 'hunter', kind: 'bear', owner: 'north', at: { x: 2, y: 4 } };
  const game = { ...createGame(), pieces: [bear, king, hunter] };
  const hook = renderHook(({ state }) => useBoardInteraction(state, 'south', vi.fn()), {
    initialProps: { state: game },
  });
  expect(hook.result.current.kingCaptureIds).toEqual(['bear']);
  expect(hook.result.current.threats.some((t) => t.targetId === bear.id)).toBe(true);
  hook.rerender({ state: { ...game, pieces: [bear, hunter, { ...king, at: { x: 8, y: 0 } }] } });
  expect(hook.result.current.kingCaptureIds).toEqual([]);
});

it('finds the king capture for a north-facing jet and suppresses markers after the game ends', () => {
  const jet: Piece = { ...penguin, id: 'jet', owner: 'north', promoted: true, at: { x: 4, y: 2 } };
  const king: Piece = { ...food, id: 'king', kind: 'walrus', at: { x: 4, y: 6 } };
  const game = { ...createGame(), pieces: [jet, king] };
  const hook = renderHook(({ state }) => useBoardInteraction(state, 'north', vi.fn()), {
    initialProps: { state: game },
  });
  expect(hook.result.current.kingCaptureIds).toEqual(['jet']);
  hook.rerender({ state: { ...game, phase: 'finished' } });
  expect(hook.result.current.kingCaptureIds).toEqual([]);
});

it('includes king captures available only through the orca rotation extension', () => {
  const orca: Piece = { ...penguin, id: 'orca', kind: 'orca', at: { x: 4, y: 6 } };
  const king: Piece = { ...food, id: 'king', kind: 'walrus', owner: 'north', at: { x: 6, y: 3 } };
  const meal: Piece = { ...food, at: { x: 5, y: 4 } };
  const hook = renderHook(() =>
    useBoardInteraction({ ...createGame(), pieces: [orca, king, meal] }, 'south', vi.fn()),
  );
  expect(hook.result.current.kingCaptureIds).toEqual(['orca']);
});

it('inspects an enemy jet in its own forward direction without submitting a move', () => {
  const jet: Piece = {
    ...penguin,
    id: 'enemy-jet',
    owner: 'north',
    promoted: true,
    at: { x: 4, y: 2 },
  };
  const target: Piece = { ...food, at: { x: 4, y: 6 } };
  const game = { ...createGame(), pieces: [jet, target] };
  const submit = vi.fn();
  const hook = renderHook(() => useBoardInteraction(game, 'south', submit));
  act(() => hook.result.current.clickCell(jet.at));
  expect(hook.result.current.inspectingEnemy).toBe(true);
  expect(hook.result.current.legalCells).toEqual([target.at]);
  act(() => hook.result.current.setHover(target.at));
  expect(hook.result.current.preview).toBeNull();
  expect(hook.result.current.unsafeCells).toEqual([]);
  act(() => hook.result.current.clickCell(target.at));
  expect(submit).not.toHaveBeenCalled();
  expect(hook.result.current.selected?.id).toBe(target.id);
  expect(hook.result.current.inspectingEnemy).toBe(false);
  expect(game.turn).toBe('south');
  expect(jet.at).toEqual({ x: 4, y: 2 });
});

it('shows enemy orca rotation coverage and clears inspection on a second tap or stock selection', () => {
  const orca: Piece = {
    ...penguin,
    id: 'enemy-orca',
    owner: 'north',
    kind: 'orca',
    at: { x: 4, y: 6 },
  };
  const target: Piece = { ...food, at: { x: 5, y: 4 } };
  const game = { ...createGame(), pieces: [...createGame().pieces, orca, target] };
  const submit = vi.fn();
  const hook = renderHook(() => useBoardInteraction(game, 'south', submit));
  act(() => hook.result.current.clickCell(orca.at));
  expect(hook.result.current.reachableCells).toContainEqual({ x: 6, y: 4 });
  expect(hook.result.current.legalCells).not.toContainEqual({ x: 6, y: 4 });
  act(() => hook.result.current.clickCell(orca.at));
  expect(hook.result.current.selected).toBeNull();
  act(() => hook.result.current.clickCell(orca.at));
  act(() => hook.result.current.selectStock('seal'));
  expect(hook.result.current.selected).toBeNull();
  expect(hook.result.current.activeKind).toBe('seal');
  expect(submit).not.toHaveBeenCalled();
});
