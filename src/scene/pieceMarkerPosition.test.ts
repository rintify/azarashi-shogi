import { expect, it } from 'vitest';
import { Object3D, PerspectiveCamera, Vector3 } from 'three';
import { pieceMarkerPosition } from './pieceMarkerPosition';
const viewport = { width: 800, height: 800 };
function cameraFor(side: number, top = false) {
  const camera = new PerspectiveCamera(38, 1, 0.1, 160);
  camera.position.set(0, top ? 20 : 18, side * (top ? 0.01 : 9));
  camera.lookAt(0, 0, 0);
  camera.updateMatrixWorld();
  return camera;
}
it('keeps all marks at the same screen-side for first and second players, in both camera views', () => {
  const object = new Object3D();
  object.updateMatrixWorld();
  for (const top of [false, true])
    for (const [w, h] of [
      [1, 1],
      [1, 2],
      [2, 1],
      [2, 2],
    ]) {
      const a = pieceMarkerPosition(object, cameraFor(1, top), viewport, w, h, 1.45);
      const b = pieceMarkerPosition(object, cameraFor(-1, top), viewport, w, h, 1.45);
      expect(a[0]).toBeGreaterThan(400);
      expect(a[1]).toBeLessThan(400);
      expect(a[0]).toBeCloseTo(b[0]);
      expect(a[1]).toBeCloseTo(b[1]);
    }
});
it('uses the same pixel gap for a small and a large piece', () => {
  const camera = cameraFor(1),
    object = new Object3D();
  object.position.set(2, 0, 1);
  object.updateMatrixWorld();
  for (const [w, h] of [
    [1, 1],
    [2, 2],
  ]) {
    const [x, y] = pieceMarkerPosition(object, camera, viewport, w, h, 1.05);
    const points = [];
    for (const dx of [-w / 2, w / 2])
      for (const dy of [0.16, 1.05])
        for (const dz of [-h / 2, h / 2])
          points.push(new Vector3(dx, dy, dz).applyMatrix4(object.matrixWorld).project(camera));
    expect(x - Math.max(...points.map((p) => (p.x + 1) * 400))).toBeCloseTo(16.5);
    expect(Math.min(...points.map((p) => (1 - p.y) * 400)) - y).toBeCloseTo(16.5);
  }
});
