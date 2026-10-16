import { expect, it } from 'vitest';
import { BoxGeometry, Group, Mesh, PerspectiveCamera, SphereGeometry, Vector3 } from 'three';
import { pieceMarkerPosition } from './pieceMarkerPosition';
const viewport = { width: 800, height: 800 };
function cameraFor(side: number, top = false) {
  const camera = new PerspectiveCamera(38, 1, 0.1, 160);
  camera.position.set(0, top ? 20 : 18, side * (top ? 0.01 : 9));
  camera.lookAt(0, 0, 0);
  camera.updateMatrixWorld();
  return camera;
}
function animal(width: number, depth: number) {
  const root = new Group();
  const mesh = new Mesh(new BoxGeometry(width, 0.7, depth));
  mesh.position.y = 0.5;
  root.add(mesh);
  return { root, mesh };
}
it('stays on the same visible corner from either side and in top view', () => {
  for (const top of [false, true])
    for (const [w, h] of [
      [0.6, 0.6],
      [0.6, 1.6],
      [1.6, 0.6],
      [1.6, 1.6],
    ]) {
      const { root } = animal(w, h);
      const a = pieceMarkerPosition(root, cameraFor(1, top), viewport);
      const b = pieceMarkerPosition(root, cameraFor(-1, top), viewport);
      expect(a[0]).toBeGreaterThan(400);
      expect(a[1]).toBeLessThan(400);
      expect(a[0]).toBeCloseTo(b[0]);
      expect(a[1]).toBeCloseTo(b[1]);
    }
});
function projectedVertices(root: Group, camera: PerspectiveCamera) {
  root.updateWorldMatrix(true, true);
  const points: Vector3[] = [];
  root.traverseVisible((part) => {
    if (!(part instanceof Mesh)) return;
    const vertices = part.geometry.getAttribute('position');
    for (let i = 0; i < vertices.count; i++) {
      const point = new Vector3()
        .fromBufferAttribute(vertices, i)
        .applyMatrix4(part.matrixWorld)
        .project(camera);
      points.push(new Vector3((point.x + 1) * 400, (1 - point.y) * 400, 0));
    }
  });
  return points;
}
it('touches a real outline point instead of the empty corner above a wide body', () => {
  const root = new Group();
  const body = new Mesh(new SphereGeometry(1, 32, 24));
  body.scale.set(1.4, 0.5, 0.7);
  const head = new Mesh(new SphereGeometry(0.45, 32, 24));
  head.position.y = 1.2;
  root.add(body, head);
  for (const top of [false, true])
    for (const side of [-1, 1]) {
      const camera = cameraFor(side, top);
      const [x, y] = pieceMarkerPosition(root, camera, viewport);
      const points = projectedVertices(root, camera);
      const nearest = Math.min(...points.map((p) => Math.hypot(x - p.x, y - p.y)));
      // A 25px badge touches the silhouette, even when head and body extents differ.
      expect(nearest).toBeLessThan(12.5);
      const anchor = points.reduce((best, p) => (p.x - p.y > best.x - best.y ? p : best));
      expect(x).toBeCloseTo(anchor.x + 8);
      expect(y).toBeCloseTo(anchor.y - 8);
    }
});
it('updates the attachment when the model or camera moves', () => {
  const { root, mesh } = animal(0.6, 0.6);
  const camera = cameraFor(1);
  const original = pieceMarkerPosition(root, camera, viewport);
  expect(pieceMarkerPosition(root, camera, viewport)).toBe(original);
  mesh.position.x += 1;
  const moved = pieceMarkerPosition(root, camera, viewport);
  expect(moved[0]).toBeGreaterThan(original[0]);
  camera.position.x += 3;
  camera.lookAt(0, 0, 0);
  camera.updateMatrixWorld();
  expect(pieceMarkerPosition(root, camera, viewport)).not.toEqual(moved);
});
it('ignores invisible transformation models and does not depend on a piece footprint', () => {
  const { root } = animal(0.5, 0.5);
  const original = pieceMarkerPosition(root, cameraFor(1), viewport);
  const hidden = new Group();
  hidden.visible = false;
  hidden.add(new Mesh(new BoxGeometry(100, 100, 100)));
  root.add(hidden);
  expect(pieceMarkerPosition(root, cameraFor(1), viewport)).toEqual(original);
});
