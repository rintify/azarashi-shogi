import { useMemo, useRef } from 'react';
import { GUIDE_COLORS, guideStyle, type GuideState } from '../presentation/guideStyle';
import { useFrame } from '@react-three/fiber';
import {
  CircleGeometry,
  Color,
  PlaneGeometry,
  RingGeometry,
  Shape,
  ShapeGeometry,
  type Mesh,
  type MeshBasicMaterial,
} from 'three';

const fillGeometry = new PlaneGeometry(0.98, 0.98);
const dotGeometry = new CircleGeometry(0.105, 32);
const outlineGeometry = new RingGeometry(0.63, 0.67, 4, 1, Math.PI / 4);
// The reference symbol is geometry, so it needs no font or remote asset.
const referenceGeometry = new ShapeGeometry([
  ...[-1, 1].map((side) => {
    const shape = new Shape();
    shape.moveTo(-0.055, -side * 0.055 + 0.009);
    shape.lineTo(-0.055, -side * 0.055 - 0.009);
    shape.lineTo(0.055, side * 0.055 - 0.009);
    shape.lineTo(0.055, side * 0.055 + 0.009);
    shape.closePath();
    return shape;
  }),
  ...[
    [0, 0.08],
    [0.08, 0],
    [0, -0.08],
    [-0.08, 0],
  ].map(([x, y]) => {
    const dot = new Shape();
    dot.absarc(x, y, 0.013, 0, Math.PI * 2, false);
    return dot;
  }),
]);
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
    outline = useRef<Mesh>(null),
    note = useRef<Mesh>(null);
  useFrame(({ clock }, delta) => {
    const blend = props.reduced ? 1 : 1 - Math.exp(-delta * 18);
    const fade = (mesh: Mesh | null, target: number) => {
      if (!mesh) return;
      const material = mesh.material as MeshBasicMaterial;
      material.opacity += (target - material.opacity) * blend;
      mesh.visible = material.opacity > 0.002;
    };
    const pulse =
      (props.inspectingEnemy || style.kingDanger || props.kingDanger) && !props.reduced
        ? (props.inspectingEnemy ? 0.75 : 0.65) +
          (props.inspectingEnemy ? 0.25 : 0.35) * Math.sin((clock.elapsedTime * Math.PI * 2) / 2.8)
        : 1;
    fade(fill.current, style.fillOpacity * (props.inspectingEnemy || style.kingDanger ? pulse : 1));
    fade(dot.current, style.dotOpacity * (props.kingDanger ? pulse : 1));
    fade(outline.current, style.outlineOpacity);
    fade(note.current, style.transformationSafe ? style.dotOpacity : 0);
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
      {style.transformationSafe && (
        <mesh
          ref={note}
          renderOrder={21}
          scale={1.25}
          geometry={referenceGeometry}
          dispose={null}
          position={[0.25, 0.01, 0]}
          rotation={[-Math.PI / 2, 0, 0]}
          raycast={() => null}
        >
          <meshBasicMaterial
            color={GUIDE_COLORS.safe}
            depthTest={false}
            transparent
            opacity={0}
            depthWrite={false}
            toneMapped={false}
          />
        </mesh>
      )}
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
        renderOrder={style.transformationSafe ? 20 : 0}
        geometry={dotGeometry}
        dispose={null}
        visible={false}
        position={[0, 0.008, 0]}
        rotation={[-Math.PI / 2, 0, 0]}
        raycast={() => null}
      >
        <meshBasicMaterial
          color={style.dot}
          depthTest={!style.transformationSafe}
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
