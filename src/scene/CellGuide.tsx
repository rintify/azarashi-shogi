import { useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import {
  CircleGeometry,
  Color,
  PlaneGeometry,
  RingGeometry,
  type Mesh,
  type MeshBasicMaterial,
} from 'three';

const fillGeometry = new PlaneGeometry(0.98, 0.98);
const dotGeometry = new CircleGeometry(0.105, 32);
const outlineGeometry = new RingGeometry(0.43, 0.46, 4, 1, Math.PI / 4);
const safeColor = new Color('#087b9f'),
  dangerColor = new Color('#d8782c');
const activeColor = new Color('#098bba'),
  lastColor = new Color('#6fa9be');

/** Guides remain mounted: opacity, size and danger color ease between consecutive states. */
export function CellGuide({
  active,
  additional,
  reachable,
  last,
  legal,
  unsafe,
  reduced,
}: {
  active: boolean;
  additional: boolean;
  reachable: boolean;
  last: boolean;
  legal: boolean;
  unsafe: boolean;
  reduced: boolean;
}) {
  const fill = useRef<Mesh>(null),
    dot = useRef<Mesh>(null),
    outline = useRef<Mesh>(null);
  useFrame((_, delta) => {
    const blend = reduced ? 1 : 1 - Math.exp(-delta * 18);
    const fade = (mesh: Mesh | null, target: number) => {
      if (!mesh) return;
      const material = mesh.material as MeshBasicMaterial;
      material.opacity += (target - material.opacity) * blend;
      mesh.visible = material.opacity > 0.002;
    };
    fade(fill.current, active || additional ? 0.36 : reachable ? 0.2 : last ? 0.1 : 0);
    fade(dot.current, legal ? 0.8 : 0);
    fade(outline.current, active || additional ? 0.9 : last ? 0.45 : 0);
    if (dot.current) {
      const material = dot.current.material as MeshBasicMaterial;
      material.color.lerp(unsafe ? dangerColor : safeColor, blend);
      dot.current.scale.setScalar(0.7 + (0.3 * material.opacity) / 0.8);
    }
    if (outline.current)
      (outline.current.material as MeshBasicMaterial).color.lerp(
        active || additional ? activeColor : lastColor,
        blend,
      );
  });
  return (
    <>
      <mesh
        ref={fill}
        geometry={fillGeometry}
        dispose={null}
        visible={false}
        position={[0, 0.005, 0]}
        rotation={[-Math.PI / 2, 0, 0]}
        raycast={() => null}
      >
        <meshBasicMaterial color="#42b9d8" transparent opacity={0} depthWrite={false} />
      </mesh>
      <mesh
        ref={dot}
        geometry={dotGeometry}
        dispose={null}
        visible={false}
        position={[0, 0.008, 0]}
        rotation={[-Math.PI / 2, 0, 0]}
        raycast={() => null}
      >
        <meshBasicMaterial
          color={unsafe ? '#d8782c' : '#087b9f'}
          transparent
          opacity={0}
          depthWrite={false}
        />
      </mesh>
      <mesh
        ref={outline}
        geometry={outlineGeometry}
        dispose={null}
        visible={false}
        position={[0, 0.009, 0]}
        rotation={[-Math.PI / 2, 0, 0]}
        raycast={() => null}
      >
        <meshBasicMaterial color="#098bba" transparent opacity={0} depthWrite={false} />
      </mesh>
    </>
  );
}
