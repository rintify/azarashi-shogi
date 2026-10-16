import { Vector3, type Camera, type Mesh, type Object3D } from 'three';

const scratch = new Vector3();
const OFFSET = 8;
interface MarkerCache {
  camera: number[];
  projection: number[];
  width: number;
  height: number;
  parts: { mesh: Mesh; matrix: number[]; geometry: Mesh['geometry'] }[];
  position: [number, number];
}
const cache = new WeakMap<Object3D, MarkerCache>();
const same = (a: number[], b: number[]) => a.every((value, i) => value === b[i]);

/** Attach to an actual projected surface vertex in the upper-right direction. */
export function pieceMarkerPosition(
  model: Object3D,
  camera: Camera,
  viewport: { width: number; height: number },
): [number, number] {
  model.updateWorldMatrix(true, true);
  const meshes: Mesh[] = [];
  model.traverseVisible((part) => {
    const mesh = part as Mesh;
    if (mesh.isMesh && mesh.geometry.getAttribute('position')) meshes.push(mesh);
  });
  const previous = cache.get(model);
  if (
    previous &&
    previous.width === viewport.width &&
    previous.height === viewport.height &&
    same(previous.camera, camera.matrixWorldInverse.elements) &&
    same(previous.projection, camera.projectionMatrix.elements) &&
    previous.parts.length === meshes.length &&
    previous.parts.every(
      (part, i) =>
        part.mesh === meshes[i] &&
        part.geometry === meshes[i].geometry &&
        same(part.matrix, meshes[i].matrixWorld.elements),
    )
  )
    return previous.position;

  let score = -Infinity;
  let anchorX = 0,
    anchorY = 0;
  for (const mesh of meshes) {
    const vertices = mesh.geometry.getAttribute('position');
    for (let i = 0; i < vertices.count; i++) {
      scratch.fromBufferAttribute(vertices, i).applyMatrix4(mesh.matrixWorld).project(camera);
      const x = ((scratch.x + 1) * viewport.width) / 2;
      const y = ((1 - scratch.y) * viewport.height) / 2;
      // Never combine the rightmost flipper with the topmost crown into an empty corner.
      if (x - y > score) {
        score = x - y;
        anchorX = x;
        anchorY = y;
      }
    }
  }
  if (!Number.isFinite(score)) {
    scratch.setFromMatrixPosition(model.matrixWorld).project(camera);
    anchorX = ((scratch.x + 1) * viewport.width) / 2;
    anchorY = ((1 - scratch.y) * viewport.height) / 2;
  }
  const position: [number, number] = [anchorX + OFFSET, anchorY - OFFSET];
  cache.set(model, {
    camera: [...camera.matrixWorldInverse.elements],
    projection: [...camera.projectionMatrix.elements],
    width: viewport.width,
    height: viewport.height,
    parts: meshes.map((mesh) => ({
      mesh,
      geometry: mesh.geometry,
      matrix: [...mesh.matrixWorld.elements],
    })),
    position,
  });
  return position;
}
