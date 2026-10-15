import { useLayoutEffect, useRef } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import { PerspectiveCamera, Quaternion, Vector3 } from 'three';
import type { Player } from '../game/types';
import type { PlayArea } from '../presentation/usePlayArea';

/** Projects into the unobscured HUD rectangle while rendering the world edge to edge. */
export function SceneCamera({
  area,
  view,
  human,
  reduced,
  ceiling = 1.7,
}: {
  area: PlayArea | null;
  view: 'perspective' | 'top';
  human: Player;
  reduced: boolean;
  ceiling?: number;
}) {
  const { camera, size } = useThree();
  const destination = useRef(new Vector3(0, 20, 9));
  const initial = useRef(true);
  useLayoutEffect(() => {
    if (!(camera instanceof PerspectiveCamera) || !area || area.height < 1) return;
    const side = human === 'south' ? 1 : -1;
    const direction = new Vector3(
      0,
      view === 'top' ? 1 : 1.9,
      view === 'top' ? side * 0.001 : side,
    ).normalize();
    const temp = new PerspectiveCamera(camera.fov, area.width / area.height);
    temp.position.copy(direction);
    temp.lookAt(0, 0, 0);
    const inverse = temp.quaternion.clone().invert() as Quaternion;
    const tangent = Math.tan((camera.fov * Math.PI) / 360);
    let distance = 1;
    for (const x of [-5.4, 5.4])
      for (const y of [0, ceiling])
        for (const z of [-5.4, 5.4]) {
          const v = new Vector3(x, y, z).applyQuaternion(inverse);
          distance = Math.max(
            distance,
            Math.abs(v.x) / ((tangent * area.width) / area.height) + v.z,
            Math.abs(v.y) / tangent + v.z,
          );
        }
    destination.current.copy(direction.multiplyScalar(distance * 1.015));
    camera.setViewOffset(area.width, area.height, -area.x, -area.y, size.width, size.height);
    if (initial.current || reduced) {
      camera.position.copy(destination.current);
      camera.lookAt(0, 0, 0);
      initial.current = false;
    }
    camera.updateProjectionMatrix();
  }, [camera, area, size.width, size.height, view, human, reduced, ceiling]);
  useFrame((_, delta) => {
    if (camera.position.distanceToSquared(destination.current) > 0.00001) {
      camera.position.lerp(destination.current, 1 - Math.exp(-delta * 12));
      camera.lookAt(0, 0, 0);
    }
  });
  return null;
}
