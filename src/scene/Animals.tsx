import { useRef, type ReactNode, type RefObject } from 'react';
import { useFrame } from '@react-three/fiber';
import { MeshPhysicalMaterial, SphereGeometry, type Group } from 'three';
import { JET_POSE } from './animalPoses';
import type { Kind, Player } from '../game/types';

// Every animal part shares geometry; the fixed palette also shares GPU materials.
const sphere = new SphereGeometry(1, 24, 18);
const materials = new Map<string, MeshPhysicalMaterial>();
function surface(color: string, roughness: number) {
  const key = `${color}:${roughness}`;
  if (!materials.has(key))
    materials.set(
      key,
      new MeshPhysicalMaterial({
        color,
        roughness,
        envMapIntensity: 0.35,
        // Keep seal fur soft and matte while preserving a gentle sheen on
        // the smoother animals.
        clearcoat: roughness >= 0.6 ? 0.08 : 0.45,
        clearcoatRoughness: roughness >= 0.6 ? 0.72 : 0.3,
      }),
    );
  return materials.get(key)!;
}
type Vec3 = [number, number, number];
function Blob({
  at = [0, 0, 0],
  scale = [1, 1, 1],
  color,
  rotation = [0, 0, 0],
  roughness = 0.3,
}: {
  at?: Vec3;
  scale?: Vec3;
  color: string;
  rotation?: Vec3;
  roughness?: number;
}) {
  return (
    <mesh
      position={at}
      scale={scale}
      rotation={rotation}
      geometry={sphere}
      material={surface(color, roughness)}
      dispose={null}
      castShadow
      receiveShadow
    />
  );
}
function Eyes({
  y,
  z,
  spread = 0.15,
  size = 0.045,
}: {
  y: number;
  z: number;
  spread?: number;
  size?: number;
}) {
  return (
    <>
      {[-1, 1].map((side) => (
        <group key={side}>
          <Blob
            at={[side * spread, y, z]}
            scale={[size, size * 1.12, size * 0.7]}
            color="#182c3e"
          />
          <Blob
            at={[side * spread - size * 0.2, y + size * 0.3, z + size * 0.5]}
            scale={[size * 0.25, size * 0.25, size * 0.25]}
            color="white"
          />
        </group>
      ))}
    </>
  );
}
function Seal({ black }: { black: boolean }) {
  const color = black ? '#4e4b49' : '#eaf1ec';
  const furRoughness = 0.68;
  return (
    <group>
      <Blob at={[0, 0.35, -0.1]} scale={[0.35, 0.29, 0.5]} color={color} roughness={furRoughness} />
      <Blob at={[0, 0.47, 0.23]} scale={[0.32, 0.31, 0.3]} color={color} roughness={furRoughness} />
      {[-1, 1].map((s) => (
        <group key={s}>
          <Blob
            at={[s * 0.32, 0.17, 0.1]}
            scale={[0.19, 0.065, 0.13]}
            rotation={[0, s * 0.55, 0]}
            color={color}
            roughness={furRoughness}
          />
          <Blob
            at={[s * 0.12, 0.17, -0.52]}
            scale={[0.15, 0.07, 0.17]}
            rotation={[0, -s * 0.55, 0]}
            color={color}
            roughness={furRoughness}
          />
          <Blob
            at={[s * 0.19, 0.41, 0.467]}
            scale={[0.065, 0.04, 0.025]}
            color={black ? '#6b8894' : '#b8cbc8'}
          />
          {[0, 1].map((i) => (
            <mesh
              key={i}
              position={[s * 0.15, 0.41 - i * 0.05, 0.5]}
              rotation={[0, 0, s * (0.1 + i * 0.12)]}
            >
              <boxGeometry args={[0.17, 0.007, 0.007]} />
              <meshStandardMaterial color={black ? '#d7e5e7' : '#a6b5b9'} />
            </mesh>
          ))}
        </group>
      ))}
      <Eyes y={0.51} z={0.477} spread={0.13} />
      <Blob at={[0, 0.424, 0.52]} scale={[0.055, 0.035, 0.027]} color="#344958" />
    </group>
  );
}
/** Shared anatomy is posed continuously instead of swapping two penguin models. */
function PenguinPart({
  blend,
  from,
  to,
  turn = [0, 0, 0],
  children,
  engine = false,
}: {
  blend: RefObject<number>;
  from: Vec3;
  to: Vec3;
  turn?: Vec3;
  children: ReactNode;
  engine?: boolean;
}) {
  const group = useRef<Group>(null);
  useFrame(() => {
    if (!group.current) return;
    const progress = engine
      ? Math.max(0, Math.min(1, (blend.current - 0.45) / 0.55))
      : blend.current;
    const t = progress * progress * (3 - 2 * progress);
    group.current.position.set(...(from.map((v, i) => v + (to[i] - v) * t) as Vec3));
    group.current.rotation.set(...(turn.map((v) => v * t) as Vec3));
    if (engine) {
      group.current.scale.setScalar(Math.max(0.001, t));
      group.current.visible = t > 0.001;
    }
  });
  return (
    <group ref={group} position={from}>
      {children}
    </group>
  );
}
function Penguin({ jet, jetBlend }: { jet: boolean; jetBlend?: RefObject<number> }) {
  const fixed = useRef(jet ? 1 : 0);
  fixed.current = jet ? 1 : 0;
  const blend = jetBlend ?? fixed;
  return (
    <group>
      <PenguinPart blend={blend} from={[0, 0.43, 0]} to={JET_POSE.body} turn={[Math.PI / 2, 0, 0]}>
        <Blob scale={[0.29, 0.4, 0.26]} color="#263c4b" />
        <Blob at={[0, -0.03, 0.175]} scale={[0.235, 0.3, 0.13]} color="#fffdf2" />
      </PenguinPart>
      <PenguinPart blend={blend} from={[0, 0.76, 0.015]} to={JET_POSE.head}>
        <Blob scale={[0.245, 0.25, 0.23]} color="#263c4b" />
        {[-1, 1].map((side) => (
          <Blob
            key={side}
            at={[side * 0.115, -0.005, 0.18]}
            scale={[0.106, 0.13, 0.045]}
            color="#fffdf2"
          />
        ))}
        <Eyes y={0.03} z={0.223} spread={0.1} size={0.038} />
        <Blob at={[0, -0.073, 0.245]} scale={[0.085, 0.055, 0.115]} color="#f3b455" />
      </PenguinPart>
      {[-1, 1].map((side) => (
        <group key={side}>
          <PenguinPart
            blend={blend}
            from={[side * 0.29, 0.43, -0.01]}
            to={[side * 0.33, 0.2, -0.06]}
            turn={[0, 0, (side * Math.PI) / 2]}
          >
            <Blob scale={[0.07, 0.25, 0.12]} color="#263c4b" />
          </PenguinPart>
          <PenguinPart
            blend={blend}
            from={[side * 0.15, 0.1, 0.13]}
            to={[side * 0.14, 0.14, -0.49]}
          >
            <Blob scale={[0.12, 0.055, 0.17]} color="#f3b455" />
          </PenguinPart>
        </group>
      ))}
      <PenguinPart blend={blend} from={[0, 0.78, -0.48]} to={[0, 0.48, -0.15]} engine>
        <Blob scale={[0.12, 0.115, 0.23]} color="#70c1c5" />
        <mesh position={[0, 0, -0.25]} rotation={[Math.PI / 2, 0, 0]}>
          <cylinderGeometry args={[0.075, 0.095, 0.12, 16]} />
          <meshStandardMaterial color="#465b68" roughness={0.5} />
        </mesh>
        <mesh position={[0, 0, -0.34]} rotation={[-Math.PI / 2, 0, 0]}>
          <coneGeometry args={[0.065, 0.15, 16]} />
          <meshStandardMaterial color="#8feaff" emissive="#52bddd" emissiveIntensity={0.5} />
        </mesh>
      </PenguinPart>
    </group>
  );
}

function Bear() {
  return (
    <group>
      <Blob at={[0, 0.48, -0.08]} scale={[0.3, 0.3, 0.44]} color="#e6ece7" />
      <Blob at={[0, 0.64, 0.29]} scale={[0.26, 0.26, 0.26]} color="#f0f1e7" />
      <Blob at={[0, 0.54, 0.51]} scale={[0.16, 0.12, 0.2]} color="#e2e8df" />
      <Blob at={[0, 0.59, 0.68]} scale={[0.08, 0.048, 0.04]} color="#182f3a" />
      {[-1, 1].flatMap((side) =>
        [-1, 1].map((front) => (
          <Blob
            key={`${side}:${front}`}
            at={[side * 0.23, 0.22, front * 0.27]}
            scale={[0.115, 0.22, 0.15]}
            color="#dce5df"
          />
        )),
      )}
      {[-1, 1].map((side) => (
        <group key={side}>
          <Blob at={[side * 0.2, 0.82, 0.25]} scale={[0.08, 0.09, 0.055]} color="#edf1e9" />
          <Blob at={[side * 0.2, 0.82, 0.298]} scale={[0.043, 0.05, 0.015]} color="#a1b4b3" />
        </group>
      ))}
      <Eyes y={0.67} z={0.487} spread={0.15} size={0.034} />
      <Blob at={[0, 0.51, -0.49]} scale={[0.09, 0.085, 0.1]} color="#e6ece7" />
    </group>
  );
}
function Orca() {
  return (
    <group>
      <Blob at={[0, 0.48, -0.04]} scale={[0.36, 0.34, 0.77]} color="#263744" roughness={0.24} />
      <Blob at={[0, 0.4, 0.52]} scale={[0.32, 0.26, 0.3]} color="#263744" roughness={0.24} />
      <Blob at={[0, 0.257, 0.23]} scale={[0.26, 0.15, 0.49]} color="#fffdf3" />
      <mesh position={[0, 0.88, -0.24]} rotation={[0.1, 0, 0]} castShadow>
        <coneGeometry args={[0.19, 0.53, 3]} />
        <meshStandardMaterial color="#263744" />
      </mesh>
      {[-1, 1].map((s) => (
        <group key={s}>
          <Blob
            at={[s * 0.31, 0.55, 0.36]}
            scale={[0.055, 0.095, 0.18]}
            rotation={[0, s * 0.35, -s * 0.2]}
            color="#fffdf3"
          />
          <Blob
            at={[s * 0.34, 0.23, 0.02]}
            scale={[0.22, 0.055, 0.27]}
            rotation={[0, s * 0.5, 0]}
            color="#263744"
          />
          <Blob
            at={[s * 0.19, 0.29, -0.8]}
            scale={[0.27, 0.06, 0.14]}
            rotation={[0, -s * 0.35, 0]}
            color="#263744"
          />
        </group>
      ))}
      <Eyes y={0.51} z={0.77} spread={0.15} size={0.033} />
    </group>
  );
}
function Walrus() {
  return (
    <group>
      <Blob at={[0, 0.46, -0.05]} scale={[0.64, 0.43, 0.68]} color="#b18b6e" />
      <Blob at={[0, 0.72, 0.32]} scale={[0.5, 0.41, 0.4]} color="#bd987b" />
      {[-1, 1].map((s) => (
        <group key={s}>
          <Blob
            at={[s * 0.57, 0.18, 0.15]}
            scale={[0.3, 0.075, 0.26]}
            rotation={[0, s * 0.45, 0]}
            color="#a67e62"
          />
          <Blob
            at={[s * 0.24, 0.21, -0.65]}
            scale={[0.28, 0.08, 0.25]}
            rotation={[0, s * -0.4, 0]}
            color="#a67e62"
          />
          <Blob at={[s * 0.165, 0.59, 0.664]} scale={[0.2, 0.13, 0.14]} color="#d1b29a" />
          <mesh position={[s * 0.19, 0.32, 0.75]} rotation={[Math.PI, 0, s * -0.08]} castShadow>
            <coneGeometry args={[0.052, 0.52, 16]} />
            <meshStandardMaterial color="#fff6d9" />
          </mesh>
          {[0, 1, 2].map((i) => (
            <mesh
              key={i}
              position={[s * 0.29, 0.62 - i * 0.05, 0.78]}
              rotation={[0, 0, s * (0.1 + i * 0.14)]}
            >
              <boxGeometry args={[0.25, 0.009, 0.009]} />
              <meshStandardMaterial color="#79634f" />
            </mesh>
          ))}
        </group>
      ))}
      <Eyes y={0.8} z={0.665} spread={0.21} size={0.048} />
      <Blob at={[0, 0.65, 0.79]} scale={[0.09, 0.05, 0.045]} color="#574b43" />
      <group position={[0, 1.1, 0.3]}>
        <mesh castShadow>
          <cylinderGeometry args={[0.17, 0.13, 0.1, 16]} />
          <meshStandardMaterial color="#e7b85c" metalness={0.3} roughness={0.3} />
        </mesh>
        {[-1, 0, 1].map((i) => (
          <mesh key={i} position={[i * 0.12, 0.1, 0]}>
            <coneGeometry args={[0.07, 0.17, 4]} />
            <meshStandardMaterial color="#f2cc79" />
          </mesh>
        ))}
      </group>
    </group>
  );
}
export function Animal({
  kind,
  promoted = false,
  animate = false,
  owner,
  jetBlend,
}: {
  kind: Kind;
  promoted?: boolean;
  animate?: boolean;
  owner?: Player;
  jetBlend?: RefObject<number>;
}) {
  const group = useRef<Group>(null);
  useFrame(({ clock }) => {
    if (group.current)
      group.current.position.y = animate ? Math.sin(clock.elapsedTime * 2.2) * 0.018 : 0;
  });
  return (
    <group ref={group}>
      {kind === 'seal' ? (
        <Seal black={promoted} />
      ) : kind === 'penguin' ? (
        <Penguin jet={promoted} jetBlend={jetBlend} />
      ) : kind === 'bear' ? (
        <Bear />
      ) : kind === 'orca' ? (
        <Orca />
      ) : (
        <Walrus />
      )}
      {owner && <OwnerBadge kind={kind} promoted={promoted} owner={owner} jetBlend={jetBlend} />}
    </group>
  );
}

/** A small body badge replaces team-colored plinths without obscuring the animal. */
function OwnerBadge({
  kind,
  promoted,
  owner,
  jetBlend,
}: {
  kind: Kind;
  promoted: boolean;
  owner: Player;
  jetBlend?: RefObject<number>;
}) {
  const badge = useRef<Group>(null);
  useFrame(() => {
    if (kind !== 'penguin' || !badge.current) return;
    const t = jetBlend?.current ?? Number(promoted);
    badge.current.position.set(0, 0.51 - 0.07 * t, 0.298 - 0.258 * t);
    badge.current.rotation.x = (-Math.PI / 2) * t;
  });
  const sites: Record<Kind, Vec3> = {
    seal: [0, 0.65, -0.22],
    penguin: [0, 0.51, 0.298],
    bear: [0, 0.78, -0.1],
    orca: [0, 0.82, 0.03],
    walrus: [0, 0.89, -0.17],
  };
  const upright = kind === 'penguin' && !promoted;
  return (
    <group
      ref={badge}
      position={kind === 'penguin' && promoted ? [0, 0.44, 0.04] : sites[kind]}
      rotation={[upright ? 0 : -Math.PI / 2, 0, 0]}
    >
      <mesh>
        <circleGeometry args={[0.09, 20]} />
        <meshStandardMaterial color="#fffaf0" />
      </mesh>
      <mesh position={[0, 0, 0.002]}>
        <circleGeometry args={[0.066, 20]} />
        <meshStandardMaterial color={owner === 'south' ? '#279ed3' : '#f09a58'} />
      </mesh>
    </group>
  );
}
