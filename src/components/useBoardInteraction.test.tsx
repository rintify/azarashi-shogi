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
  expect(screen.getByRole('heading', { name: '自分の王を捕食します' })).toBeTruthy();
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
