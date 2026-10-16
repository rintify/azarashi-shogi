import { useMemo, useRef } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import { CanvasTexture, Vector3, type Group, type Sprite } from 'three';
import {
  captureTransfers,
  transferPoint,
  type CaptureTransfer,
} from '../presentation/captureTransfers';
import { center, type MoveMotion } from '../presentation/motion';

let lightTexture: CanvasTexture | undefined;
function orbTexture() {
  if (lightTexture) return lightTexture;
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = 64;
  const ctx = canvas.getContext('2d')!;
  const gradient = ctx.createRadialGradient(32, 32, 0, 32, 32, 32);
  gradient.addColorStop(0, '#ffffff');
  gradient.addColorStop(0.12, '#ffffff');
  gradient.addColorStop(0.3, '#ffffffc0');
  gradient.addColorStop(0.6, '#ffffff38');
  gradient.addColorStop(1, '#ffffff00');
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, 64, 64);
  lightTexture = new CanvasTexture(canvas);
  return lightTexture;
}

export function CaptureTransfers({ motion }: { motion: MoveMotion }) {
  const flights = useMemo(() => captureTransfers(motion), [motion]);
  if (motion.reduced) return null;
  return flights.map((flight) => (
    <CaptureOrb key={flight.victim.id} flight={flight} motion={motion} />
  ));
}
function CaptureOrb({ flight, motion }: { flight: CaptureTransfer; motion: MoveMotion }) {
  const root = useRef<Group>(null);
  const destination = useRef<HTMLElement | null>(null);
  const { camera, size, gl } = useThree();
  const vectors = useMemo(
    () => ({ start: new Vector3(), point: new Vector3(), edge: new Vector3() }),
    [],
  );
  const color = motion.action.piece.owner === 'south' ? '#46dbf2' : '#ffc967';
  useFrame(() => {
    if (!root.current) return;
    const now = performance.now();
    const t = (now - flight.launchAt) / (flight.arriveAt - flight.launchAt);
    root.current.visible = t >= 0 && t < 1;
    if (!root.current.visible) return;
    if (!destination.current?.isConnected)
      destination.current = document.querySelector<HTMLElement>(
        `[data-stock-player="${motion.action.piece.owner}"][data-stock-kind="${flight.victim.kind}"]`,
      );
    const bounds = gl.domElement.getBoundingClientRect();
    const target = destination.current?.getBoundingClientRect();
    if (!target || target.width === 0) {
      root.current.visible = false;
      return;
    }
    vectors.start.set(...center(flight.victim));
    vectors.start.y = 0.6;
    vectors.start.project(camera);
    const from = {
      x: ((vectors.start.x + 1) * size.width) / 2,
      y: ((1 - vectors.start.y) * size.height) / 2,
    };
    const to = {
      x: target.left + target.width / 2 - bounds.left,
      y: target.top + target.height / 2 - bounds.top,
    };
    root.current.children.forEach((child, index) => {
      const sprite = child as Sprite;
      const tail = Math.max(0, index - 1) * 0.035;
      const sample = Math.max(0, t - tail);
      const point = transferPoint(from, to, sample);
      vectors.point
        .set((point.x / size.width) * 2 - 1, 1 - (point.y / size.height) * 2, 0)
        .unproject(camera);
      vectors.edge
        .set(((point.x + 26) / size.width) * 2 - 1, 1 - (point.y / size.height) * 2, 0)
        .unproject(camera);
      sprite.position.copy(vectors.point);
      sprite.scale.setScalar(
        vectors.point.distanceTo(vectors.edge) *
          (index === 0 ? 0.3 : index === 1 ? 1 : 0.8 - index * 0.07),
      );
      sprite.material.opacity =
        Math.min(1, t * 9) *
        (1 - Math.max(0, (t - 0.88) / 0.12)) *
        (index < 2 ? 1 : (1 - index / 8) * 0.5);
    });
  });
  return (
    <group ref={root} visible={false}>
      {Array.from({ length: 6 }, (_, index) => (
        <sprite key={index} renderOrder={1000 - index}>
          <spriteMaterial
            map={orbTexture()}
            color={index === 0 ? '#ffffff' : color}
            transparent
            depthTest={false}
            depthWrite={false}
            toneMapped={false}
          />
        </sprite>
      ))}
    </group>
  );
}
