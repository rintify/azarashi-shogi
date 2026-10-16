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

it('uses dark red specifically for king exposure while preserving ordinary piece danger', () => {
  const fatal = guideStyle({ ...base, unsafe: true, kingDanger: true });
  expect(fatal.fill).toBe(GUIDE_COLORS.kingDanger);
  expect(fatal.dot).toBe(GUIDE_COLORS.kingDanger);
  expect(fatal.kingDanger).toBe(true);
  expect(fatal.outlineOpacity).toBe(0);
  expect(guideStyle({ ...base, unsafe: true }).kingDanger).toBe(false);
});
it('uses the exact preview for king exposure, including transformation choices', () => {
  const safe = guideStyle({
    ...base,
    active: true,
    unsafe: true,
    kingDanger: true,
    previewUnsafe: false,
    previewKingDanger: false,
  });
  expect(safe.fill).toBe(GUIDE_COLORS.fill);
  expect(safe.kingDanger).toBe(false);
  const fatal = guideStyle({
    ...base,
    additional: true,
    previewUnsafe: true,
    previewKingDanger: true,
  });
  expect(fatal.fill).toBe(GUIDE_COLORS.kingDanger);
  expect(fatal.kingDanger).toBe(true);
  expect(guideStyle({ ...base, inspectingEnemy: true, kingDanger: true }).kingDanger).toBe(false);
});

it('shows conditional transformation safety in blue with a reference note', () => {
  const style = guideStyle({ ...base, transformationSafe: true, unsafe: true, kingDanger: true });
  expect(style.fill).toBe(GUIDE_COLORS.fill);
  expect(style.dot).toBe(GUIDE_COLORS.safe);
  expect(style.transformationSafe).toBe(true);
  expect(style.kingDanger).toBe(false);
  expect(
    guideStyle({ ...base, inspectingEnemy: true, transformationSafe: true }).transformationSafe,
  ).toBe(false);
});
