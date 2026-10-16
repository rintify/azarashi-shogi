import { useLayoutEffect, useRef } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import { PerspectiveCamera, Quaternion, Vector3 } from 'three';
import { sampleCameraOrbit, TURN_ROTATION_MS } from '../presentation/cameraOrbit';
import { resultCameraFrame } from '../presentation/resultCamera';
import type { Piece, Player } from '../game/types';
import type { PlayArea } from '../presentation/usePlayArea';

function boardDistance(direction: Vector3, fov: number, aspect: number, ceiling: number) {
  const temp = new PerspectiveCamera(fov, aspect);
  temp.position.copy(direction);
  temp.lookAt(0, 0, 0);
  const inverse = temp.quaternion.clone().invert() as Quaternion;
  const tangent = Math.tan((fov * Math.PI) / 360);
  let distance = 1;
  for (const x of [-5.4, 5.4])
    for (const y of [0, ceiling])
      for (const z of [-5.4, 5.4]) {
        const v = new Vector3(x, y, z).applyQuaternion(inverse);
        distance = Math.max(
          distance,
          Math.abs(v.x) / (tangent * aspect) + v.z,
          Math.abs(v.y) / tangent + v.z,
        );
      }
  return distance * 1.015;
}

/** Projects into the unobscured HUD rectangle while rendering the world edge to edge. */
export function SceneCamera({
  area,
  view,
  human,
  reduced,
  ceiling = 1.7,
  focusPiece = null,
}: {
  area: PlayArea | null;
  view: 'perspective' | 'top';
  human: Player;
  reduced: boolean;
  ceiling?: number;
  focusPiece?: Piece | null;
}) {
  const { camera, size } = useThree();
  const destination = useRef(new Vector3(0, 20, 9));
  const initial = useRef(true);
  const previousHuman = useRef(human);
  const orbit = useRef<{ from: Vector3; to: Vector3; startedAt: number } | null>(null);
  const lookTarget = useRef(new Vector3());
  const targetDestination = useRef(new Vector3());
  useLayoutEffect(() => {
    if (!(camera instanceof PerspectiveCamera) || !area || area.height < 1) return;
    if (focusPiece) {
      orbit.current = null;
      previousHuman.current = human;
      const frame = resultCameraFrame(focusPiece, size.width / size.height);
      destination.current.copy(frame.position);
      targetDestination.current.copy(frame.target);
      camera.clearViewOffset();
      if (reduced) {
        camera.position.copy(frame.position);
        lookTarget.current.copy(frame.target);
        camera.lookAt(lookTarget.current);
      }
      initial.current = false;
      camera.updateProjectionMatrix();
      return;
    }
    targetDestination.current.set(0, 0, 0);
    const side = human === 'south' ? 1 : -1;
    const direction = new Vector3(
      0,
      view === 'top' ? 1 : 1.9,
      view === 'top' ? side * 0.001 : side,
    ).normalize();
    const distance = boardDistance(direction, camera.fov, area.width / area.height, ceiling);
    destination.current.copy(direction.multiplyScalar(distance));
    camera.setViewOffset(area.width, area.height, -area.x, -area.y, size.width, size.height);
    if (initial.current || reduced) {
      orbit.current = null;
      camera.position.copy(destination.current);
      lookTarget.current.set(0, 0, 0);
      camera.lookAt(lookTarget.current);
      initial.current = false;
    } else if (previousHuman.current !== human) {
      orbit.current = {
        from: camera.position.clone(),
        to: destination.current.clone(),
        startedAt: performance.now(),
      };
    } else if (orbit.current) {
      orbit.current.to.copy(destination.current);
    }
    previousHuman.current = human;
    camera.updateProjectionMatrix();
  }, [camera, area, size.width, size.height, view, human, reduced, ceiling, focusPiece]);
  useFrame((_, delta) => {
    const blend = reduced ? 1 : 1 - Math.exp(-delta * (focusPiece ? 2.4 : 6));
    if (orbit.current) {
      const t = (performance.now() - orbit.current.startedAt) / TURN_ROTATION_MS;
      camera.position.copy(sampleCameraOrbit(orbit.current.from, orbit.current.to, t));
      if (t >= 1) orbit.current = null;
    } else camera.position.lerp(destination.current, blend);
    lookTarget.current.lerp(targetDestination.current, blend);
    camera.lookAt(lookTarget.current);
  });
  return null;
}
