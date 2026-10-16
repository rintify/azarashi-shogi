import type { Vec3 } from '../presentation/motion';

export const JET_EQUIPMENT_COLOR = '#5babb4';

/** Jet anatomy is authored prone, with head and beak along local +Z, just like every animal. */
export const JET_POSE: {
  body: Vec3;
  bodyScale: Vec3;
  head: Vec3;
  beak: Vec3;
  eyes: { y: number; z: number };
} = {
  body: [0, 0.23, -0.08],
  bodyScale: [0.27, 0.21, 0.43],
  head: [0, 0.29, 0.33],
  beak: [0, 0.25, 0.57],
  eyes: { y: 0.36, z: 0.493 },
};
