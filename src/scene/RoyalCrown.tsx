import { BufferGeometry, Float32BufferAttribute } from 'three';

const POINTS = 8;
const RADIUS = 0.265;
// A closed, hollow gold band with a continuous scalloped rim and eight raised tips.
function crownGeometry() {
  const positions: number[] = [];
  const indices: number[] = [];
  const segments = 128;
  for (let i = 0; i <= segments; i++) {
    const angle = (i / segments) * Math.PI * 2;
    const tip = Math.pow((1 + Math.cos(angle * POINTS)) / 2, 3);
    const height = 0.1 + tip * 0.15;
    for (const [radius, y] of [
      [RADIUS - 0.035, 0],
      [RADIUS, 0],
      [RADIUS + 0.025, height],
      [RADIUS - 0.01, height],
    ])
      positions.push(Math.sin(angle) * radius, y, Math.cos(angle) * radius);
    if (i === segments) continue;
    for (let side = 0; side < 4; side++) {
      const a = i * 4 + side,
        b = i * 4 + ((side + 1) % 4);
      indices.push(a, b + 4, b, a, a + 4, b + 4);
    }
  }
  const geometry = new BufferGeometry();
  geometry.setAttribute('position', new Float32BufferAttribute(positions, 3));
  geometry.setIndex(indices);
  geometry.computeVertexNormals();
  return geometry;
}
const band = crownGeometry();

/** Shared by the board and the rotating animal catalog. Local +Z is the face. */
export function RoyalCrown() {
  return (
    <group position={[0, 1.055, 0.3]} rotation={[0, Math.PI / 8, -0.06]}>
      <mesh geometry={band} dispose={null} castShadow>
        <meshStandardMaterial color="#edb94f" metalness={0.65} roughness={0.28} />
      </mesh>
      <mesh position={[0, 0.025, 0]} rotation={[Math.PI / 2, 0, 0]} castShadow>
        <torusGeometry args={[RADIUS - 0.014, 0.024, 8, 64]} />
        <meshStandardMaterial color="#ffe4a2" metalness={0.55} roughness={0.3} />
      </mesh>
      {Array.from({ length: POINTS }, (_, i) => {
        const angle = (i / POINTS) * Math.PI * 2;
        return (
          <group key={i} rotation={[0, angle, 0]}>
            <mesh position={[0, 0.25, RADIUS + 0.007]} castShadow>
              <sphereGeometry args={[0.033, 12, 8]} />
              <meshStandardMaterial color="#ffe4a2" metalness={0.55} roughness={0.27} />
            </mesh>
            <mesh position={[0, 0.09, RADIUS + 0.012]} scale={[0.036, 0.049, 0.019]}>
              <octahedronGeometry args={[1]} />
              <meshStandardMaterial
                color={i % 2 === 0 ? '#49c6ce' : '#f0958b'}
                metalness={0.25}
                roughness={0.2}
              />
            </mesh>
          </group>
        );
      })}
    </group>
  );
}
