import { Crown, ShieldPlus } from 'lucide-react';
export type PieceMark = 'king' | 'helper' | 'danger';
export function pieceMark(
  kingCapture: boolean,
  helper: boolean,
  threatened: boolean,
): PieceMark | null {
  return kingCapture ? 'king' : helper ? 'helper' : threatened ? 'danger' : null;
}
export function PieceMarkIcon({ mark, size = 18 }: { mark: PieceMark; size?: number }) {
  return mark === 'king' ? (
    <Crown size={size} strokeWidth={2.7} />
  ) : mark === 'helper' ? (
    <ShieldPlus size={size} strokeWidth={2.7} />
  ) : (
    <>!</>
  );
}
export const MARK_LABELS: Record<PieceMark, string> = {
  king: '相手の王を捕食できます。この駒を選択',
  helper: '助っ人：逃げ場のない王を救える手があります。この駒を選択',
  danger: 'この駒を捕食できる相手を表示',
};
