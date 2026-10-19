import {
  EventDispatcher,
  Vector2,
  WebGLCoordinateSystem,
  type Camera,
  type Scene,
  type WebGLRenderTarget,
} from 'three';
import { SceneEncoder } from './SceneEncoder';
import { loadUnity, type UnityInstance } from './runtime';

/** R3F authors/animates the scene; this renderer sends it to Unity instead of Three's GPU renderer. */
export class UnityRenderer {
  readonly isUnityRenderer = true;
  readonly domElement: HTMLCanvasElement;
  readonly coordinateSystem = WebGLCoordinateSystem;
  readonly shadowMap = { enabled: true, type: 0, needsUpdate: false };
  readonly xr = Object.assign(new EventDispatcher(), {
    enabled: false,
    isPresenting: false,
    setAnimationLoop: () => {},
  });
  outputColorSpace = '';
  toneMapping = 0;
  toneMappingExposure = 0.95;
  autoClear = true;
  private encoder = new SceneEncoder();
  private target: WebGLRenderTarget | null = null;
  private size = new Vector2(1, 1);
  private pixelRatio = 1;
  private disposed = false;
  private announced = false;
  private instance: UnityInstance;
  private constructor(canvas: HTMLCanvasElement, instance: UnityInstance) {
    this.domElement = canvas;
    this.instance = instance;
  }
  static async create(canvas: HTMLCanvasElement) {
    return new UnityRenderer(canvas, await loadUnity(canvas));
  }
  setPixelRatio(value: number) {
    this.pixelRatio = value;
  }
  getPixelRatio() {
    return this.pixelRatio;
  }
  setSize(width: number, height: number, updateStyle = true) {
    this.size.set(width, height);
    this.domElement.width = Math.floor(width * this.pixelRatio);
    this.domElement.height = Math.floor(height * this.pixelRatio);
    if (updateStyle) {
      this.domElement.style.width = `${width}px`;
      this.domElement.style.height = `${height}px`;
    }
  }
  getSize(target: Vector2) {
    return target.copy(this.size);
  }
  getDrawingBufferSize(target: Vector2) {
    return target.copy(this.size).multiplyScalar(this.pixelRatio).floor();
  }
  // Environment/Lightformer still author the original scene. Unity owns lighting/reflections.
  getRenderTarget() {
    return this.target;
  }
  setRenderTarget(target: WebGLRenderTarget | null) {
    this.target = target;
  }
  getActiveCubeFace() {
    return 0;
  }
  getActiveMipmapLevel() {
    return 0;
  }
  render(scene: Scene, camera: Camera) {
    if (this.disposed || this.target) return;
    const frame = this.encoder.encode(scene, camera);
    if (!this.announced) {
      console.info(`React → Unity: ${frame.nodes.length} nodes, ${frame.meshes.length} geometries`);
      this.announced = true;
    }
    this.instance.SendMessage('AzarashiRenderer', 'ApplyFrame', JSON.stringify(frame));
  }
  dispose() {
    if (this.disposed) return;
    this.disposed = true;
    return this.instance.Quit();
  }
}
