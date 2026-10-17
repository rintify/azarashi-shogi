// @vitest-environment jsdom
import { act, cleanup, render, screen } from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';
import { ThinkingClock } from './ThinkingClock';

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  vi.useRealTimers();
});

it('appears only after three seconds, tracks the actual elapsed time, and exits on completion', () => {
  vi.useFakeTimers();
  let now = 100;
  vi.spyOn(performance, 'now').mockImplementation(() => now);
  const session = { startedAt: now, budgetMs: 10000 };
  const view = render(<ThinkingClock session={session} />);
  const tick = (time: number) =>
    act(() => {
      now = time;
      vi.advanceTimersByTime(50);
    });
  tick(3100);
  expect(screen.queryByLabelText('AIの思考時間')).toBeNull();
  tick(3150);
  expect(screen.getByText('3.0')).toBeTruthy();
  expect(screen.getByText('/ 10秒')).toBeTruthy();
  tick(5200);
  expect(screen.getByText('5.1')).toBeTruthy();
  expect(
    view.container.querySelector('.thinking-clock-progress')?.getAttribute('stroke-dasharray'),
  ).toBe('0.51 1');
  view.rerender(<ThinkingClock session={null} />);
  act(() => vi.advanceTimersByTime(200));
  expect(screen.queryByLabelText('AIの思考時間')).toBeNull();
  expect(vi.getTimerCount()).toBe(0);
});

it('restarts the delay for a new search and uses its own time limit', () => {
  vi.useFakeTimers();
  let now = 0;
  vi.spyOn(performance, 'now').mockImplementation(() => now);
  const view = render(<ThinkingClock session={{ startedAt: 0, budgetMs: 10000 }} />);
  act(() => {
    now = 4000;
    vi.advanceTimersByTime(50);
  });
  expect(screen.getByLabelText('AIの思考時間')).toBeTruthy();
  view.rerender(<ThinkingClock session={{ startedAt: 4000, budgetMs: 30000 }} />);
  act(() => vi.advanceTimersByTime(200));
  expect(screen.queryByLabelText('AIの思考時間')).toBeNull();
  act(() => {
    now = 8000;
    vi.advanceTimersByTime(50);
  });
  expect(screen.getByText('4.0')).toBeTruthy();
  expect(screen.getByText('/ 30秒')).toBeTruthy();
});
