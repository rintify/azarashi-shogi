import {
  AdditiveBlending,
  BufferGeometry,
  Camera,
  Color,
  Matrix4,
  Mesh,
  MeshBasicMaterial,
  MeshStandardMaterial,
  PlaneGeometry,
  Quaternion,
  Scene,
  ShaderMaterial,
  Sprite,
  Vector3,
  type Material,
  type Texture,
} from 'three';
import {
  RENDER_PROTOCOL,
  type MaterialResource,
  type MeshResource,
  type RenderFrame,
  type RenderNode,
} from './protocol';

const spriteQuad = new PlaneGeometry(1, 1);
const matrix = new Matrix4(),
  position = new Vector3(),
  scale = new Vector3();
const rotation = new Quaternion();
const rgb = (color: Color) => [color.r, color.g, color.b];
const attr = (geometry: BufferGeometry, name: string, size: number) => {
  const attribute = geometry.getAttribute(name);
  if (!attribute) return [];
  const values: number[] = [];
  for (let i = 0; i < attribute.count; i++)
    for (let j = 0; j < size; j++) values.push(attribute.getComponent(i, j));
  return values;
};

function meshResource(geometry: BufferGeometry): MeshResource {
  const positions = attr(geometry, 'position', 3);
  return {
    id: geometry.uuid,
    positions,
    normals: attr(geometry, 'normal', 3),
    uv: attr(geometry, 'uv', 2),
    indices: geometry.index
      ? Array.from(geometry.index.array)
      : Array.from({ length: positions.length / 3 }, (_, i) => i),
    groups: geometry.groups.map((g) => ({ ...g, materialIndex: g.materialIndex ?? 0 })),
  };
}

/** Asset values use Three's linear colors; Unity also renders in linear color space. */
function materialResource(
  material: Material,
  texture: (map: Texture | null) => string,
): MaterialResource {
  const surface = material as MeshStandardMaterial;
  const shader = material as ShaderMaterial;
  const ocean = !!shader.uniforms?.deep && !!shader.uniforms?.light;
  const basic = material as MeshBasicMaterial;
  return {
    id: material.uuid,
    shader: ocean ? 'ocean' : surface.isMeshStandardMaterial ? 'lit' : 'unlit',
    color: rgb(ocean ? shader.uniforms.deep.value : (basic.color ?? new Color('white'))),
    emissive: rgb(
      ocean
        ? shader.uniforms.light.value
        : (surface.emissive ?? new Color('black'))
            .clone()
            .multiplyScalar(surface.emissiveIntensity ?? 1),
    ),
    opacity: material.opacity,
    roughness: surface.roughness ?? 1,
    metalness: surface.metalness ?? 0,
    clearcoat: (material as MeshStandardMaterial & { clearcoat?: number }).clearcoat ?? 0,
    clearcoatRoughness:
      (material as MeshStandardMaterial & { clearcoatRoughness?: number }).clearcoatRoughness ?? 0,
    envMapIntensity: surface.envMapIntensity ?? 1,
    toneMapped: material.toneMapped,
    flatShading: surface.flatShading ?? false,
    transparent: material.transparent,
    additive: material.blending === AdditiveBlending,
    depthTest: material.depthTest,
    depthWrite: material.depthWrite,
    side: material.side,
    texture: texture(basic.map),
    time: ocean ? (shader.uniforms.time?.value ?? 0) : 0,
  };
}

/** Deltas keep static geometry off the per-frame bridge. Only presentation data crosses it. */
export class SceneEncoder {
  private meshes = new Set<string>();
  private materials = new Map<string, string>();
  private nodes = new Map<string, string>();
  private textures = new WeakMap<Texture, { version: number; data: string }>();
  private lines = new WeakMap<BufferGeometry, BufferGeometry>();

  private texture = (map: Texture | null): string => {
    if (!map) return '';
    const cached = this.textures.get(map);
    if (cached?.version === map.version) return cached.data;
    const image = map.image as HTMLCanvasElement | undefined;
    if (!image || typeof image.toDataURL !== 'function') return '';
    const data = image.toDataURL('image/png').split(',')[1];
    this.textures.set(map, { version: map.version, data });
    return data;
  };

  // Drei's Line2 is a screen-space shader mesh. Preserve ice cracks as narrow world-space ribbons.
  private lineGeometry(source: BufferGeometry) {
    let geometry = this.lines.get(source);
    if (geometry) return geometry;
    const starts = source.getAttribute('instanceStart'),
      ends = source.getAttribute('instanceEnd');
    if (!starts || !ends) return source;
    const vertices: number[] = [],
      indices: number[] = [];
    for (let i = 0; i < starts.count; i++) {
      const a = new Vector3().fromBufferAttribute(starts, i),
        b = new Vector3().fromBufferAttribute(ends, i);
      const side = new Vector3(b.z - a.z, 0, a.x - b.x).normalize().multiplyScalar(0.006);
      const offset = vertices.length / 3;
      for (const [point, sign] of [
        [a, -1],
        [a, 1],
        [b, 1],
        [b, -1],
      ] as const)
        vertices.push(point.x + side.x * sign, point.y, point.z + side.z * sign);
      indices.push(offset, offset + 1, offset + 2, offset, offset + 2, offset + 3);
    }
    geometry = new BufferGeometry();
    // Kept here rather than mutating the source: input raycasting keeps using the original graph.
    geometry.setFromPoints(
      Array.from(
        { length: vertices.length / 3 },
        (_, i) => new Vector3(...(vertices.slice(i * 3, i * 3 + 3) as [number, number, number])),
      ),
    );
    geometry.setIndex(indices);
    geometry.computeVertexNormals();
    this.lines.set(source, geometry);
    return geometry;
  }

  encode(scene: Scene, camera: Camera): RenderFrame {
    scene.updateMatrixWorld();
    camera.updateMatrixWorld();
    const frame: RenderFrame = {
      protocol: RENDER_PROTOCOL,
      meshes: [],
      materials: [],
      nodes: [],
      removedNodes: [],
      removedMeshes: [],
      removedMaterials: [],
      camera: {
        world: [...camera.matrixWorld.elements],
        projection: [...camera.projectionMatrix.elements],
        near: (camera as Camera & { near: number }).near,
        far: (camera as Camera & { far: number }).far,
      },
      background: rgb(scene.background instanceof Color ? scene.background : new Color('#73bce0')),
    };
    const usedMeshes = new Set<string>(),
      usedMaterials = new Set<string>(),
      usedNodes = new Set<string>();
    const visit = (
      object: Scene | Mesh | Sprite | import('three').Object3D,
      parentVisible: boolean,
    ) => {
      const visible = parentVisible && object.visible;
      if (object instanceof Mesh || object instanceof Sprite) {
        const materials = Array.isArray(object.material) ? object.material : [object.material];
        // Invisible picking planes are still present in React for pointer input, never in Unity.
        if (materials.some((material) => material.colorWrite)) {
          const source = object instanceof Sprite ? spriteQuad : object.geometry;
          const geometry = 'isLine2' in object ? this.lineGeometry(source) : source;
          usedMeshes.add(geometry.uuid);
          if (!this.meshes.has(geometry.uuid)) {
            frame.meshes.push(meshResource(geometry));
            this.meshes.add(geometry.uuid);
          }
          for (const material of materials) {
            if (usedMaterials.has(material.uuid)) continue;
            usedMaterials.add(material.uuid);
            const resource = materialResource(material, this.texture);
            const key = JSON.stringify(resource);
            if (this.materials.get(material.uuid) !== key) {
              frame.materials.push(resource);
              this.materials.set(material.uuid, key);
            }
          }
          let world = object.matrixWorld;
          if (object instanceof Sprite) {
            world.decompose(position, rotation, scale);
            camera.getWorldQuaternion(rotation);
            world = matrix.compose(position, rotation, scale);
          }
          const node: RenderNode = {
            id: object.uuid,
            mesh: geometry.uuid,
            materials: materials.map((material) => material.uuid),
            matrix: [...world.elements],
            visible,
            castShadow: object.castShadow,
            receiveShadow: object.receiveShadow,
            order: object.renderOrder,
          };
          const key = JSON.stringify(node);
          if (this.nodes.get(node.id) !== key) {
            frame.nodes.push(node);
            this.nodes.set(node.id, key);
          }
          usedNodes.add(node.id);
        }
      }
      for (const child of object.children) visit(child, visible);
    };
    visit(scene, true);
    for (const id of this.nodes.keys())
      if (!usedNodes.has(id)) {
        frame.removedNodes.push(id);
        this.nodes.delete(id);
      }
    for (const id of this.meshes)
      if (!usedMeshes.has(id)) {
        frame.removedMeshes.push(id);
        this.meshes.delete(id);
      }
    for (const id of this.materials.keys())
      if (!usedMaterials.has(id)) {
        frame.removedMaterials.push(id);
        this.materials.delete(id);
      }
    return frame;
  }
}
