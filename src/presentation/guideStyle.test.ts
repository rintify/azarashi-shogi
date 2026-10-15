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
it('uses red for dangerous dots, fill and outline even without hovering', () => {
  const danger = guideStyle({ ...base, unsafe: true });
  expect(danger.dot).toBe(GUIDE_COLORS.danger);
  expect(danger.fill).toBe(GUIDE_COLORS.danger);
  expect(danger.outline).toBe(GUIDE_COLORS.danger);
  expect(danger.fillOpacity).toBeGreaterThan(0);
  expect(danger.outlineOpacity).toBeGreaterThan(0.8);
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
