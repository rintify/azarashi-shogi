import { useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { AdditiveBlending, type Group, type Mesh, type MeshBasicMaterial } from 'three';
import {
  center,
  clamp,
  facing,
  progress,
  sampleMotion,
  type MoveMotion,
} from '../presentation/motion';
import { bodyDynamics, travelEnd } from '../presentation/movement';

/** A single moving actor owns a fixed particle pool, updated without React renders. */
export function TravelEffects({ motion }: { motion: MoveMotion }) {
  const root = useRef<Group>(null),
    flame = useRef<Group>(null),
    trail = useRef<Group>(null),
    waves = useRef<Group>(null);
  const before = motion.before;
  const jet = before?.kind === 'penguin' && before.promoted;
  const orca = before?.kind === 'orca';
  const origin = before ? center(before) : [0, 0, 0];
  const destination =
    before && motion.action.action.type === 'move'
      ? center({ ...before, at: motion.action.action.to })
      : origin;
  const heading = Math.atan2(destination[0] - origin[0], destination[2] - origin[2]);
  useFrame(() => {
    if (!root.current || !before) return;
    const t = progress(motion, performance.now());
    const end = travelEnd(motion);
    const active =
      !motion.reduced &&
      motion.stage !== 'resolve' &&
      motion.stage !== 'return' &&
      t > 0 &&
      t < end + 0.12;
    root.current.visible = active;
    if (!active) return;
    const pose = sampleMotion(motion, t);
    const strength = Math.sin(clamp(t / end) * Math.PI);
    if (flame.current) {
      const thrust = bodyDynamics(motion, t).thrust;
      flame.current.position.set(pose.position[0], pose.position[1] + 0.56, pose.position[2]);
      flame.current.rotation.y = facing(before);
      flame.current.visible = thrust > 0.01;
      flame.current.scale.set(
        0.8 + thrust * 0.2,
        0.8 + thrust * 0.2,
        (0.45 + thrust * 0.9) * (1 + Math.sin(t * 110) * 0.09),
      );
    }
    trail.current?.children.forEach((child, i) => {
      const mesh = child as Mesh;
      const age = (t * 5 + i / 24) % 1;
      const sampleAt = t - age * (jet ? 0.2 : 0.22);
      const old = sampleMotion(motion, clamp(sampleAt));
      const side = i % 2 ? 1 : -1;
      const yaw = orca ? heading : facing(before);
      const lateral = orca ? side * (0.35 + age * 0.45) : Math.sin(i * 7) * age * 0.22;
      mesh.position.set(
        old.position[0] + Math.cos(yaw) * lateral,
        old.position[1] + (jet ? 0.52 : 0.2) + age * 0.08,
        old.position[2] - Math.sin(yaw) * lateral,
      );
      mesh.scale.setScalar((jet ? 0.09 : 0.06) * (1 - age) * (0.5 + strength));
      (mesh.material as MeshBasicMaterial).opacity =
        sampleAt > 0 && sampleAt < end ? (1 - age) * (jet ? 0.8 : 0.7) : 0;
    });
    waves.current?.children.forEach((child, i) => {
      const mesh = child as Mesh;
      const age = (t * 2.6 + i / 6) % 1;
      const sampleAt = t - age * 0.22;
      const old = sampleMotion(motion, clamp(sampleAt));
      mesh.position.set(old.position[0], 0.195, old.position[2]);
      mesh.rotation.set(-Math.PI / 2, 0, -heading + Math.PI * 0.15);
      mesh.scale.set(0.6 + age * 1.1, 0.7 + age * 1.2, 1);
      (mesh.material as MeshBasicMaterial).opacity =
        sampleAt > 0 && sampleAt < end ? (1 - age) * 0.65 : 0;
    });
  });
  if (!jet && !orca) return null;
  return (
    <group ref={root} visible={false} raycast={() => null}>
      {jet && (
        <group ref={flame}>
          <mesh position={[0, 0, -1.0]} rotation={[-Math.PI / 2, 0, 0]}>
            <coneGeometry args={[0.18, 1.2, 20]} />
            <meshBasicMaterial
              color="#21c7ff"
              transparent
              opacity={0.65}
              blending={AdditiveBlending}
              depthWrite={false}
              toneMapped={false}
            />
          </mesh>
          <mesh position={[0, 0, -0.78]} scale={[0.09, 0.09, 0.45]}>
            <sphereGeometry args={[1, 12, 8]} />
            <meshBasicMaterial
              color="#f3feff"
              blending={AdditiveBlending}
              depthWrite={false}
              toneMapped={false}
            />
          </mesh>
          {[-1, 1].map((side) => (
            <mesh key={side} position={[side * 0.4, 0.02, -0.4]}>
              <boxGeometry args={[0.018, 0.018, 1.25]} />
              <meshBasicMaterial
                color="#b4f7ff"
                transparent
                opacity={0.8}
                depthWrite={false}
                toneMapped={false}
              />
            </mesh>
          ))}
        </group>
      )}
      <group ref={trail}>
        {Array.from({ length: 24 }, (_, i) => (
          <mesh key={i}>
            <sphereGeometry args={[1, 8, 6]} />
            <meshBasicMaterial
              color={jet ? (i % 3 ? '#6ce8ff' : '#ffffff') : '#f4feff'}
              transparent
              depthWrite={false}
              toneMapped={false}
              blending={jet ? AdditiveBlending : undefined}
            />
          </mesh>
        ))}
      </group>
      {orca && (
        <group ref={waves}>
          {Array.from({ length: 6 }, (_, i) => (
            <mesh key={i}>
              <torusGeometry args={[0.65, 0.025, 5, 36, Math.PI * 1.7]} />
              <meshBasicMaterial
                color={i % 2 ? '#e8fdff' : '#53cfed'}
                transparent
                depthWrite={false}
                toneMapped={false}
              />
            </mesh>
          ))}
        </group>
      )}
    </group>
  );
}
