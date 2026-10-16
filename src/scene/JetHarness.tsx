import { ExtrudeGeometry, Shape } from 'three';

// Broad shoulder braces wrap from the upper pack mount to a cradle below the
// chest. A defined side profile keeps their width visible from the game camera.
const shoulder = new Shape();
shoulder.moveTo(0.1, -0.09);
shoulder.lineTo(0.28, -0.18);
shoulder.quadraticCurveTo(0.35, -0.25, 0.34, -0.37);
shoulder.lineTo(0.3, -0.49);
shoulder.lineTo(0.17, -0.6);
shoulder.lineTo(0.04, -0.54);
shoulder.lineTo(0.17, -0.43);
shoulder.lineTo(0.2, -0.32);
shoulder.quadraticCurveTo(0.22, -0.25, 0.16, -0.23);
shoulder.lineTo(-0.01, -0.16);
shoulder.closePath();
const brace = new ExtrudeGeometry(shoulder, {
  depth: 0.035,
  bevelEnabled: true,
  bevelThickness: 0.009,
  bevelSize: 0.009,
  bevelSegments: 2,
  curveSegments: 12,
});

/** A sturdy light-blue chest cradle supports the wide backpack on both sides. */
export function JetHarness() {
  return (
    <group>
      {[-1, 1].map((side) => (
        <group key={side}>
          <mesh
            geometry={brace}
            position={[side * 0.285, 0, 0]}
            rotation={[0, -Math.PI / 2, 0]}
            scale={[1, 1, side]}
            castShadow
            dispose={null}
          >
            <meshStandardMaterial color="#91d1e9" roughness={0.6} />
          </mesh>
          <mesh position={[side * 0.292, -0.39, 0.265]} castShadow>
            <boxGeometry args={[0.028, 0.1, 0.09]} />
            <meshStandardMaterial color="#d5f1fb" metalness={0.2} roughness={0.45} />
          </mesh>
          <mesh position={[side * 0.31, -0.39, 0.265]}>
            <boxGeometry args={[0.012, 0.048, 0.046]} />
            <meshStandardMaterial color="#62accb" roughness={0.55} />
          </mesh>
          <mesh position={[side * 0.17, -0.14, -0.07]} castShadow>
            <boxGeometry args={[0.085, 0.1, 0.27]} />
            <meshStandardMaterial color="#91d1e9" roughness={0.6} />
          </mesh>
        </group>
      ))}
      <mesh position={[0, -0.565, 0.11]} rotation={[-0.25, 0, 0]} castShadow>
        <boxGeometry args={[0.49, 0.045, 0.13]} />
        <meshStandardMaterial color="#91d1e9" roughness={0.6} />
      </mesh>
    </group>
  );
}
