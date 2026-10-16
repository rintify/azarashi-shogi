/** Shared, testable palette and precedence for the 3D board and accessible grid. */
export const GUIDE_COLORS = {
  safe: '#087b9f',
  danger: '#df2946',
  transformation: '#9263bb',
  kingDanger: '#8f2038',
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
  kingDanger?: boolean;
  previewKingDanger?: boolean;
  transformationSafe?: boolean;
}
export function guideStyle(state: GuideState) {
  if (state.inspectingEnemy)
    return {
      kingDanger: false,
      transformationSafe: false,
      fill: GUIDE_COLORS.enemy,
      fillOpacity: state.reachable ? 0.32 : 0,
      dot: GUIDE_COLORS.enemy,
      dotOpacity: 0,
      outline: GUIDE_COLORS.enemy,
      outlineOpacity: 0,
    };
  const preview = state.active || state.additional;
  const transformationSafe = !!state.transformationSafe && state.legal;
  const kingDanger =
    !transformationSafe && !!(preview ? state.previewKingDanger : state.legal && state.kingDanger);
  const danger =
    !transformationSafe &&
    (kingDanger || (preview ? state.previewUnsafe : state.legal && state.unsafe));
  const dangerColor = kingDanger ? GUIDE_COLORS.kingDanger : GUIDE_COLORS.danger;
  return {
    kingDanger,
    transformationSafe,
    fill: transformationSafe
      ? GUIDE_COLORS.transformation
      : danger
        ? dangerColor
        : GUIDE_COLORS.fill,
    fillOpacity: preview
      ? danger
        ? 0.32
        : 0.36
      : state.legal && state.unsafe && !transformationSafe
        ? 0.24
        : state.reachable
          ? 0.2
          : state.last
            ? 0.1
            : 0,
    dot: transformationSafe
      ? GUIDE_COLORS.transformation
      : state.kingDanger
        ? GUIDE_COLORS.kingDanger
        : state.unsafe
          ? GUIDE_COLORS.danger
          : GUIDE_COLORS.safe,
    dotOpacity: state.legal ? 1 : 0,
    outline: danger ? dangerColor : preview ? GUIDE_COLORS.active : GUIDE_COLORS.last,
    outlineOpacity: preview ? 0.9 : state.last ? 0.45 : 0,
  };
}
