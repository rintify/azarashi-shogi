import { useEffect, useRef, useState } from 'react';
import { useFrame } from '@react-three/fiber';
import type { Group } from 'three';
import type { Piece } from '../game/types';
import { center, facing } from '../presentation/motion';
import { Animal } from './Animals';

/** Keep the last ghost during its exit and glide between hovered cells without reallocating models. */
export function PlacementGhost({ piece, reduced }: { piece: Piece | null; reduced: boolean }) {
  const [shown, setShown] = useState(piece);
  const root = useRef<Group>(null);
  const amount = useRef(0);
  useEffect(() => {
    if (piece) setShown(piece);
  }, [piece]);
  useFrame((_, delta) => {
    if (!root.current || !shown) return;
    const blend = reduced ? 1 : 1 - Math.exp(-delta * 22);
    amount.current += (Number(!!piece) - amount.current) * blend;
    root.current.visible = amount.current > 0.005;
    root.current.scale.setScalar(Math.max(0.001, amount.current) * 0.82);
    const destination = center(shown);
    root.current.position.x += (destination[0] - root.current.position.x) * blend;
    root.current.position.z += (destination[2] - root.current.position.z) * blend;
    root.current.position.y = 0.16 + (1 - amount.current) * 0.35;
  });
  if (!shown) return null;
  return (
    <group ref={root} position={center(shown)} rotation={[0, facing(shown), 0]} visible={false}>
      <Animal kind={shown.kind} owner={shown.owner} />
    </group>
  );
}
