import { BufferGeometry, Float32BufferAttribute } from 'three';

const POINTS = 5;
const RADIUS = 0.265;
// Broad flat panels and five crisp peaks keep the small crown readable.
function crownGeometry() {
  const positions: number[] = [];
  const indices: number[] = [];
  const segments = POINTS * 2;
  for (let i = 0; i <= segments; i++) {
    const angle = (i / segments) * Math.PI * 2;
    const height = i % 2 === 0 ? 0.283 : 0.17;
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
        <meshStandardMaterial color="#f5c354" metalness={0.05} roughness={0.55} flatShading />
      </mesh>
    </group>
  );
}
