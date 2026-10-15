import type { Cell, Kind, Piece, Stock } from './types';
export const BOARD_SIZE = 10;
export const KINDS: Kind[] = ['seal', 'penguin', 'bear', 'orca', 'walrus'];
export const DEFINITIONS: Record<
  Kind,
  { name: string; count: number; value: number; short: string; description: string }
> = {
  seal: {
    name: 'アザラシ',
    count: 6,
    value: 100,
    short: 'アザラシ',
    description: '白は前へ1マス。捕食して黒になると、全方向へ1マス。',
  },
  penguin: {
    name: 'ペンギン',
    count: 3,
    value: 230,
    short: 'ペンギン',
    description: '歩行は全方向へ1マス。ジェットは前の駒か盤端まで一直線。',
  },
  bear: {
    name: 'シロクマ',
    count: 1,
    value: 320,
    short: 'シロクマ',
    description: '周囲2マスの外周16マスへジャンプ。途中の駒は飛び越えます。',
  },
  orca: {
    name: 'シャチ',
    count: 2,
    value: 470,
    short: 'シャチ',
    description:
      '縦は横1・縦2、横は横2・縦1まで。捕食後、食べたマスを1つ以上踏む向きへ回転。L字3マスを捕食。',
  },
  walrus: {
    name: 'セイウチ',
    count: 1,
    value: 50000,
    short: 'セイウチ',
    description: '2×2マスの王。縦横それぞれ2マスまで動けます。守ってあげましょう。',
  },
};
export function initialStock(): Stock {
  return Object.fromEntries(KINDS.map((kind) => [kind, DEFINITIONS[kind].count])) as Stock;
}
export function dimensions(piece: Pick<Piece, 'kind' | 'promoted'>): [number, number] {
  if (piece.kind === 'walrus') return [2, 2];
  if (piece.kind === 'orca') return piece.promoted ? [2, 1] : [1, 2];
  return [1, 1];
}
export function footprint(piece: Pick<Piece, 'kind' | 'promoted' | 'at'>): Cell[] {
  const [width, height] = dimensions(piece);
  return Array.from({ length: width * height }, (_, i) => ({
    x: piece.at.x + (i % width),
    y: piece.at.y + Math.floor(i / width),
  }));
}
export const inBounds = ({ x, y }: Cell) =>
  Number.isInteger(x) &&
  Number.isInteger(y) &&
  x >= 0 &&
  y >= 0 &&
  x < BOARD_SIZE &&
  y < BOARD_SIZE;
export const fits = (piece: Pick<Piece, 'kind' | 'promoted' | 'at'>) =>
  footprint(piece).every(inBounds);
export function pieceName(piece: Pick<Piece, 'kind' | 'promoted'>): string {
  if (piece.kind === 'seal') return piece.promoted ? '黒アザラシ' : '白アザラシ';
  if (piece.kind === 'penguin') return `ペンギン（${piece.promoted ? 'ジェット' : '歩行'}）`;
  if (piece.kind === 'orca') return `シャチ（${piece.promoted ? '横' : '縦'}）`;
  return piece.kind === 'walrus' ? 'セイウチ（王）' : 'シロクマ';
}
export const canTransform = (piece: Piece) =>
  piece.kind === 'penguin' || piece.kind === 'orca' || (piece.kind === 'seal' && !piece.promoted);
