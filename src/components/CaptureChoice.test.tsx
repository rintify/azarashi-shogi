// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, renderHook, screen } from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';
import { createGame } from '../game/engine';
import type { Piece } from '../game/types';
import { useBoardInteraction } from './useBoardInteraction';
import { CaptureChoice } from './CaptureChoice';
afterEach(cleanup);

it('offers four jet arrows, previews only a selected heading, and confirms that exact action', () => {
  const penguin: Piece = {
    id: 'p',
    kind: 'penguin',
    promoted: false,
    owner: 'south',
    at: { x: 4, y: 7 },
  };
  const meal: Piece = { ...penguin, id: 'meal', kind: 'seal', at: { x: 3, y: 7 } };
  const submit = vi.fn();
  const { result } = renderHook(() =>
    useBoardInteraction({ ...createGame(), pieces: [penguin, meal] }, 'south', submit),
  );
  act(() => result.current.clickCell(penguin.at));
  act(() => result.current.clickCell(meal.at));
  expect(result.current.optionIndex).toBe(0);
  expect(result.current.preview?.piece.promoted).toBe(false);
  const view = render(<CaptureChoice human="south" interaction={result.current} />);
  expect(screen.getAllByRole('button', { name: /ジェットの向き/ })).toHaveLength(4);
  fireEvent.click(screen.getByRole('button', { name: 'ジェットの向き：盤の右' }));
  expect(result.current.preview?.piece.heading).toBe('east');
  view.rerender(<CaptureChoice human="south" interaction={result.current} />);
  fireEvent.click(screen.getByRole('button', { name: '成る' }));
  expect(submit).toHaveBeenCalledWith(
    {
      type: 'move',
      pieceId: penguin.id,
      to: meal.at,
      transformation: { type: 'promote', heading: 'east' },
    },
    0,
  );
});
