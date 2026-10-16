import { expect, it } from 'vitest';
import { pieceMark } from './PieceMark';
it('prioritizes king capture, helper, then danger', () => {
  expect(pieceMark(true, true, true)).toBe('king');
  expect(pieceMark(false, true, true)).toBe('helper');
  expect(pieceMark(false, false, true)).toBe('danger');
  expect(pieceMark(false, false, false)).toBeNull();
});
it('replaces danger with a cross while preserving king and helper priority', () => {
  expect(pieceMark(false, false, true, true)).toBe('trapped');
  expect(pieceMark(true, true, true, true)).toBe('king');
  expect(pieceMark(false, true, true, true)).toBe('helper');
  expect(pieceMark(false, false, false, true)).toBeNull();
});
