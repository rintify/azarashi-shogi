/** Shared, testable palette and precedence for the 3D board and accessible grid. */
export const GUIDE_COLORS = {
  safe: '#087b9f',
  danger: '#df2946',
  fill: '#42b9d8',
  active: '#098bba',
  last: '#6fa9be',
  enemy: '#b08be9',
} as const;
export interface GuideState {
  inspectingEnemy?: boolean;
  active: boolean;
  additional: boolean;
  reachable: boolean;
  last: boolean;
  legal: boolean;
  unsafe: boolean;
  previewUnsafe: boolean;
}
export function guideStyle(state: GuideState) {
  if (state.inspectingEnemy)
    return {
      fill: GUIDE_COLORS.enemy,
      fillOpacity: state.reachable ? 0.32 : 0,
      dot: GUIDE_COLORS.enemy,
      dotOpacity: 0,
      outline: GUIDE_COLORS.enemy,
      outlineOpacity: 0,
    };
  const preview = state.active || state.additional;
  const danger = preview ? state.previewUnsafe : state.legal && state.unsafe;
  return {
    fill: danger ? GUIDE_COLORS.danger : GUIDE_COLORS.fill,
    fillOpacity: preview
      ? danger
        ? 0.32
        : 0.36
      : state.legal && state.unsafe
        ? 0.24
        : state.reachable
          ? 0.2
          : state.last
            ? 0.1
            : 0,
    dot: state.unsafe ? GUIDE_COLORS.danger : GUIDE_COLORS.safe,
    dotOpacity: state.legal ? 1 : 0,
    outline: danger ? GUIDE_COLORS.danger : preview ? GUIDE_COLORS.active : GUIDE_COLORS.last,
    outlineOpacity: danger ? 0 : preview ? 0.9 : state.last ? 0.45 : 0,
  };
}
