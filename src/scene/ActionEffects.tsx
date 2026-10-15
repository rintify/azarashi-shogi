import { useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import type { Group, Mesh, MeshBasicMaterial } from 'three';
import { TravelEffects } from './TravelEffects';
import { SnowImpact } from './SnowImpact';
import {
  center,
  progress,
  landingMoment,
  transformationProgress,
  sampleMotion,
  type MoveMotion,
} from '../presentation/motion';
export function ActionEffects({ motion }: { motion: MoveMotion }) {
  const root = useRef<Group>(null),
    ring = useRef<Mesh>(null);
  const glints = useRef<Group>(null);
  const shards = useRef<Group>(null);
  const target = center(motion.action.piece);
  useFrame(() => {
    if (!root.current || !ring.current || !shards.current) return;
    const t = progress(motion, performance.now());
    if (glints.current) {
      const change = transformationProgress(motion, t);
      const pose = sampleMotion(motion, t);
      glints.current.position.set(pose.position[0], pose.position[1] + 0.8, pose.position[2]);
      glints.current.visible = !motion.reduced && change > 0 && change < 1;
      glints.current.children.forEach((child, i) => {
        const mesh = child as Mesh;
        const angle = (i * Math.PI * 2) / 14 + change * 0.8;
        const radius = 0.55 + change * 0.6;
        mesh.position.set(
          Math.cos(angle) * radius,
          Math.sin(angle * 2) * radius * 0.65,
          Math.sin(angle) * radius,
        );
        mesh.rotation.set(0, change * 3, Math.PI / 4);
        mesh.scale.set(0.08, (i % 2 ? 0.2 : 0.3) * Math.sin(change * Math.PI), 0.08);
        (mesh.material as MeshBasicMaterial).opacity = Math.sin(change * Math.PI);
      });
    }
    if (motion.stage === 'choice') {
      root.current.visible = false;
      return;
    }
    const start = landingMoment(motion);
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
    <>
      <TravelEffects motion={motion} />
      {motion.action.piece.kind === 'walrus' && <SnowImpact motion={motion} />}
      <group ref={glints} visible={false}>
        {Array.from({ length: 14 }, (_, i) => (
          <mesh key={i}>
            <octahedronGeometry args={[1, 0]} />
            <meshBasicMaterial
              color={i % 3 ? '#d3faff' : '#ffec9e'}
              transparent
              depthWrite={false}
              toneMapped={false}
            />
          </mesh>
        ))}
      </group>
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
    </>
  );
}
