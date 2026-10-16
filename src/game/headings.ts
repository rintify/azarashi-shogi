import type { Cell, Heading, Piece, Player } from './types';

export const HEADINGS: Heading[] = ['north', 'east', 'south', 'west'];
export const HEADING_VECTOR: Record<Heading, Cell> = {
  north: { x: 0, y: -1 },
  east: { x: 1, y: 0 },
  south: { x: 0, y: 1 },
  west: { x: -1, y: 0 },
};
export const HEADING_LABEL: Record<Heading, string> = {
  north: '盤の上',
  east: '盤の右',
  south: '盤の下',
  west: '盤の左',
};
export const forwardHeading = (owner: Player): Heading => (owner === 'south' ? 'north' : 'south');
export const jetHeading = (piece: Pick<Piece, 'owner' | 'heading'>): Heading =>
  piece.heading ?? forwardHeading(piece.owner);
/** Models face local +Z; this is the same heading used by movement and exhaust. */
export const headingYaw = (heading: Heading): number =>
  ({ north: Math.PI, east: Math.PI / 2, south: 0, west: -Math.PI / 2 })[heading];
