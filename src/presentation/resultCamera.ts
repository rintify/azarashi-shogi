import { Vector3 } from 'three';
import { dimensions } from '../game/pieces';
import type { Piece } from '../game/types';
import { center } from './motion';

/** A medium shot preserves several surrounding squares, even for a two-cell animal. */
export function resultCameraFrame(piece: Piece, aspect: number) {
  const [width, height] = dimensions(piece);
  const target = new Vector3(...center(piece));
  target.y = 0.65;
  const portrait = Math.max(1, 0.85 / Math.max(0.25, aspect));
  const distance = Math.max(7.5, 4.5 + Math.max(width, height) * 2) * portrait;
  const direction = new Vector3(0.45, 1.35, piece.owner === 'south' ? -1.8 : 1.8).normalize();
  return { target, position: target.clone().addScaledVector(direction, distance) };
}
