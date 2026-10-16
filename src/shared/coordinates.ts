import type { Cell } from '../game/types';
export const coordinate = (c: Cell) => `${String.fromCharCode(65 + c.x)}${10 - c.y}`;
