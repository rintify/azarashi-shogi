// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { PieceCatalog } from './PieceCatalog';
vi.mock('../scene/CatalogScene', () => ({
  CatalogScene: ({ rotating }: { rotating: boolean }) => (
    <div data-testid="catalog-scene">{rotating ? 'spinning' : 'still'}</div>
  ),
}));
beforeEach(() => {
  HTMLDialogElement.prototype.showModal = vi.fn(function (this: HTMLDialogElement) {
    this.setAttribute('open', '');
  });
});
afterEach(cleanup);
it('cycles through all eight forms with arrows and wraps in either direction', () => {
  render(<PieceCatalog close={vi.fn()} reduced={false} />);
  expect(screen.getByRole('heading', { name: '白アザラシ' })).toBeTruthy();
  fireEvent.click(screen.getByRole('button', { name: '前の駒' }));
  expect(screen.getByRole('heading', { name: 'セイウチ（王）' })).toBeTruthy();
  fireEvent.click(screen.getByRole('button', { name: '次の駒' }));
  for (let i = 0; i < 3; i++) fireEvent.click(screen.getByRole('button', { name: '次の駒' }));
  expect(screen.getByRole('heading', { name: 'ペンギン（ジェット）' })).toBeTruthy();
  fireEvent.keyDown(screen.getByRole('dialog'), { key: 'ArrowRight' });
  expect(screen.getByRole('heading', { name: 'シロクマ' })).toBeTruthy();
});
it('respects reduced motion initially, allows rotation, and closes on demand', () => {
  const close = vi.fn();
  render(<PieceCatalog close={close} reduced />);
  fireEvent.click(screen.getByRole('button', { name: '自動回転を始める' }));
  expect(screen.getByRole('button', { name: '自動回転を止める' })).toBeTruthy();
  fireEvent.click(screen.getByRole('button', { name: '図鑑を閉じる' }));
  expect(close).toHaveBeenCalledOnce();
});
