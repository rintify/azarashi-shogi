import { useCallback, useEffect, useRef, type RefObject } from 'react';
import { useFrame } from '@react-three/fiber';
import { Html } from '@react-three/drei';
import { pieceMark, PieceMarkIcon, MARK_LABELS } from '../components/PieceMark';
import { type Group, type Object3D, type Camera } from 'three';
import type { Cell, Piece } from '../game/types';
import { dimensions } from '../game/pieces';
import { AnimatedPresence } from '../components/AnimatedUI';
import { pieceMarkerPosition } from './pieceMarkerPosition';
import { Animal } from './Animals';
import { bodyDynamics } from '../presentation/movement';
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
  threatened: boolean;
  trapped: boolean;
  kingCapture: boolean;
  helper: boolean;
  disabled: boolean;
  reduced: boolean;
  intro: boolean;
  htmlPortal: RefObject<HTMLDivElement>;
  onPiece: (id: string, c: Cell) => void;
  onHover: (c: Cell | null) => void;
}
export function PieceActor({
  piece,
  motion,
  victim = false,
  selected,
  threatened,
  trapped,
  kingCapture,
  helper,
  disabled,
  reduced,
  intro,
  htmlPortal,
  onPiece,
  onHover,
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
  const mark = pieceMark(kingCapture, helper, threatened, trapped);
  const lastMarkerPosition = useRef<[number, number]>([0, 0]);
  const locateMarker = useCallback(
    (object: Object3D, camera: Camera, viewport: { width: number; height: number }) => {
      if (mark && !disabled && !victim)
        lastMarkerPosition.current = pieceMarkerPosition(model.current ?? object, camera, viewport);
      return lastMarkerPosition.current;
    },
    [mark, disabled, victim],
  );
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
    if (piece.kind === 'penguin') {
      const from = motion?.before?.promoted ? 1 : 0;
      jetBlend.current =
        moving && motion
          ? from +
            ((motion.action.piece.promoted ? 1 : 0) - from) *
              transformationProgress(motion, progress(motion, performance.now()))
          : piece.promoted
            ? 1
            : 0;
    }
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
        onPiece(piece.id, {
          x: Math.max(piece.at.x, Math.min(piece.at.x + w - 1, Math.floor(e.point.x + 5))),
          y: Math.max(piece.at.y, Math.min(piece.at.y + h - 1, Math.floor(e.point.z + 5))),
        });
      }}
      onPointerMove={(e) => {
        e.stopPropagation();
        if (!disabled && !victim)
          onHover({
            x: Math.max(piece.at.x, Math.min(piece.at.x + w - 1, Math.floor(e.point.x + 5))),
            y: Math.max(piece.at.y, Math.min(piece.at.y + h - 1, Math.floor(e.point.z + 5))),
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
      <Html
        calculatePosition={locateMarker}
        center
        portal={htmlPortal}
        zIndexRange={[25, 20]}
        style={{ pointerEvents: 'none' }}
      >
        <AnimatedPresence show={!!mark && !disabled && !victim}>
          <span
            className={`threat-badge ${mark === 'king' ? 'king-capture-badge' : mark === 'helper' ? 'helper-badge' : mark === 'trapped' ? 'trapped-badge' : ''}`}
            aria-label={mark ? MARK_LABELS[mark] : undefined}
          >
            {mark && <PieceMarkIcon mark={mark} />}
          </span>
        </AnimatedPresence>
      </Html>
    </group>
  );
}
