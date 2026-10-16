import { ExtrudeGeometry, LatheGeometry, Shape, SphereGeometry, Vector2 } from 'three';

const body = new LatheGeometry(
  [
    [-0.86, 0],
    [-0.8, 0.065],
    [-0.63, 0.11],
    [-0.4, 0.22],
    [-0.12, 0.31],
    [0.18, 0.35],
    [0.43, 0.33],
    [0.63, 0.26],
    [0.76, 0.14],
    [0.8, 0],
  ].map(([z, radius]) => new Vector2(radius, z)),
  32,
);
const sphere = new SphereGeometry(1, 20, 14);
const finShape = new Shape();
finShape.moveTo(-0.3, 0);
finShape.lineTo(0.16, 0);
finShape.bezierCurveTo(0.12, 0.24, -0.02, 0.52, -0.17, 0.64);
finShape.bezierCurveTo(-0.26, 0.7, -0.28, 0.64, -0.25, 0.56);
finShape.bezierCurveTo(-0.22, 0.35, -0.32, 0.14, -0.3, 0);
const flipperShape = new Shape();
flipperShape.moveTo(0, 0.1);
flipperShape.bezierCurveTo(0.22, 0.09, 0.39, -0.12, 0.4, -0.27);
flipperShape.bezierCurveTo(0.38, -0.39, 0.16, -0.24, 0, -0.1);
flipperShape.closePath();
const tailShape = new Shape();
tailShape.moveTo(0, 0.12);
tailShape.bezierCurveTo(0.15, 0.1, 0.3, 0.02, 0.43, -0.15);
tailShape.bezierCurveTo(0.45, -0.24, 0.16, -0.19, 0, -0.06);
tailShape.bezierCurveTo(-0.16, -0.19, -0.45, -0.24, -0.43, -0.15);
tailShape.bezierCurveTo(-0.3, 0.02, -0.15, 0.1, 0, 0.12);
const extrude = (shape: Shape, depth: number) =>
  new ExtrudeGeometry(shape, {
    depth,
    bevelEnabled: true,
    bevelThickness: 0.018,
    bevelSize: 0.018,
    bevelSegments: 3,
    steps: 1,
    curveSegments: 16,
  });
const dorsal = extrude(finShape, 0.035);
const flipper = extrude(flipperShape, 0.025);
const tail = extrude(tailShape, 0.025);
const coat = '#242f39';
function Oval({
  at,
  scale,
  color,
}: {
  at: [number, number, number];
  scale: [number, number, number];
  color: string;
}) {
  return (
    <mesh geometry={sphere} position={at} scale={scale} dispose={null} castShadow>
      <meshPhysicalMaterial
        color={color}
        roughness={0.43}
        clearcoat={0.18}
        clearcoatRoughness={0.5}
      />
    </mesh>
  );
}

/** One tapered body and swept fins keep the orca recognizable from either board view. */
export function OrcaModel() {
  return (
    <group>
      <mesh
        geometry={body}
        position={[0, 0.46, 0]}
        rotation={[Math.PI / 2, 0, 0]}
        scale={[0.96, 1, 0.88]}
        castShadow
        receiveShadow
        dispose={null}
      >
        <meshPhysicalMaterial
          color={coat}
          roughness={0.42}
          clearcoat={0.2}
          clearcoatRoughness={0.5}
        />
      </mesh>
      <Oval at={[0, 0.285, 0.3]} scale={[0.255, 0.135, 0.46]} color="#f7f5e9" />
      <mesh
        geometry={dorsal}
        position={[-0.0175, 0.71, -0.15]}
        rotation={[0, -Math.PI / 2, 0]}
        castShadow
        dispose={null}
      >
        <meshStandardMaterial color={coat} roughness={0.48} />
      </mesh>
      <mesh
        geometry={tail}
        position={[0, 0.32, -0.8]}
        rotation={[Math.PI / 2, 0, 0]}
        castShadow
        dispose={null}
      >
        <meshStandardMaterial color={coat} roughness={0.48} />
      </mesh>
      {[-1, 1].map((side) => (
        <group key={side}>
          <mesh
            geometry={flipper}
            position={[side * 0.25, 0.29, 0.12]}
            rotation={[Math.PI / 2, 0, 0]}
            scale={[side * 0.62, 1, 1]}
            castShadow
            dispose={null}
          >
            <meshStandardMaterial color={coat} roughness={0.48} />
          </mesh>
          <Oval at={[side * 0.309, 0.55, 0.35]} scale={[0.035, 0.075, 0.145]} color="#faf8ee" />
          <Oval at={[side * 0.252, 0.5, 0.61]} scale={[0.034, 0.04, 0.035]} color="#10212d" />
          <Oval at={[side * 0.268, 0.514, 0.63]} scale={[0.009, 0.011, 0.009]} color="#ffffff" />
        </group>
      ))}
    </group>
  );
}
