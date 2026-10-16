import { expect, it } from 'vitest';
import { GUIDE_COLORS, guideStyle, type GuideState } from './guideStyle';
const base: GuideState = {
  active: false,
  additional: false,
  reachable: true,
  last: false,
  legal: true,
  unsafe: false,
  previewUnsafe: false,
};
it('uses red for dangerous dots and fill without an outline', () => {
  const danger = guideStyle({ ...base, unsafe: true });
  expect(danger.dot).toBe(GUIDE_COLORS.danger);
  expect(danger.fill).toBe(GUIDE_COLORS.danger);
  expect(danger.outline).toBe(GUIDE_COLORS.danger);
  expect(danger.fillOpacity).toBeGreaterThan(0);
  expect(danger.outlineOpacity).toBe(0);
});
it('never replaces dangerous hover or L-shape preview with the old blue fill', () => {
  for (const key of ['active', 'additional'] as const) {
    const danger = guideStyle({ ...base, [key]: true, legal: false, previewUnsafe: true });
    expect(danger.fill).toBe(GUIDE_COLORS.danger);
    expect(danger.outline).toBe(GUIDE_COLORS.danger);
  }
});
it('uses the selected action for overlapping footprint cells instead of another anchor’s danger', () => {
  const selectedSafe = guideStyle({ ...base, unsafe: true, active: true, previewUnsafe: false });
  expect(selectedSafe.fill).toBe(GUIDE_COLORS.fill);
  expect(selectedSafe.dot).toBe(GUIDE_COLORS.danger);
  expect(guideStyle(base).dot).toBe(GUIDE_COLORS.safe);
});

it('shows enemy coverage in its own color without danger, dots or outlines', () => {
  const style = guideStyle({
    ...base,
    inspectingEnemy: true,
    unsafe: true,
    active: true,
    previewUnsafe: true,
  });
  expect(style.fill).toBe(GUIDE_COLORS.enemy);
  expect(style.fill).not.toBe(GUIDE_COLORS.fill);
  expect(style.fillOpacity).toBeGreaterThan(0);
  expect(style.dotOpacity).toBe(0);
  expect(style.outlineOpacity).toBe(0);
  expect(
    guideStyle({ ...base, inspectingEnemy: true, reachable: false, last: true }).fillOpacity,
  ).toBe(0);
});
