import { useRef, type RefObject } from 'react';
import { useFrame } from '@react-three/fiber';
import { Html, RoundedBox } from '@react-three/drei';
import type { Group } from 'three';
import type { Cell, Piece } from '../game/types';
import { dimensions } from '../game/pieces';
import { Animal } from './Animals';
import {
  captureProgress,
  center,
  facing,
  progress,
  sampleMotion,
  transformationProgress,
  type MoveMotion,
} from '../presentation/motion';

export interface ActorProps {
  piece: Piece;
  motion: MoveMotion | null;
  victim?: boolean;
  selected: boolean;
  targeted: boolean;
  source: boolean;
  threatened: boolean;
  disabled: boolean;
  htmlPortal: RefObject<HTMLDivElement>;
  onCell: (c: Cell) => void;
  onHover: (c: Cell | null) => void;
  onThreat: () => void;
}
export function PieceActor({
  piece,
  motion,
  victim = false,
  selected,
  targeted,
  source,
  threatened,
  disabled,
  htmlPortal,
  onCell,
  onHover,
  onThreat,
}: ActorProps) {
  const root = useRef<Group>(null),
    base = useRef<Group>(null),
    model = useRef<Group>(null),
    beforeModel = useRef<Group>(null),
    afterModel = useRef<Group>(null);
  const moving = !!motion && !victim && motion.action.piece.id === piece.id;
  const rotation =
    moving &&
    motion?.action.action.type === 'move' &&
    motion.action.action.transformation?.type === 'rotate';
  const [w, h] = dimensions(rotation && motion?.before ? motion.before : piece);
  const ownerColor = piece.owner === 'south' ? '#087fad' : '#e58e3f';
  const color = targeted ? '#ef7049' : source ? '#f5b83b' : selected ? '#38d1df' : ownerColor;
  useFrame(() => {
    if (!root.current || !model.current) return;
    let position = center(piece),
      scale = 1,
      yaw = facing(piece),
      promoted = piece.promoted;
    if (motion) {
      const t = progress(motion, performance.now());
      if (victim) {
        const eaten = captureProgress(motion, piece, t);
        scale = 1 - eaten;
        position[1] = eaten * 0.7;
      } else if (moving) {
        const pose = sampleMotion(motion, t);
        position = pose.position;
        scale = pose.scale;
        yaw = pose.yaw;
        promoted = pose.promoted;
        if (
          base.current &&
          rotation &&
          motion.action.action.type === 'move' &&
          motion.action.action.transformation?.type === 'rotate'
        ) {
          const ease = transformationProgress(motion, t);
          base.current.rotation.y =
            ((-motion.action.action.transformation.direction * Math.PI) / 2) * ease;
        }
      }
    }
    root.current.position.set(...position);
    root.current.scale.setScalar(Math.max(0.001, scale));
    root.current.visible = scale > 0.005;
    model.current.rotation.y = yaw;
    if (beforeModel.current)
      beforeModel.current.visible =
        !moving || promoted === (motion?.before?.promoted ?? piece.promoted);
    if (afterModel.current)
      afterModel.current.visible = !!moving && promoted !== motion?.before?.promoted;
    if (base.current && !rotation) base.current.rotation.y = 0;
  });
  const initialPromoted = moving && motion?.before ? motion.before.promoted : piece.promoted;
  const modelScale = piece.kind === 'walrus' ? 1 : piece.kind === 'orca' ? 0.9 : 0.86;
  return (
    <group
      ref={root}
      position={center(piece)}
      onClick={(e) => {
        e.stopPropagation();
        if (disabled || victim || e.delta > 6) return;
        onCell({
          x: Math.max(0, Math.min(9, Math.floor(e.point.x + 5))),
          y: Math.max(0, Math.min(9, Math.floor(e.point.z + 5))),
        });
      }}
      onPointerMove={(e) => {
        e.stopPropagation();
        if (!disabled && !victim)
          onHover({
            x: Math.max(0, Math.min(9, Math.floor(e.point.x + 5))),
            y: Math.max(0, Math.min(9, Math.floor(e.point.z + 5))),
          });
      }}
      onPointerOut={() => onHover(null)}
    >
      <group ref={base}>
        <RoundedBox
          args={[w - 0.13, 0.11, h - 0.13]}
          position={[0, 0.22, 0]}
          radius={0.055}
          castShadow
          receiveShadow
        >
          <meshPhysicalMaterial
            color={color}
            metalness={0.15}
            roughness={0.25}
            clearcoat={1}
            emissive={selected ? '#197591' : '#000000'}
            emissiveIntensity={0.3}
          />
        </RoundedBox>
        <RoundedBox
          args={[w - 0.21, 0.055, h - 0.21]}
          position={[0, 0.3, 0]}
          radius={0.025}
          receiveShadow
        >
          <meshPhysicalMaterial color="#e5f4f7" roughness={0.34} clearcoat={0.8} />
        </RoundedBox>
      </group>
      <group
        ref={model}
        position={[0, 0.33, 0]}
        rotation={[0, facing(piece), 0]}
        scale={modelScale}
      >
        <group ref={beforeModel}>
          <Animal kind={piece.kind} promoted={initialPromoted} animate={selected && !disabled} />
        </group>
        {moving && motion?.before && motion.before.promoted !== piece.promoted && (
          <group ref={afterModel} visible={false}>
            <Animal kind={piece.kind} promoted={piece.promoted} />
          </group>
        )}
      </group>
      <mesh
        position={[0, 0.34, (h / 2 - 0.22) * (piece.owner === 'south' ? -1 : 1)]}
        rotation={[-Math.PI / 2, 0, piece.owner === 'south' ? 0 : Math.PI]}
      >
        <circleGeometry args={[0.085, 3]} />
        <meshBasicMaterial color={ownerColor} />
      </mesh>
      {selected && !disabled && (
        <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.155, 0]}>
          <ringGeometry args={[Math.max(w, h) * 0.5, Math.max(w, h) * 0.5 + 0.035, 64]} />
          <meshBasicMaterial color="#33d4f2" transparent opacity={0.75} />
        </mesh>
      )}
      {threatened && !disabled && !victim && (
        <Html position={[w / 2 - 0.14, 1.5, 0]} center portal={htmlPortal} zIndexRange={[25, 20]}>
          <button
            className="threat-badge"
            aria-label="この駒を捕食できる相手を表示"
            onClick={(e) => {
              e.stopPropagation();
              onThreat();
            }}
          >
            !
          </button>
        </Html>
      )}
    </group>
  );
}
