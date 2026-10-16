import { CatmullRomCurve3, ExtrudeGeometry, Shape, Vector3 } from 'three';

const strapSection = new Shape();
strapSection.moveTo(-0.038, -0.012);
strapSection.lineTo(0.038, -0.012);
strapSection.lineTo(0.038, 0.012);
strapSection.lineTo(-0.038, 0.012);
strapSection.closePath();

// Each shoulder strap leaves the pack, wraps around a flipper, and returns to
// the lower mounting point. The belly stays open, like a pair of backpack straps.
const straps = [-1, 1].map((side) => {
  const path = new CatmullRomCurve3([
    new Vector3(side * 0.1, -0.1, 0.14),
    new Vector3(side * 0.22, -0.21, 0.28),
    new Vector3(side * 0.275, -0.37, 0.27),
    new Vector3(side * 0.24, -0.51, 0.14),
    new Vector3(side * 0.19, -0.49, -0.09),
    new Vector3(side * 0.105, -0.13, -0.15),
  ]);
  return {
    side,
    geometry: new ExtrudeGeometry(strapSection, {
      extrudePath: path,
      steps: 48,
      bevelEnabled: false,
    }),
  };
});

/** Two light-blue shoulder loops fasten the jet pack without a torso belt. */
export function JetHarness() {
  return (
    <group>
      {straps.map(({ side, geometry }) => (
        <group key={side}>
          <mesh geometry={geometry} castShadow dispose={null}>
            <meshStandardMaterial color="#8dcfe8" roughness={0.72} />
          </mesh>
          <mesh position={[side * 0.278, -0.37, 0.27]} castShadow>
            <boxGeometry args={[0.024, 0.075, 0.075]} />
            <meshStandardMaterial color="#d6f2fc" metalness={0.15} roughness={0.5} />
          </mesh>
          <mesh position={[side * 0.293, -0.37, 0.27]}>
            <boxGeometry args={[0.008, 0.032, 0.035]} />
            <meshStandardMaterial color="#68b4d5" roughness={0.65} />
          </mesh>
        </group>
      ))}
    </group>
  );
}
