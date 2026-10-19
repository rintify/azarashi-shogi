/** Rendering-only wire contract. Rules, input, match ownership and AI stay in React/Rust. */
export const RENDER_PROTOCOL = 1;
export interface MeshResource {
  id: string;
  positions: number[];
  normals: number[];
  uv: number[];
  indices: number[];
  groups: { start: number; count: number; materialIndex: number }[];
}
export interface MaterialResource {
  id: string;
  shader: 'lit' | 'unlit' | 'ocean';
  color: number[];
  emissive: number[];
  opacity: number;
  roughness: number;
  metalness: number;
  clearcoat: number;
  transparent: boolean;
  additive: boolean;
  depthTest: boolean;
  depthWrite: boolean;
  side: number;
  texture: string;
}
export interface RenderNode {
  id: string;
  mesh: string;
  materials: string[];
  matrix: number[];
  visible: boolean;
  castShadow: boolean;
  receiveShadow: boolean;
  order: number;
}
export interface RenderFrame {
  protocol: number;
  meshes: MeshResource[];
  materials: MaterialResource[];
  nodes: RenderNode[];
  removedNodes: string[];
  removedMeshes: string[];
  removedMaterials: string[];
  camera: { world: number[]; projection: number[]; near: number; far: number };
  background: number[];
}
