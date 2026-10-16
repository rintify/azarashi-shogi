import { DoubleSide, ExtrudeGeometry, Shape } from 'three';
import { JetHarness } from './JetHarness';

// A clipped-corner housing keeps the mechanical silhouette legible at board scale.
const housing = new Shape();
housing.moveTo(-0.09, -0.1);
housing.lineTo(0.09, -0.1);
housing.lineTo(0.125, -0.065);
housing.lineTo(0.125, 0.065);
housing.lineTo(0.09, 0.1);
housing.lineTo(-0.09, 0.1);
housing.lineTo(-0.125, 0.065);
housing.lineTo(-0.125, -0.065);
housing.closePath();
const geometry = new ExtrudeGeometry(housing, {
  depth: 0.36,
  bevelEnabled: true,
  bevelSize: 0.009,
  bevelThickness: 0.009,
  bevelSegments: 1,
});

/** Compact jet pack: angular casing, cooling vents, mounting rails and a recessed nozzle. */
export function JetEngine() {
  return (
    <group>
      <JetHarness />
      <group scale={[1.85, 1, 1]}>
        <mesh geometry={geometry} position={[0, 0, -0.18]} castShadow dispose={null}>
          <meshStandardMaterial color="#5babb4" roughness={0.48} metalness={0.28} flatShading />
        </mesh>
        <mesh position={[0, 0.108, 0]} castShadow>
          <boxGeometry args={[0.11, 0.022, 0.26]} />
          <meshStandardMaterial color="#e0ebe7" metalness={0.3} roughness={0.45} />
        </mesh>
        {[-1, 1].map((side) => (
          <group key={side}>
            <mesh position={[side * 0.105, -0.11, 0]} castShadow>
              <boxGeometry args={[0.055, 0.045, 0.29]} />
              <meshStandardMaterial color="#34434e" roughness={0.65} />
            </mesh>
            {[-1, 0, 1].map((i) => (
              <mesh key={i} position={[side * 0.129, 0, i * 0.065]}>
                <boxGeometry args={[0.008, 0.09, 0.022]} />
                <meshStandardMaterial color="#243c49" roughness={0.7} />
              </mesh>
            ))}
          </group>
        ))}
        <group position={[0, 0, -0.24]} rotation={[Math.PI / 2, 0, 0]}>
          <mesh castShadow>
            <cylinderGeometry args={[0.095, 0.08, 0.13, 8, 1, true]} />
            <meshStandardMaterial
              color="#526371"
              metalness={0.65}
              roughness={0.4}
              side={DoubleSide}
              flatShading
            />
          </mesh>
          <mesh position={[0, -0.065, 0]} rotation={[Math.PI / 2, 0, 0]}>
            <ringGeometry args={[0.067, 0.095, 8]} />
            <meshStandardMaterial color="#b9c8ce" metalness={0.65} roughness={0.32} />
          </mesh>
          <mesh position={[0, -0.04, 0]} rotation={[Math.PI / 2, 0, 0]}>
            <circleGeometry args={[0.066, 12]} />
            <meshStandardMaterial color="#78e6ff" emissive="#3eafdf" emissiveIntensity={0.8} />
          </mesh>
        </group>
        <mesh position={[0, 0.025, 0.19]}>
          <boxGeometry args={[0.14, 0.045, 0.018]} />
          <meshStandardMaterial color="#f1ca77" metalness={0.35} roughness={0.5} />
        </mesh>
      </group>
    </group>
  );
}
