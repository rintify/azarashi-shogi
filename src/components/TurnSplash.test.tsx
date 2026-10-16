// @vitest-environment jsdom
import { act, cleanup, render, screen } from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';
import { createGame } from '../game/engine';
import { DEFAULT_SETTINGS } from '../match/record';
import { TurnSplash } from './TurnSplash';

afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

it('waits for landing and lets the callout finish even if the next move starts', () => {
  vi.useFakeTimers();
  const game = createGame();
  const props = { game, settings: DEFAULT_SETTINGS, ready: true, busy: false };
  const view = render(<TurnSplash {...props} />);
  expect(screen.getByText('あなた')).toBeTruthy();
  act(() => vi.advanceTimersByTime(1050));
  const next = { ...game, turn: 'north' as const, revision: 1 };
  view.rerender(<TurnSplash {...props} game={next} busy />);
  expect(screen.queryByText('相手')).toBeNull();
  view.rerender(<TurnSplash {...props} game={next} />);
  expect(screen.getByText('相手')).toBeTruthy();
  view.rerender(<TurnSplash {...props} game={next} busy />);
  expect(screen.getByText('相手')).toBeTruthy();
  act(() => vi.advanceTimersByTime(1050));
  expect(screen.queryByText('相手')).toBeNull();
});

it('suppresses the callout when replay or a modal is visible', () => {
  render(<TurnSplash game={createGame()} settings={DEFAULT_SETTINGS} ready={false} busy={false} />);
  expect(screen.queryByText('あなた')).toBeNull();
});

it('uses first and second player names in local PvP', () => {
  const game = createGame();
  const settings = { ...DEFAULT_SETTINGS, mode: 'local-pvp' as const };
  const view = render(<TurnSplash game={game} settings={settings} ready busy={false} />);
  expect(screen.getByText('先手')).toBeTruthy();
  view.rerender(
    <TurnSplash
      game={{ ...game, turn: 'north', revision: 1 }}
      settings={settings}
      ready
      busy={false}
    />,
  );
  expect(screen.getByText('後手')).toBeTruthy();
  expect(screen.queryByText('相手')).toBeNull();
});
