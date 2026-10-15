import { useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import type { Group, Mesh, MeshBasicMaterial } from 'three';
import { center, progress, IMPACT, type MoveMotion } from '../presentation/motion';
export function ActionEffects({ motion }: { motion: MoveMotion }) {
  const root = useRef<Group>(null),
    ring = useRef<Mesh>(null);
  const shards = useRef<Group>(null);
  const target = center(motion.action.piece);
  useFrame(() => {
    if (!root.current || !ring.current || !shards.current) return;
    const t = progress(motion, performance.now());
    const start = motion.before ? IMPACT : 0.66;
    const p = Math.max(0, Math.min(1, (t - start) / (1 - start)));
    root.current.visible = t >= start && !motion.reduced;
    ring.current.scale.setScalar(0.3 + p * 2.2);
    (ring.current.material as MeshBasicMaterial).opacity = (1 - p) * 0.7;
    shards.current.children.forEach((shard, i) => {
      const a = (i * Math.PI * 2) / 12;
      shard.position.set(
        Math.cos(a) * p * 1.5,
        Math.sin(p * Math.PI) * (0.35 + (i % 3) * 0.16),
        Math.sin(a) * p * 1.5,
      );
      shard.rotation.set(p * 4, i, p * 2);
      shard.scale.setScalar((1 - p) * 0.08);
    });
  });
  return (
    <group ref={root} position={[target[0], 0.16, target[2]]}>
      <mesh ref={ring} rotation={[-Math.PI / 2, 0, 0]}>
        <ringGeometry args={[0.9, 1, 48]} />
        <meshBasicMaterial
          color={motion.action.captured.length ? '#ffbb74' : '#a4f0ff'}
          transparent
          depthWrite={false}
        />
      </mesh>
      <group ref={shards}>
        {Array.from({ length: 12 }, (_, i) => (
          <mesh key={i}>
            <octahedronGeometry args={[1, 0]} />
            <meshBasicMaterial color={i % 3 ? '#d4faff' : '#ffffff'} transparent />
          </mesh>
        ))}
      </group>
    </group>
  );
}
