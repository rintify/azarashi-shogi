import { useEffect, useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { PlaneGeometry, ShaderMaterial, Vector2, type Mesh } from 'three';
import { center, landingMoment, progress, type MoveMotion } from '../presentation/motion';
import type { ActionPreview } from '../game/types';

const RIPPLE_MS = 1450;
const board = new PlaneGeometry(10.02, 10.02);
const vertexShader = [
  'varying vec3 vWorldPosition;',
  'void main() {',
  '  vec4 worldPosition = modelMatrix * vec4(position, 1.0);',
  '  vWorldPosition = worldPosition.xyz;',
  '  gl_Position = projectionMatrix * viewMatrix * worldPosition;',
  '}',
].join('\n');
const fragmentShader = [
  'uniform vec2 uOrigin;',
  'uniform float uRadius;',
  'uniform float uOpacity;',
  'varying vec3 vWorldPosition;',
  'void main() {',
  '  float d = distance(vWorldPosition.xz, uOrigin);',
  '  float band = 1.0 - smoothstep(0.008, 0.055, abs(d - uRadius));',
  '  float halo = 1.0 - smoothstep(0.025, 0.16, abs(d - uRadius));',
  '  float alpha = uOpacity * (band * 0.56 + halo * 0.15);',
  '  gl_FragColor = vec4(1.0, 1.0, 1.0, alpha);',
  '}',
].join('\n');

/** One soft surface ripple replaces the persistent tint on the previous move's cells. */
export function LastMoveRipple({
  action,
  motion,
  reduced,
}: {
  action: ActionPreview;
  motion: MoveMotion | null;
  reduced: boolean;
}) {
  const mesh = useRef<Mesh>(null);
  const startedAt = useRef<number | null>(null);
  const finished = useRef(false);
  const [x, , z] = center(action.piece);
  const maxRadius = Math.max(
    ...[-5, 5].flatMap((boardX) => [-5, 5].map((boardZ) => Math.hypot(boardX - x, boardZ - z))),
  );
  const material = useMemo(
    () =>
      new ShaderMaterial({
        uniforms: {
          uOrigin: { value: new Vector2(x, z) },
          uRadius: { value: 0 },
          uOpacity: { value: 0 },
        },
        vertexShader,
        fragmentShader,
        transparent: true,
        depthWrite: false,
        toneMapped: false,
      }),
    [x, z],
  );
  useEffect(() => () => material.dispose(), [material]);
  useFrame(() => {
    if (!mesh.current) return;
    const now = performance.now();
    if (reduced || finished.current) {
      mesh.current.visible = false;
      return;
    }
    if (startedAt.current === null) {
      if (
        !motion ||
        motion.action !== action ||
        motion.stage === 'choice' ||
        motion.stage === 'return' ||
        progress(motion, now) < landingMoment(motion)
      ) {
        mesh.current.visible = false;
        return;
      }
      startedAt.current = now;
    }
    const t = Math.min(1, (now - startedAt.current) / RIPPLE_MS);
    material.uniforms.uRadius.value = maxRadius * t;
    material.uniforms.uOpacity.value = (1 - t) * 0.34;
    mesh.current.visible = t < 1;
    if (t >= 1) finished.current = true;
  });
  return (
    <mesh
      ref={mesh}
      geometry={board}
      material={material}
      rotation={[-Math.PI / 2, 0, 0]}
      position={[0, 0.172, 0]}
      raycast={() => null}
      frustumCulled={false}
      dispose={null}
    />
  );
}
