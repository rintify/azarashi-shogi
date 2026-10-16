import { useMemo, useRef } from 'react';
import { GUIDE_COLORS, guideStyle, type GuideState } from '../presentation/guideStyle';
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
const outlineGeometry = new RingGeometry(0.63, 0.67, 4, 1, Math.PI / 4);
/** Guides remain mounted: opacity, size and danger color ease between consecutive states. */
export function CellGuide(props: GuideState & { reduced: boolean }) {
  const style = guideStyle(props);
  const colors = useMemo(
    () => ({
      fill: new Color(style.fill),
      dot: new Color(style.dot),
      outline: new Color(style.outline),
    }),
    [style.fill, style.dot, style.outline],
  );
  const fill = useRef<Mesh>(null),
    dot = useRef<Mesh>(null),
    outline = useRef<Mesh>(null);
  useFrame(({ clock }, delta) => {
    const blend = props.reduced ? 1 : 1 - Math.exp(-delta * 18);
    const fade = (mesh: Mesh | null, target: number) => {
      if (!mesh) return;
      const material = mesh.material as MeshBasicMaterial;
      material.opacity += (target - material.opacity) * blend;
      mesh.visible = material.opacity > 0.002;
    };
    const pulse =
      props.inspectingEnemy && !props.reduced
        ? 0.75 + 0.25 * Math.sin((clock.elapsedTime * Math.PI * 2) / 2.8)
        : 1;
    fade(fill.current, style.fillOpacity * pulse);
    fade(dot.current, style.dotOpacity);
    fade(outline.current, style.outlineOpacity);
    if (dot.current) {
      const material = dot.current.material as MeshBasicMaterial;
      material.color.lerp(colors.dot, blend);
      dot.current.scale.setScalar(0.7 + 0.3 * material.opacity);
    }
    if (fill.current) (fill.current.material as MeshBasicMaterial).color.lerp(colors.fill, blend);
    if (outline.current)
      (outline.current.material as MeshBasicMaterial).color.lerp(colors.outline, blend);
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
        <meshBasicMaterial
          color={GUIDE_COLORS.fill}
          transparent
          opacity={0}
          depthWrite={false}
          toneMapped={false}
        />
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
          color={style.dot}
          transparent
          opacity={0}
          depthWrite={false}
          toneMapped={false}
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
        <meshBasicMaterial
          color={GUIDE_COLORS.active}
          transparent
          opacity={0}
          depthWrite={false}
          toneMapped={false}
        />
      </mesh>
    </>
  );
}
