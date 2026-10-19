import { JSDOM } from 'jsdom';
import { mkdir, writeFile, copyFile } from 'node:fs/promises';
import { createElement } from 'react';
import { createRoot, extend, advance, act } from '@react-three/fiber';
import * as Three from 'three';
import { SceneEncoder } from '../src/unity/SceneEncoder';
import { createGame } from '../src/game/engine';
import { KINDS, DEFINITIONS, pieceName, dimensions } from '../src/game/pieces';
import { LEVELS } from '../src/ai/levels';
import { GUIDE_COLORS } from '../src/presentation/guideStyle';
import { renderToStaticMarkup } from 'react-dom/server';
import { AnimalIcon } from '../src/components/AnimalIcon';
import { Resvg } from '@resvg/resvg-js';
import { exportPresentationAssets } from './unity-presentation-assets';
import { exportPresentationFixtures } from './unity-presentation-fixtures';

async function main() {
  const dom = new JSDOM('<!doctype html><body></body>');
  Object.assign(globalThis, {
    window: dom.window,
    document: dom.window.document,
    HTMLElement: dom.window.HTMLElement,
    HTMLCanvasElement: dom.window.HTMLCanvasElement,
    IS_REACT_ACT_ENVIRONMENT: true,
  });
  extend(Three);
  const { Animal } = await import('../src/scene/Animals');
  const { BoardContents } = await import('../src/scene/BoardScene');
  const canvas = document.createElement('canvas');
  let sampledScene: Three.Scene, sampledCamera: Three.Camera;
  const renderer = {
    domElement: canvas,
    render(scene: Three.Scene, camera: Three.Camera) {
      if (!this.target) {
        sampledScene = scene;
        sampledCamera = camera;
      }
    },
    dispose() {},
    setSize() {},
    setPixelRatio() {},
    xr: Object.assign(new Three.EventDispatcher(), {
      enabled: false,
      isPresenting: false,
      setAnimationLoop() {},
    }),
    shadowMap: { enabled: false, type: 0 },
    coordinateSystem: Three.WebGLCoordinateSystem,
    autoClear: true,
    toneMapping: 0,
    outputColorSpace: '',
    target: null,
    getRenderTarget() {
      return this.target;
    },
    setRenderTarget(target: null) {
      this.target = target;
    },
    getActiveCubeFace() {
      return 0;
    },
    getActiveMipmapLevel() {
      return 0;
    },
  };
  const root = createRoot(canvas);
  await root.configure({
    gl: renderer,
    frameloop: 'never',
    size: { width: 800, height: 600, top: 0, left: 0 },
    camera: { position: [0, 20, 10], fov: 38 },
    dpr: 1,
  });
  const frames: { key: string; frame: ReturnType<SceneEncoder['encode']> }[] = [];
  async function sample(element: ReturnType<typeof createElement>) {
    await act(async () => {
      root.render(element);
    });
    advance(performance.now() / 1000, true);
    advance(performance.now() / 1000, true);
    return new SceneEncoder().encode(sampledScene, sampledCamera);
  }
  for (const kind of KINDS)
    for (const owner of ['south', 'north', 'catalog'] as const)
      for (const promoted of ['seal', 'penguin', 'orca'].includes(kind) ? [false, true] : [false]) {
        const frame = await sample(
          createElement(
            'group',
            {
              key: `${kind}:${owner}:${promoted}`,
              scale: owner === 'catalog' || kind === 'walrus' ? 1 : kind === 'orca' ? 0.9 : 0.86,
            },
            createElement(Animal, {
              kind,
              owner: owner === 'catalog' ? undefined : owner,
              promoted,
            }),
          ),
        );
        frames.push({ key: `${kind}:${owner}:${promoted ? 1 : 0}`, frame });
      }
  const penguinPoses: { owner: string; frames: ReturnType<SceneEncoder['encode']>[] }[] = [];
  for (const owner of ['south', 'north'] as const) {
    const blend = { current: 0 };
    const samples = [];
    for (let step = 0; step <= 64; step++) {
      blend.current = step / 64;
      samples.push(
        await sample(
          createElement(
            'group',
            { key: `penguin-blend:${owner}`, scale: 0.86 },
            createElement(Animal, { kind: 'penguin', owner, promoted: false, jetBlend: blend }),
          ),
        ),
      );
    }
    penguinPoses.push({ owner, frames: samples });
  }
  const fxScene = new Three.Scene();
  const effects = [
    ['snow-cloud', new Three.SphereGeometry(1, 10, 8)],
    ['snow-fleck', new Three.OctahedronGeometry(1, 0)],
    ['trail', new Three.SphereGeometry(1, 8, 6)],
    ['flame', new Three.ConeGeometry(0.18, 1.2, 20)],
    ['flame-core', new Three.SphereGeometry(1, 12, 8)],
    ['speed-line', new Three.BoxGeometry(0.018, 0.018, 1.25)],
    ['wave', new Three.TorusGeometry(0.65, 0.025, 5, 36, Math.PI * 1.7)],
    ['impact', new Three.RingGeometry(0.9, 1, 48)],
    ['snow-ring', new Three.RingGeometry(0.96, 1, 64)],
    ['guide-outline', new Three.RingGeometry(0.63, 0.67, 4, 1, Math.PI / 4)],
    ['catalog-floor', new Three.PlaneGeometry(200, 200)],
  ] as const;
  for (const [name, geometry] of effects) {
    const mesh = new Three.Mesh(geometry, new Three.MeshBasicMaterial());
    mesh.name = name;
    fxScene.add(mesh);
  }
  const fx = new SceneEncoder().encode(fxScene, new Three.PerspectiveCamera());
  const effectMeshes = effects.map(([name], i) => ({ name, mesh: fx.nodes[i].mesh }));
  const empty = { ...createGame(), pieces: [] };
  const noop = () => {};
  const world = await sample(
    createElement(BoardContents, {
      onReady: noop,
      game: empty,
      human: 'south',
      selectedId: null,
      legalCells: [],
      stationaryGuide: null,
      reachableCells: [],
      unsafeCells: [],
      kingDangerCells: [],
      transformationSafeCells: [],
      kingCaptureTrapCells: [],
      previewKingCaptureTrap: false,
      previewKingDanger: false,
      helperIds: [],
      trappedIds: [],
      preview: null,
      previewUnsafe: false,
      threats: [],
      kingCaptureIds: [],
      view: 'perspective',
      area: { x: 20, y: 140, width: 760, height: 390 },
      motion: null,
      busy: false,
      reduced: true,
      onCell: noop,
      onPiece: noop,
      onHover: noop,
      htmlPortal: { current: document.createElement('div') },
    }),
  );
  function sampleLighting(scene: Three.Scene) {
    const lighting = {
      environmentIntensity: scene.environmentIntensity,
      hemisphere: { sky: '#ffffff', ground: '#000000', intensity: 0 },
      directional: [] as {
        position: number[];
        color: string;
        intensity: number;
        shadows: boolean;
        shadow: unknown;
      }[],
    };
    scene.updateMatrixWorld(true);
    scene.traverse((node) => {
      if (node instanceof Three.HemisphereLight)
        lighting.hemisphere = {
          sky: '#' + node.color.getHexString(),
          ground: '#' + node.groundColor.getHexString(),
          intensity: node.intensity,
        };
      if (node instanceof Three.DirectionalLight) {
        node.target.updateMatrixWorld(true);
        node.shadow.camera.updateProjectionMatrix();
        node.shadow.updateMatrices(node);
        lighting.directional.push({
          position: node.getWorldPosition(new Three.Vector3()).toArray(),
          color: '#' + node.color.getHexString(),
          intensity: node.intensity,
          shadows: node.castShadow,
          shadow: {
            mapSize: node.shadow.mapSize.toArray(),
            matrix: node.shadow.matrix.toArray(),
            view: node.shadow.camera.matrixWorldInverse.toArray(),
            projection: node.shadow.camera.projectionMatrix.toArray(),
            bias: node.shadow.bias,
            normalBias: node.shadow.normalBias,
            intensity: node.shadow.intensity,
            samples: [-5, 0, 5].flatMap((x) =>
              [0, 1, 3].flatMap((y) =>
                [-5, 0, 5].map((z) => {
                  const point = new Three.Vector3(x, y, z);
                  const normal = new Three.Vector3(x + 1, 2, z - 1).normalize();
                  const uv = point
                    .clone()
                    .addScaledVector(normal, node.shadow.normalBias)
                    .applyMatrix4(node.shadow.matrix);
                  uv.z += node.shadow.bias;
                  return { point: point.toArray(), normal: normal.toArray(), uv: uv.toArray() };
                }),
              ),
            ),
          },
        });
      }
    });
    return lighting;
  }
  const lighting = sampleLighting(sampledScene);
  const { CatalogEnvironment } = await import('../src/scene/CatalogScene');
  const catalog = await sample(createElement(CatalogEnvironment));
  const catalogLighting = sampleLighting(sampledScene);
  const directory = 'unity/Assets/Resources/Native';
  const seenMeshes = new Set<string>(),
    seenMaterials = new Set<string>();
  for (const frame of [
    world,
    catalog,
    ...frames.map((entry) => entry.frame),
    fx,
    ...penguinPoses.flatMap((entry) => entry.frames),
  ]) {
    frame.meshes = frame.meshes.filter((mesh) => {
      if (seenMeshes.has(mesh.id)) return false;
      seenMeshes.add(mesh.id);
      return true;
    });
    frame.materials = frame.materials.filter((material) => {
      if (seenMaterials.has(material.id)) return false;
      seenMaterials.add(material.id);
      return true;
    });
  }
  await mkdir(directory, { recursive: true });
  await exportPresentationAssets(directory);
  await exportPresentationFixtures(directory);
  await mkdir(`${directory}/Icons`, { recursive: true });
  for (const kind of KINDS)
    for (const promoted of ['seal', 'penguin', 'orca'].includes(kind) ? [false, true] : [false]) {
      const svg = renderToStaticMarkup(createElement(AnimalIcon, { kind, promoted }))
        .replace('<svg ', '<svg xmlns="http://www.w3.org/2000/svg" ')
        .replaceAll('var(--icon-cutout)', '#f8fcff');
      await writeFile(
        `${directory}/Icons/${kind}-${promoted ? 1 : 0}.png`,
        new Resvg(svg, { fitTo: { mode: 'width', value: 128 } }).render().asPng(),
      );
    }
  await writeFile(
    `${directory}/SceneAssets.json`,
    JSON.stringify({
      world,
      catalog,
      models: frames,
      lighting,
      catalogLighting,
      effects: fx,
      effectMeshes,
      penguinPoses,
    }),
  );
  await writeFile(
    `${directory}/GameConfig.json`,
    JSON.stringify({
      initial: createGame(),
      levels: Object.entries(LEVELS).map(([level, config]) => ({
        level: Number(level),
        ...config,
      })),
      pieces: KINDS.map((kind) => ({
        kind,
        ...DEFINITIONS[kind],
        shortName: DEFINITIONS[kind].short,
      })),
      variants: KINDS.flatMap((kind) =>
        (['seal', 'penguin', 'orca'].includes(kind) ? [false, true] : [false]).map((promoted) => ({
          kind,
          promoted,
          name: pieceName({ kind, promoted }),
          width: dimensions({ kind, promoted })[0],
          height: dimensions({ kind, promoted })[1],
        })),
      ),
      colors: GUIDE_COLORS,
    }),
  );
  await copyFile('src/ai/wasm/azarashi_engine.wasm', `${directory}/azarashi_engine.bytes`);
  await copyFile('docs/fixtures/unity-smoke.json', `${directory}/smoke.json`);
  console.log(`Exported ${frames.length} existing TSX animal variants and the original ice world.`);
  await act(async () => root.unmount());
}
main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
