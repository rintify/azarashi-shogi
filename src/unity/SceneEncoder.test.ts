import { describe, expect, it } from 'vitest';
import {
  BoxGeometry,
  Color,
  CubeTexture,
  Group,
  Mesh,
  MeshBasicMaterial,
  MeshStandardMaterial,
  PerspectiveCamera,
  PlaneGeometry,
  Scene,
  ShaderMaterial,
  Sprite,
  SpriteMaterial,
  Vector3,
} from 'three';
import { SceneEncoder } from './SceneEncoder';

function fixture() {
  const scene = new Scene();
  const camera = new PerspectiveCamera(38, 1.5, 0.1, 160);
  camera.position.set(0, 20, 10);
  camera.lookAt(0, 0, 0);
  const material = new MeshStandardMaterial({ color: '#4e4b49', roughness: 0.68 });
  const geometry = new BoxGeometry();
  const piece = new Mesh(geometry, material);
  scene.add(piece);
  return { scene, camera, piece, material, geometry, encoder: new SceneEncoder() };
}

describe('React scene → Unity rendering contract', () => {
  it('sends assets once and transmits only changed transforms/materials afterward', () => {
    const { scene, camera, piece, material, encoder } = fixture();
    const initial = encoder.encode(scene, camera);
    expect(initial.meshes).toHaveLength(1);
    expect(initial.materials).toHaveLength(1);
    expect(initial.nodes).toHaveLength(1);
    const unchanged = encoder.encode(scene, camera);
    expect(unchanged.meshes).toEqual([]);
    expect(unchanged.materials).toEqual([]);
    expect(unchanged.nodes).toEqual([]);
    piece.position.set(2, 1.45, -3);
    material.opacity = 0.35;
    const moved = encoder.encode(scene, camera);
    expect(moved.meshes).toEqual([]);
    expect(moved.materials[0].opacity).toBe(0.35);
    expect(moved.nodes[0].matrix.slice(12, 15)).toEqual([2, 1.45, -3]);
  });

  it('keeps shared resources until their last user leaves, then releases them', () => {
    const { scene, camera, piece, geometry, material, encoder } = fixture();
    const sibling = new Mesh(geometry, material);
    scene.add(sibling);
    encoder.encode(scene, camera);
    scene.remove(piece);
    const first = encoder.encode(scene, camera);
    expect(first.removedNodes).toEqual([piece.uuid]);
    expect(first.removedMeshes).toEqual([]);
    scene.remove(sibling);
    const last = encoder.encode(scene, camera);
    expect(last.removedMeshes).toEqual([geometry.uuid]);
    expect(last.removedMaterials).toEqual([material.uuid]);
  });

  it('propagates ancestor visibility without losing hidden transformation models', () => {
    const { scene, camera, piece, encoder } = fixture();
    const group = new Group();
    scene.add(group);
    group.add(piece);
    encoder.encode(scene, camera);
    group.visible = false;
    const hidden = encoder.encode(scene, camera);
    expect(hidden.nodes[0].visible).toBe(false);
    expect(hidden.removedMeshes).toEqual([]);
    group.visible = true;
    expect(encoder.encode(scene, camera).nodes[0].visible).toBe(true);
  });

  it('preserves exact camera projection and world transforms for input and labels', () => {
    const { scene, camera, piece, encoder } = fixture();
    camera.setViewOffset(400, 500, -15, -80, 430, 800);
    const parent = new Group();
    parent.scale.set(1, 0.8, 1.2);
    parent.rotation.y = 1.2;
    scene.add(parent);
    parent.add(piece);
    piece.rotation.z = 0.3;
    const frame = encoder.encode(scene, camera);
    expect(frame.camera.world).toEqual(camera.matrixWorld.elements);
    expect(frame.camera.projection).toEqual(camera.projectionMatrix.elements);
    expect(frame.nodes[0].matrix).toEqual(piece.matrixWorld.elements);
  });

  it('keeps picking planes out of the Unity render list', () => {
    const { scene, camera, encoder } = fixture();
    scene.add(new Mesh(new PlaneGeometry(), new MeshBasicMaterial({ colorWrite: false })));
    expect(encoder.encode(scene, camera).nodes).toHaveLength(1);
  });

  it('billboards capture orbs toward the camera without changing the source sprite', () => {
    const { scene, camera, encoder } = fixture();
    const orb = new Sprite(new SpriteMaterial({ transparent: true, depthTest: false }));
    orb.position.set(2, 1, -1);
    orb.scale.setScalar(0.3);
    scene.add(orb);
    const original = orb.quaternion.clone();
    const frame = encoder.encode(scene, camera);
    const node = frame.nodes.find((n) => n.id === orb.uuid)!;
    expect(node.matrix.slice(12, 15)).toEqual([2, 1, -1]);
    expect(orb.quaternion.equals(original)).toBe(true);
    const normal = new Vector3(node.matrix[8], node.matrix[9], node.matrix[10]).normalize();
    const facing = new Vector3(0, 0, 1).applyQuaternion(camera.quaternion);
    expect(normal.dot(facing)).toBeCloseTo(1);
  });

  it('ports the existing ocean palette and soft matte seal parameters', () => {
    const { scene, camera, material, encoder } = fixture();
    const ocean = new ShaderMaterial({
      uniforms: { deep: { value: new Color('#075877') }, light: { value: new Color('#168daf') } },
    });
    scene.add(new Mesh(new PlaneGeometry(), ocean));
    const frame = encoder.encode(scene, camera);
    expect(frame.materials.find((m) => m.id === material.uuid)?.roughness).toBe(0.68);
    expect(frame.materials.find((m) => m.id === ocean.uuid)?.shader).toBe('ocean');
  });

  it('distinguishes scene environment lighting from an explicit material environment map', () => {
    const { scene, camera, material, encoder } = fixture();
    material.envMapIntensity = 0.2;
    let exported = encoder.encode(scene, camera).materials.find((m) => m.id === material.uuid)!;
    expect(exported.useSceneEnvironment).toBe(true);
    expect(exported.envMapIntensity).toBe(0.2);
    material.envMap = new CubeTexture();
    exported = encoder.encode(scene, camera).materials.find((m) => m.id === material.uuid)!;
    expect(exported.useSceneEnvironment).toBe(false);
    expect(exported.envMapIntensity).toBe(0.2);
  });
});
