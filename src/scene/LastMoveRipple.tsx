import { useEffect, useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { PlaneGeometry, ShaderMaterial, Vector2, type Mesh } from 'three';
import { center } from '../presentation/motion';
import type { ActionPreview } from '../game/types';

const RIPPLE_MS = 720;
const RIPPLE_INTERVAL_MS = 1900;
const RIPPLE_RADIUS = 1.18;
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

/** Repeats a small, soft surface ripple from the center of the last-moved piece. */
export function LastMoveRipple({
  action,
  reduced,
}: {
  action: ActionPreview;
  reduced: boolean;
}) {
  const mesh = useRef<Mesh>(null);
  const startedAt = useRef(performance.now());
  const [x, , z] = center(action.piece);
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
    if (reduced) {
      mesh.current.visible = false;
      return;
    }
    const cycle = (performance.now() - startedAt.current) % RIPPLE_INTERVAL_MS;
    const t = cycle / RIPPLE_MS;
    const active = cycle < RIPPLE_MS;
    const envelope = Math.sin(Math.PI * t);
    material.uniforms.uRadius.value = RIPPLE_RADIUS * t;
    material.uniforms.uOpacity.value = envelope * 0.28;
    mesh.current.visible = active;
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
