import { useEffect, useRef, useState, type RefObject } from 'react';
import { useFrame } from '@react-three/fiber';
import { Html } from '@react-three/drei';
import { Crown } from 'lucide-react';
import { Color, MeshBasicMaterial, type Group } from 'three';
import type { Cell, Piece } from '../game/types';
import { dimensions } from '../game/pieces';
import { AnimatedPresence } from '../components/AnimatedUI';
import { Animal } from './Animals';
import { bodyDynamics } from '../presentation/movement';
import {
  captureProgress,
  center,
  facing,
  progress,
  sampleMotion,
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
  kingCapture: boolean;
  disabled: boolean;
  reduced: boolean;
  intro: boolean;
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
  kingCapture,
  disabled,
  reduced,
  intro,
  htmlPortal,
  onCell,
  onHover,
  onThreat,
}: ActorProps) {
  const root = useRef<Group>(null),
    model = useRef<Group>(null),
    beforeModel = useRef<Group>(null),
    afterModel = useRef<Group>(null);
  const bornAt = useRef(performance.now());
  const jetBlend = useRef(piece.promoted ? 1 : 0);
  useEffect(() => {
    if (intro) bornAt.current = performance.now();
  }, [intro]);
  const moving = !!motion && !victim && motion.action.piece.id === piece.id;
  const [w, h] = dimensions(moving && motion?.before ? motion.before : piece);
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
        const pose = sampleMotion(motion, t, performance.now());
        position = pose.position;
        scale = pose.scale;
        yaw = pose.yaw;
        promoted = pose.promoted;
        if (piece.kind === 'penguin') jetBlend.current = pose.jetBlend ?? Number(pose.promoted);
      }
    }
    if (intro && !motion && !reduced) {
      const t = Math.min(1, (performance.now() - bornAt.current) / 420);
      const ease = 1 - Math.pow(1 - t, 3);
      position[1] += (1 - ease) * 0.7;
      scale *= 0.75 + 0.25 * ease;
    }
    root.current.position.set(...position);
    root.current.scale.setScalar(Math.max(0.001, scale));
    root.current.visible = scale > 0.005;
    model.current.rotation.y = yaw;
    if (piece.kind === 'penguin' && !moving) jetBlend.current = Number(piece.promoted);
    const dynamics =
      moving && motion ? bodyDynamics(motion, progress(motion, performance.now())) : null;
    model.current.rotation.x = dynamics?.pitch ?? 0;
    model.current.rotation.z = dynamics?.roll ?? 0;
    model.current.scale.set(
      modelScale * (dynamics?.stretch[0] ?? 1),
      modelScale * (dynamics?.stretch[1] ?? 1),
      modelScale * (dynamics?.stretch[2] ?? 1),
    );
    if (beforeModel.current)
      beforeModel.current.visible =
        piece.kind === 'penguin' ||
        !moving ||
        promoted === (motion?.before?.promoted ?? piece.promoted);
    if (afterModel.current)
      afterModel.current.visible = !!moving && promoted !== motion?.before?.promoted;
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
      <mesh position={[0, 0.17, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <planeGeometry args={[w - 0.02, h - 0.02]} />
        <meshBasicMaterial transparent opacity={0} colorWrite={false} depthWrite={false} />
      </mesh>
      <group
        ref={model}
        position={[0, 0.16, 0]}
        rotation={[0, facing(piece), 0]}
        scale={modelScale}
      >
        <group ref={beforeModel}>
          <Animal
            kind={piece.kind}
            promoted={initialPromoted}
            owner={piece.owner}
            jetBlend={jetBlend}
            animate={selected && !disabled && !reduced}
          />
        </group>
        {moving && motion?.before && piece.kind !== 'penguin' && (
          <group ref={afterModel} visible={false}>
            <Animal kind={piece.kind} promoted={!initialPromoted} owner={piece.owner} />
          </group>
        )}
      </group>
      <FootprintOutline
        width={w}
        height={h}
        color={color}
        active={(selected || targeted || source) && !moving}
        reduced={reduced}
      />
      <Html position={[w / 2 - 0.14, 1.5, 0]} center portal={htmlPortal} zIndexRange={[25, 20]}>
        <AnimatedPresence show={(kingCapture || threatened) && !disabled && !victim}>
          <button
            className={`threat-badge ${kingCapture ? 'king-capture-badge' : ''}`}
            aria-label={
              kingCapture ? '相手の王を捕食できます。この駒を選択' : 'この駒を捕食できる相手を表示'
            }
            onClick={(e) => {
              e.stopPropagation();
              onThreat();
            }}
          >
            {kingCapture ? <Crown size={18} strokeWidth={2.7} /> : '!'}
          </button>
        </AnimatedPresence>
      </Html>
    </group>
  );
}

function FootprintOutline({
  width,
  height,
  color,
  active,
  reduced,
}: {
  width: number;
  height: number;
  color: string;
  active: boolean;
  reduced: boolean;
}) {
  const [material] = useState(
    () => new MeshBasicMaterial({ color, transparent: true, opacity: 0, depthWrite: false }),
  );
  const tint = useRef(new Color(color));
  const root = useRef<Group>(null);
  useEffect(() => () => material.dispose(), [material]);
  useFrame((_, delta) => {
    const blend = reduced ? 1 : 1 - Math.exp(-delta * 16);
    material.opacity += (Number(active) * 0.8 - material.opacity) * blend;
    tint.current.set(color);
    material.color.lerp(tint.current, blend);
    if (root.current) root.current.visible = material.opacity > 0.002;
  });
  return (
    <group ref={root} position={[0, 0.175, 0]}>
      {[-1, 1].map((side) => (
        <group key={side}>
          <mesh
            material={material}
            position={[0, 0, side * (height / 2 - 0.045)]}
            rotation={[-Math.PI / 2, 0, 0]}
            raycast={() => null}
          >
            <planeGeometry args={[width - 0.09, 0.025]} />
          </mesh>
          <mesh
            material={material}
            position={[side * (width / 2 - 0.045), 0, 0]}
            rotation={[-Math.PI / 2, 0, 0]}
            raycast={() => null}
          >
            <planeGeometry args={[0.025, height - 0.09]} />
          </mesh>
        </group>
      ))}
    </group>
  );
}
