import { useEffect, useRef } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import { GameCanvas } from './GameCanvas';
import { OrbitControls } from '@react-three/drei';
import { PCFSoftShadowMap, type Group } from 'three';
import type { Kind } from '../game/types';
import { Animal } from './Animals';

function CameraFit() {
  const { camera, size } = useThree();
  useEffect(() => {
    const portrait = Math.max(1, size.height / size.width);
    camera.position.set(1.8 * portrait, 0.56 + 1.2 * portrait, 2.75 * portrait);
    camera.lookAt(0, 0.56, 0);
  }, [camera, size.width, size.height]);
  return null;
}

function Exhibit({ kind, promoted, reduced }: { kind: Kind; promoted: boolean; reduced: boolean }) {
  const model = useRef<Group>(null);
  const born = useRef(performance.now());
  useEffect(() => {
    born.current = performance.now();
  }, [kind, promoted]);
  useFrame(() => {
    if (!model.current) return;
    const t = reduced ? 1 : Math.min(1, (performance.now() - born.current) / 420);
    const ease = 1 - (1 - t) ** 3;
    model.current.scale.setScalar(0.88 + 0.12 * ease);
    model.current.position.y = (1 - ease) * 0.16;
  });
  return (
    <group ref={model} rotation={[0, promoted && kind === 'orca' ? Math.PI / 2 : -0.35, 0]}>
      <Animal kind={kind} promoted={promoted} />
    </group>
  );
}
export function CatalogScene({
  kind,
  promoted,
  rotating,
  reduced,
}: {
  kind: Kind;
  promoted: boolean;
  rotating: boolean;
  reduced: boolean;
}) {
  return (
    <GameCanvas
      shadows={{ type: PCFSoftShadowMap }}
      dpr={[1, 1.8]}
      camera={{ position: [2.2, 1.9, 3.2], fov: 32 }}
    >
      <CameraFit />
      <color attach="background" args={['#d9edf3']} />
      <hemisphereLight args={['#fff7ed', '#6d9cb3', 2]} />
      <directionalLight
        position={[-3, 6, 4]}
        intensity={2.5}
        castShadow
        shadow-mapSize={[1024, 1024]}
        shadow-normalBias={0.03}
      />
      <Exhibit key={`${kind}-${promoted}`} kind={kind} promoted={promoted} reduced={reduced} />
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.055, 0]} receiveShadow>
        <planeGeometry args={[200, 200]} />
        <meshStandardMaterial color="#edf8fa" roughness={0.9} />
      </mesh>
      <OrbitControls
        makeDefault
        target={[0, 0.56, 0]}
        autoRotate={rotating}
        autoRotateSpeed={0.7}
        enablePan={false}
        minDistance={2.4}
        maxDistance={8}
        minPolarAngle={0.35}
        maxPolarAngle={Math.PI / 2 - 0.04}
      />
    </GameCanvas>
  );
}
