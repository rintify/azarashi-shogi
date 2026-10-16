// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { NewGameDialog } from './NewGameDialog';
import { DEFAULT_SETTINGS } from '../match/record';
beforeEach(() => {
  HTMLDialogElement.prototype.showModal = vi.fn(function (this: HTMLDialogElement) {
    this.open = true;
  });
  vi.stubGlobal(
    'ResizeObserver',
    class {
      observe() {}
      disconnect() {}
    },
  );
});

it('offers the new top level for an opponent and for either spectator side', () => {
  const start = vi.fn();
  render(<NewGameDialog current={DEFAULT_SETTINGS} close={() => {}} start={start} />);
  const slider = screen.getByRole('slider');
  expect(slider.getAttribute('max')).toBe('6');
  fireEvent.change(slider, { target: { value: '6' } });
  expect(screen.getByText('Lv.6 · 覇王')).toBeTruthy();
  fireEvent.click(screen.getByRole('button', { name: /この設定ではじめる/ }));
  expect(start).toHaveBeenLastCalledWith(expect.objectContaining({ difficulty: 6 }));
  fireEvent.click(screen.getByRole('button', { name: /AI vs AI/ }));
  const sliders = screen.getAllByRole('slider');
  fireEvent.change(sliders[0], { target: { value: '6' } });
  fireEvent.click(screen.getByRole('button', { name: /この設定ではじめる/ }));
  expect(start).toHaveBeenLastCalledWith(
    expect.objectContaining({ aiLevels: { south: 6, north: 6 } }),
  );
});
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});
it('starts local PvP with no AI difficulty or human-side controls', () => {
  const start = vi.fn();
  render(<NewGameDialog current={DEFAULT_SETTINGS} close={() => {}} start={start} />);
  fireEvent.click(screen.getByRole('button', { name: /ローカルPvP/ }));
  expect(screen.queryByRole('slider')).toBeNull();
  expect(screen.queryByText('あなたの手番')).toBeNull();
  fireEvent.click(screen.getByRole('button', { name: /この設定ではじめる/ }));
  expect(start).toHaveBeenCalledWith({
    mode: 'local-pvp',
    human: 'south',
    difficulty: 3,
    aiLevels: undefined,
  });
});
it('can switch back from local PvP to AI play and independent AI levels', () => {
  render(
    <NewGameDialog
      current={{ ...DEFAULT_SETTINGS, mode: 'local-pvp' }}
      close={() => {}}
      start={() => {}}
    />,
  );
  fireEvent.click(screen.getByRole('button', { name: /AI vs AI/ }));
  expect(screen.getAllByRole('slider')).toHaveLength(2);
  fireEvent.click(screen.getByRole('button', { name: /あなた vs AI/ }));
  expect(screen.getAllByRole('slider')).toHaveLength(1);
  expect(screen.getByText('あなたの手番')).toBeTruthy();
});
