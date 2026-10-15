// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { createGame } from '../game/engine';
import type { GameAction, GameState, Piece } from '../game/types';
import { ActionDock } from './ActionDock';
import { useBoardInteraction } from './useBoardInteraction';
import { CoordinateBoard } from './CoordinateBoard';

afterEach(cleanup);
const orca: Piece = { id: 'o', owner: 'south', kind: 'orca', promoted: false, at: { x: 4, y: 6 } };
const food: Piece = { id: 's', owner: 'south', kind: 'seal', promoted: false, at: { x: 4, y: 4 } };
function Fixture({
  submit,
  game,
}: {
  submit: (action: GameAction, revision: number) => void;
  game: GameState;
}) {
  const interaction = useBoardInteraction(game, 'south', submit);
  return (
    <>
      <button onClick={() => interaction.clickCell(orca.at)}>シャチを選ぶ</button>
      <button onClick={() => interaction.clickCell(food.at)}>捕食先を選ぶ</button>
      <button onClick={() => interaction.clickCell({ x: 5, y: 6 })}>配置先を選ぶ</button>
      <ActionDock
        game={game}
        settings={{ human: 'south', difficulty: 3 }}
        interaction={interaction}
        onHelp={() => {}}
      />
    </>
  );
}

describe('compact touch controls', () => {
  it('compares all four orca rotations without committing, then confirms the selected action', () => {
    const submit = vi.fn();
    render(
      <Fixture
        submit={submit}
        game={{ ...createGame(), phase: 'playing', pieces: [orca, food] }}
      />,
    );
    fireEvent.click(screen.getByText('シャチを選ぶ'));
    fireEvent.click(screen.getByText('捕食先を選ぶ'));
    expect(screen.queryByLabelText('あなたのストック')).toBeNull();
    const candidates = screen.getByLabelText('変身を選択').querySelectorAll('button');
    expect(candidates).toHaveLength(5);
    for (let i = 1; i < 5; i++) {
      fireEvent.click(screen.getByLabelText('次の変身候補'));
      expect(candidates[i].getAttribute('aria-pressed')).toBe('true');
      expect(submit).not.toHaveBeenCalled();
    }
    fireEvent.click(screen.getByRole('button', { name: '変身して着地' }));
    expect(submit).toHaveBeenCalledWith(
      {
        type: 'move',
        pieceId: 'o',
        to: food.at,
        transformation: { type: 'rotate', pivot: 1, direction: 1 },
      },
      0,
    );
  });
  it('returns to the stock dock when cancelling, and makes friendly king loss explicit', () => {
    const submit = vi.fn();
    const king: Piece = { ...food, kind: 'walrus' };
    render(
      <Fixture
        submit={submit}
        game={{ ...createGame(), phase: 'playing', pieces: [orca, king] }}
      />,
    );
    fireEvent.click(screen.getByText('シャチを選ぶ'));
    fireEvent.click(screen.getByText('捕食先を選ぶ'));
    expect(screen.getByRole('alert').textContent).toContain('自分の王を捕食 → 敗北');
    fireEvent.click(screen.getByLabelText('移動を取り消す'));
    expect(screen.getByRole('button', { name: '持ち駒を開く' }).getAttribute('aria-expanded')).toBe(
      'false',
    );
    expect(submit).not.toHaveBeenCalled();
  });
  it('orients the accessible board for the second player while preserving absolute coordinates', () => {
    const onCell = vi.fn();
    const { container } = render(
      <CoordinateBoard
        game={createGame()}
        human="north"
        legalCells={[]}
        onCell={onCell}
        onHover={() => {}}
      />,
    );
    const first = container.querySelector('button')!;
    expect(first.getAttribute('aria-label')).toBe('J1');
    fireEvent.click(first);
    expect(onCell).toHaveBeenCalledWith({ x: 9, y: 9 });
  });
});

it('opens the stock chooser only on demand and folds it after selection while preserving placement', () => {
  const submit = vi.fn();
  render(
    <Fixture submit={submit} game={{ ...createGame(), phase: 'playing', pieces: [orca, food] }} />,
  );
  expect(screen.queryByRole('region', { name: '配置する持ち駒' })).toBeNull();
  fireEvent.click(screen.getByRole('button', { name: '持ち駒を開く' }));
  expect(screen.getByRole('region', { name: '配置する持ち駒' })).toBeTruthy();
  fireEvent.click(screen.getByRole('button', { name: 'ペンギンを配置 残り3体' }));
  expect(screen.queryByRole('region', { name: '配置する持ち駒' })).toBeNull();
  fireEvent.click(screen.getByRole('button', { name: '配置先を選ぶ' }));
  expect(submit).toHaveBeenCalledWith({ type: 'place', kind: 'penguin', at: { x: 5, y: 6 } }, 0);
});
it('dismisses the tray without clearing the chosen stock or consuming a board tap', () => {
  const submit = vi.fn();
  render(
    <Fixture submit={submit} game={{ ...createGame(), phase: 'playing', pieces: [orca, food] }} />,
  );
  fireEvent.click(screen.getByRole('button', { name: '持ち駒を開く' }));
  fireEvent.click(screen.getByRole('button', { name: 'ペンギンを配置 残り3体' }));
  fireEvent.click(screen.getByRole('button', { name: '持ち駒を開く' }));
  fireEvent.keyDown(screen.getByRole('button', { name: '持ち駒を閉じる' }), { key: 'Escape' });
  expect(screen.queryByRole('region', { name: '配置する持ち駒' })).toBeNull();
  expect(screen.getByRole('button', { name: '選択を解除' })).toBeTruthy();
  fireEvent.click(screen.getByRole('button', { name: '持ち駒を開く' }));
  const target = screen.getByRole('button', { name: '配置先を選ぶ' });
  fireEvent.pointerDown(target);
  fireEvent.click(target);
  expect(screen.queryByRole('region', { name: '配置する持ち駒' })).toBeNull();
  expect(submit).toHaveBeenCalledWith({ type: 'place', kind: 'penguin', at: { x: 5, y: 6 } }, 0);
});
