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
it('uses the same hover outline visibility for safe, dangerous and king-danger cells', () => {
  for (const key of ['active', 'additional'] as const) {
    const safe = guideStyle({ ...base, [key]: true });
    const danger = guideStyle({ ...base, [key]: true, previewUnsafe: true });
    const fatal = guideStyle({
      ...base,
      [key]: true,
      previewUnsafe: true,
      previewKingDanger: true,
    });
    expect(safe.outlineOpacity).toBeGreaterThan(0);
    expect(danger.outlineOpacity).toBe(safe.outlineOpacity);
    expect(fatal.outlineOpacity).toBe(safe.outlineOpacity);
  }
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

it('shows conditional transformation safety in purple', () => {
  const style = guideStyle({ ...base, transformationSafe: true, unsafe: true, kingDanger: true });
  expect(style.fill).toBe(GUIDE_COLORS.transformation);
  expect(style.dot).toBe(GUIDE_COLORS.transformation);
  expect(style.transformationSafe).toBe(true);
  expect(style.kingDanger).toBe(false);
  expect(
    guideStyle({ ...base, inspectingEnemy: true, transformationSafe: true }).transformationSafe,
  ).toBe(false);
});

it('colors trapped king captures yellow, including their hovered footprint and outline', () => {
  const idle = guideStyle({ ...base, kingCaptureTrap: true });
  expect(idle.fill).toBe(GUIDE_COLORS.kingCaptureTrap);
  expect(idle.dot).toBe(GUIDE_COLORS.kingCaptureTrap);
  expect(idle.outlineOpacity).toBe(0);
  for (const key of ['active', 'additional'] as const) {
    const hovered = guideStyle({
      ...base,
      [key]: true,
      previewUnsafe: true,
      previewKingCaptureTrap: true,
    });
    expect(hovered.fill).toBe(GUIDE_COLORS.kingCaptureTrap);
    expect(hovered.outline).toBe(GUIDE_COLORS.kingCaptureTrap);
    expect(hovered.outlineOpacity).toBe(guideStyle({ ...base, active: true }).outlineOpacity);
  }
});
it('never lets yellow override king danger, transformation safety or enemy inspection', () => {
  expect(guideStyle({ ...base, kingCaptureTrap: true, unsafe: true, kingDanger: true }).fill).toBe(
    GUIDE_COLORS.kingDanger,
  );
  expect(
    guideStyle({ ...base, active: true, previewKingCaptureTrap: true, previewKingDanger: true })
      .fill,
  ).toBe(GUIDE_COLORS.kingDanger);
  expect(guideStyle({ ...base, kingCaptureTrap: true, transformationSafe: true }).fill).toBe(
    GUIDE_COLORS.transformation,
  );
  expect(guideStyle({ ...base, kingCaptureTrap: true, inspectingEnemy: true }).fill).toBe(
    GUIDE_COLORS.enemy,
  );
  // A particular rotation can be unsafe even if the default landing is yellow.
  expect(
    guideStyle({
      ...base,
      kingCaptureTrap: true,
      active: true,
      previewUnsafe: true,
      previewKingCaptureTrap: false,
    }).fill,
  ).toBe(GUIDE_COLORS.danger);
});

it('uses destination colors for a non-movable current position without drawing dots on every occupied cell', () => {
  for (const flags of [
    {},
    { unsafe: true },
    { unsafe: true, kingDanger: true },
    { unsafe: true, kingCaptureTrap: true },
  ]) {
    const destination = guideStyle({ ...base, ...flags });
    const current = guideStyle({
      ...base,
      ...flags,
      legal: false,
      stationary: true,
      stationaryAnchor: true,
    });
    expect(current.fill).toBe(destination.fill);
    expect(current.fillOpacity).toBe(destination.fillOpacity);
    expect(current.dot).toBe(destination.dot);
    expect(current.dotOpacity).toBe(1);
    expect(guideStyle({ ...base, ...flags, legal: false, stationary: true }).dotOpacity).toBe(0);
  }
});
it('lets a hovered move replace the staying-put footprint color where they overlap', () => {
  const style = guideStyle({
    ...base,
    legal: false,
    stationary: true,
    unsafe: true,
    kingDanger: true,
    active: true,
    previewUnsafe: false,
    previewKingDanger: false,
  });
  expect(style.fill).toBe(GUIDE_COLORS.fill);
  expect(style.kingDanger).toBe(false);
});

it('shows the previous move as a faint white fill without any outline', () => {
  const style = guideStyle({ ...base, legal: false, last: true, reachable: false });
  expect(style.fill).toBe('#ffffff');
  expect(style.fillOpacity).toBe(0.1);
  expect(style.outlineOpacity).toBe(0);
});
