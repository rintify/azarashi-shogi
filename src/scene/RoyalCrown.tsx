import { BufferGeometry, Float32BufferAttribute } from 'three';

const POINTS = 5;
const RADIUS = 0.265;
// Broad rounded lobes and a thick band fill the existing silhouette like a toy crown.
function crownGeometry() {
  const positions: number[] = [];
  const indices: number[] = [];
  const segments = 128;
  for (let i = 0; i <= segments; i++) {
    const angle = (i / segments) * Math.PI * 2;
    const tip = (1 + Math.cos(angle * POINTS)) / 2;
    const height = 0.17 + tip * 0.08;
    for (const [radius, y] of [
      [RADIUS - 0.095, 0],
      [RADIUS, 0],
      [RADIUS + 0.025, height],
      [RADIUS - 0.065, height],
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
    <group position={[0, 1.09, 0.3]} rotation={[0, 0, -0.06]} scale={0.6}>
      <mesh geometry={band} dispose={null} castShadow>
        <meshStandardMaterial color="#f5c354" metalness={0.05} roughness={0.55} />
      </mesh>
      <mesh position={[0, 0.025, 0]} rotation={[Math.PI / 2, 0, 0]} castShadow>
        <torusGeometry args={[RADIUS - 0.014, 0.024, 8, 64]} />
        <meshStandardMaterial color="#f5c354" metalness={0.05} roughness={0.55} />
      </mesh>
      {Array.from({ length: POINTS }, (_, i) => {
        const angle = (i / POINTS) * Math.PI * 2;
        return (
          <group key={i} rotation={[0, angle, 0]}>
            <mesh position={[0, 0.25, RADIUS + 0.007]} castShadow>
              <sphereGeometry args={[0.033, 12, 8]} />
              <meshStandardMaterial color="#f5c354" metalness={0.05} roughness={0.55} />
            </mesh>
          </group>
        );
      })}
    </group>
  );
}
