import { Vector3, type Camera, type Object3D } from 'three';

const scratch = new Vector3();
const MARKER_SIZE = 25;
const MARKER_GAP = 4;
/** Anchor every mark just outside the projected top-right of the piece, in screen pixels. */
export function pieceMarkerPosition(
  object: Object3D,
  camera: Camera,
  viewport: { width: number; height: number },
  width: number,
  depth: number,
  height: number,
): [number, number] {
  let right = -Infinity,
    top = Infinity;
  for (const x of [-width / 2, width / 2])
    for (const y of [0.16, height])
      for (const z of [-depth / 2, depth / 2]) {
        scratch.set(x, y, z).applyMatrix4(object.matrixWorld).project(camera);
        right = Math.max(right, ((scratch.x + 1) * viewport.width) / 2);
        top = Math.min(top, ((1 - scratch.y) * viewport.height) / 2);
      }
  const margin = MARKER_SIZE / 2 + MARKER_GAP;
  return [right + margin, top - margin];
}
