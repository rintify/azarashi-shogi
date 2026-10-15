// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { useState } from 'react';
import { AnimatedPresence, AnimatedValue, GameDialog } from './AnimatedUI';
beforeEach(() => vi.useFakeTimers());
afterEach(() => {
  cleanup();
  vi.runOnlyPendingTimers();
  vi.useRealTimers();
  vi.restoreAllMocks();
  Reflect.deleteProperty(HTMLDialogElement.prototype, 'showModal');
});
it('retains the previous visible controls for exit, disables them, then removes them', () => {
  const report = vi.fn();
  const view = render(
    <AnimatedPresence show onPresenceChange={report}>
      <button>前の操作</button>
    </AnimatedPresence>,
  );
  view.rerender(
    <AnimatedPresence show={false} onPresenceChange={report}>
      <button>空の操作</button>
    </AnimatedPresence>,
  );
  const host = view.container.querySelector('.ui-presence')!;
  expect(host.hasAttribute('inert')).toBe(true);
  expect(host.getAttribute('data-state')).toBe('exit');
  expect(host.textContent).toBe('前の操作');
  expect(screen.queryByRole('button')).toBeNull();
  expect(report).toHaveBeenLastCalledWith(true);
  act(() => vi.advanceTimersByTime(180));
  expect(view.container.childElementCount).toBe(0);
  expect(report).toHaveBeenLastCalledWith(false);
});
it('cancels stale exit timers when the stock tray is reopened quickly', () => {
  const view = render(
    <AnimatedPresence show>
      <button>持ち駒</button>
    </AnimatedPresence>,
  );
  view.rerender(
    <AnimatedPresence show={false}>
      <button>持ち駒</button>
    </AnimatedPresence>,
  );
  act(() => vi.advanceTimersByTime(90));
  view.rerender(
    <AnimatedPresence show>
      <button>持ち駒</button>
    </AnimatedPresence>,
  );
  act(() => vi.advanceTimersByTime(180));
  expect(screen.getByRole('button', { name: '持ち駒' })).toBeTruthy();
  expect(view.container.querySelector('.ui-presence')!.hasAttribute('inert')).toBe(false);
});
it('announces only the new status while crossfading the outgoing status', () => {
  const view = render(<AnimatedValue valueKey={1}>あなたの手番</AnimatedValue>);
  view.rerender(<AnimatedValue valueKey={2}>NPCの手番</AnimatedValue>);
  expect(view.container.querySelector('.ui-swap-old')!.getAttribute('aria-hidden')).toBe('true');
  expect(view.container.querySelector('.ui-swap-current')!.textContent).toBe('NPCの手番');
  act(() => vi.advanceTimersByTime(180));
  expect(screen.queryByText('あなたの手番')).toBeNull();
});
it('prevents native Escape from skipping the exit animation and releases the modal afterward', () => {
  Object.defineProperty(HTMLDialogElement.prototype, 'showModal', {
    configurable: true,
    value: function (this: HTMLDialogElement) {
      this.open = true;
    },
  });
  function Fixture() {
    const [open, setOpen] = useState(true);
    return (
      <AnimatedPresence show={open}>
        <GameDialog aria-label="設定" onDismiss={() => setOpen(false)}>
          <button>設定内容</button>
        </GameDialog>
      </AnimatedPresence>
    );
  }
  const view = render(<Fixture />);
  const dialog = screen.getByRole('dialog') as HTMLDialogElement;
  const cancel = new Event('cancel', { cancelable: true });
  fireEvent(dialog, cancel);
  expect(cancel.defaultPrevented).toBe(true);
  expect(dialog.open).toBe(true);
  expect(dialog.hasAttribute('inert')).toBe(true);
  act(() => vi.advanceTimersByTime(180));
  expect(view.container.querySelector('dialog')).toBeNull();
});
