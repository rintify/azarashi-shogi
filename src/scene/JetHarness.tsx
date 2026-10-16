import { ExtrudeGeometry, Path, Shape } from 'three';
import { JET_EQUIPMENT_COLOR } from './animalPoses';

// Wide fitted bands have a rectangular cross section, rather than reading as cables.
const outline = new Shape();
outline.absellipse(0, 0, 0.313, 0.278, 0, Math.PI * 2, false, 0);
const inside = new Path();
inside.absellipse(0, 0, 0.29, 0.255, 0, Math.PI * 2, true, 0);
outline.holes.push(inside);
const band = new ExtrudeGeometry(outline, {
  depth: 0.065,
  bevelEnabled: true,
  bevelSize: 0.004,
  bevelThickness: 0.004,
  bevelSegments: 1,
  curveSegments: 24,
});

/** Coordinates are relative to the jet pack; two chest bands secure it around the torso. */
export function JetHarness() {
  return (
    <group>
      {[-0.14, 0.12].map((z) => (
        <mesh key={z} geometry={band} position={[0, -0.37, z]} castShadow dispose={null}>
          <meshStandardMaterial color={JET_EQUIPMENT_COLOR} roughness={0.72} />
        </mesh>
      ))}
      {[-1, 1].map((side) => (
        <group key={side}>
          <mesh position={[side * 0.29, -0.28, 0.025]} rotation={[0, 0, side * 0.2]} castShadow>
            <boxGeometry args={[0.03, 0.065, 0.31]} />
            <meshStandardMaterial color={JET_EQUIPMENT_COLOR} roughness={0.72} />
          </mesh>
          <mesh position={[side * 0.317, -0.37, 0.153]} castShadow>
            <boxGeometry args={[0.025, 0.09, 0.085]} />
            <meshStandardMaterial color="#e8b866" metalness={0.4} roughness={0.45} />
          </mesh>
          <mesh position={[side * 0.332, -0.37, 0.153]}>
            <boxGeometry args={[0.009, 0.045, 0.035]} />
            <meshStandardMaterial color={JET_EQUIPMENT_COLOR} roughness={0.7} />
          </mesh>
        </group>
      ))}
    </group>
  );
}
