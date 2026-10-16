import { Vector3, type Camera, type Mesh, type Object3D } from 'three';

const scratch = new Vector3();
const MARKER_OFFSET = 4;
/** Use the visible model, not its occupied cells or an estimated height. */
export function pieceMarkerPosition(
  model: Object3D,
  camera: Camera,
  viewport: { width: number; height: number },
): [number, number] {
  model.updateWorldMatrix(true, true);
  let right = -Infinity,
    top = Infinity;
  model.traverseVisible((part) => {
    const mesh = part as Mesh;
    if (!mesh.isMesh) return;
    const geometry = mesh.geometry;
    if (!geometry.boundingBox) geometry.computeBoundingBox();
    const box = geometry.boundingBox;
    if (!box || box.isEmpty()) return;
    for (const x of [box.min.x, box.max.x])
      for (const y of [box.min.y, box.max.y])
        for (const z of [box.min.z, box.max.z]) {
          scratch.set(x, y, z).applyMatrix4(mesh.matrixWorld).project(camera);
          right = Math.max(right, ((scratch.x + 1) * viewport.width) / 2);
          top = Math.min(top, ((1 - scratch.y) * viewport.height) / 2);
        }
  });
  if (!Number.isFinite(right)) {
    scratch.setFromMatrixPosition(model.matrixWorld).project(camera);
    right = ((scratch.x + 1) * viewport.width) / 2;
    top = ((1 - scratch.y) * viewport.height) / 2;
  }
  // Overlap the corner slightly so a badge stays attached instead of floating above the animal.
  return [right + MARKER_OFFSET, top + MARKER_OFFSET];
}
