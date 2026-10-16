import { Crown, ShieldPlus, X } from 'lucide-react';
export type PieceMark = 'king' | 'helper' | 'trapped' | 'danger';
export function pieceMark(
  kingCapture: boolean,
  helper: boolean,
  threatened: boolean,
  trapped = false,
): PieceMark | null {
  return kingCapture
    ? 'king'
    : helper
      ? 'helper'
      : threatened
        ? trapped
          ? 'trapped'
          : 'danger'
        : null;
}
export function PieceMarkIcon({ mark, size = 18 }: { mark: PieceMark; size?: number }) {
  return mark === 'king' ? (
    <Crown size={size} strokeWidth={2.7} />
  ) : mark === 'helper' ? (
    <ShieldPlus size={size} strokeWidth={2.7} />
  ) : mark === 'trapped' ? (
    <X size={size} strokeWidth={3} />
  ) : (
    <>!</>
  );
}
export const MARK_LABELS: Record<PieceMark, string> = {
  king: '相手の王を捕食できます。この駒を選択',
  helper: '助っ人：逃げ場のない王を救える手があります。この駒を選択',
  trapped: '現在位置とすべての移動先が危険です。この駒を選択',
  danger: 'この駒を捕食できる相手を表示',
};
