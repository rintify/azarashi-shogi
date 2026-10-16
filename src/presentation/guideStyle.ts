import type { ActionSafety } from '../game/safety';
import type { Cell } from '../game/types';

/** Shared, testable palette and precedence for the 3D board and accessible grid. */
export const GUIDE_COLORS = {
  safe: '#087b9f',
  danger: '#df2946',
  transformation: '#9263bb',
  kingCaptureTrap: '#e9ad18',
  kingDanger: '#8f2038',
  fill: '#42b9d8',
  last: '#ffffff',
  enemy: '#b08be9',
} as const;
/** Occupied cells are display guides, never legal destinations or a pass action. */
export interface StationaryGuide {
  cells: Cell[];
  anchor: Cell;
  safety: ActionSafety | null;
}
export interface GuideState {
  stationary?: boolean;
  stationaryAnchor?: boolean;
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
  kingCaptureTrap?: boolean;
  previewKingCaptureTrap?: boolean;
}
export function guideStyle(state: GuideState) {
  if (state.inspectingEnemy)
    return {
      kingDanger: false,
      transformationSafe: false,
      kingCaptureTrap: false,
      fill: GUIDE_COLORS.enemy,
      fillOpacity: state.reachable ? 0.32 : 0,
      dot: GUIDE_COLORS.enemy,
      dotOpacity: 0,
    };
  const preview = state.active || state.additional;
  const guided = state.legal || state.stationary;
  const transformationSafe = !!state.transformationSafe && state.legal;
  const kingDanger =
    !transformationSafe && !!(preview ? state.previewKingDanger : guided && state.kingDanger);
  const kingCaptureTrap =
    !transformationSafe &&
    !kingDanger &&
    !!(preview ? state.previewKingCaptureTrap : guided && state.kingCaptureTrap);
  const danger =
    !transformationSafe && (kingDanger || (preview ? state.previewUnsafe : guided && state.unsafe));
  const dangerColor = kingDanger ? GUIDE_COLORS.kingDanger : GUIDE_COLORS.danger;
  return {
    kingDanger,
    transformationSafe,
    kingCaptureTrap,
    fill: transformationSafe
      ? GUIDE_COLORS.transformation
      : kingCaptureTrap
        ? GUIDE_COLORS.kingCaptureTrap
        : danger
          ? dangerColor
          : state.last && !state.reachable
            ? GUIDE_COLORS.last
            : GUIDE_COLORS.fill,
    fillOpacity: preview
      ? danger
        ? 0.32
        : 0.36
      : guided && (state.unsafe || kingCaptureTrap) && !transformationSafe
        ? 0.24
        : state.reachable
          ? 0.2
          : state.last
            ? 0.1
            : 0,
    dot: transformationSafe
      ? GUIDE_COLORS.transformation
      : kingCaptureTrap
        ? GUIDE_COLORS.kingCaptureTrap
        : state.kingDanger
          ? GUIDE_COLORS.kingDanger
          : state.unsafe
            ? GUIDE_COLORS.danger
            : GUIDE_COLORS.safe,
    dotOpacity: state.legal || state.stationaryAnchor ? 1 : 0,
  };
}
