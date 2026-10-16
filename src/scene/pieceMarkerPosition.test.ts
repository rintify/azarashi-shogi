import { expect, it } from 'vitest';
import { BoxGeometry, Group, Mesh, PerspectiveCamera, Vector3 } from 'three';
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
it('tracks the actual model size with a fixed small screen offset', () => {
  const camera = cameraFor(1);
  for (const [w, h] of [
    [0.6, 0.6],
    [1.5, 0.8],
  ]) {
    const { root, mesh } = animal(w, h);
    root.position.set(2, 0, 1);
    const [x, y] = pieceMarkerPosition(root, camera, viewport);
    const points = [];
    for (const dx of [-w / 2, w / 2])
      for (const dy of [-0.35, 0.35])
        for (const dz of [-h / 2, h / 2])
          points.push(new Vector3(dx, dy, dz).applyMatrix4(mesh.matrixWorld).project(camera));
    expect(x - Math.max(...points.map((p) => (p.x + 1) * 400))).toBeCloseTo(4);
    expect(y - Math.min(...points.map((p) => (1 - p.y) * 400))).toBeCloseTo(4);
  }
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
