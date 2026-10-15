import { useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import type { Group, Mesh, MeshBasicMaterial } from 'three';
import { center, clamp, landingMoment, progress, type MoveMotion } from '../presentation/motion';

export function SnowImpact({ motion }: { motion: MoveMotion }) {
  const root = useRef<Group>(null),
    clouds = useRef<Group>(null),
    flecks = useRef<Group>(null),
    ring = useRef<Mesh>(null);
  const target = center(motion.action.piece);
  useFrame(() => {
    if (!root.current) return;
    const t = progress(motion, performance.now()),
      at = landingMoment(motion);
    const p = clamp((t - at) / (1 - at));
    root.current.visible = !motion.reduced && t >= at && p < 1;
    if (!root.current.visible) return;
    clouds.current?.children.forEach((child, i) => {
      const mesh = child as Mesh,
        a = i * 2.39996;
      const distance = 0.6 + Math.sqrt(p) * (0.8 + (i % 3) * 0.18);
      mesh.position.set(
        Math.cos(a) * distance,
        0.04 + Math.sin(p * Math.PI) * (0.15 + (i % 4) * 0.07),
        Math.sin(a) * distance,
      );
      mesh.scale.setScalar((0.16 + Math.sin(p * Math.PI) * 0.24) * (1 + (i % 3) * 0.15));
      (mesh.material as MeshBasicMaterial).opacity = Math.pow(1 - p, 1.4) * 0.58;
    });
    flecks.current?.children.forEach((child, i) => {
      const mesh = child as Mesh,
        a = i * 2.39996;
      mesh.position.set(
        Math.cos(a) * p * 2.3,
        Math.sin(p * Math.PI) * (0.4 + (i % 5) * 0.12),
        Math.sin(a) * p * 2.3,
      );
      mesh.rotation.set(p * 5, i, p * 4);
      mesh.scale.setScalar((1 - p) * 0.07);
      (mesh.material as MeshBasicMaterial).opacity = 1 - p;
    });
    if (ring.current) {
      ring.current.scale.setScalar(0.5 + p * 2.6);
      (ring.current.material as MeshBasicMaterial).opacity = (1 - p) * 0.55;
    }
  });
  return (
    <group ref={root} position={[target[0], 0.19, target[2]]} visible={false} raycast={() => null}>
      <mesh ref={ring} rotation={[-Math.PI / 2, 0, 0]}>
        <ringGeometry args={[0.96, 1, 64]} />
        <meshBasicMaterial color="white" transparent depthWrite={false} toneMapped={false} />
      </mesh>
      <group ref={clouds}>
        {Array.from({ length: 16 }, (_, i) => (
          <mesh key={i}>
            <sphereGeometry args={[1, 10, 8]} />
            <meshBasicMaterial
              color={i % 2 ? '#ffffff' : '#d7edf7'}
              transparent
              depthWrite={false}
              toneMapped={false}
            />
          </mesh>
        ))}
      </group>
      <group ref={flecks}>
        {Array.from({ length: 20 }, (_, i) => (
          <mesh key={i}>
            <octahedronGeometry args={[1, 0]} />
            <meshBasicMaterial color="white" transparent depthWrite={false} toneMapped={false} />
          </mesh>
        ))}
      </group>
    </group>
  );
}
