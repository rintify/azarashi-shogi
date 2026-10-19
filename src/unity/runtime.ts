export interface UnityInstance {
  SendMessage(object: string, method: string, value: string): void;
  Quit(): Promise<void>;
}
export interface UnityBuild {
  loaderUrl: string;
  dataUrl: string;
  frameworkUrl: string;
  codeUrl: string;
}
declare global {
  interface Window {
    createUnityInstance?: (
      canvas: HTMLCanvasElement,
      config: Record<string, unknown>,
      progress?: (amount: number) => void,
    ) => Promise<UnityInstance>;
  }
}
let buildPromise: Promise<UnityBuild> | undefined;
let loaderPromise: Promise<void> | undefined;
async function loadBuild(): Promise<UnityBuild> {
  const base = new URL(`${import.meta.env.BASE_URL}UnityBuild/`, document.baseURI);
  const response = await fetch(new URL('manifest.json', base));
  if (!response.ok)
    throw new Error('Unityビルドがありません。npm run unity:build を実行してください。');
  const manifest = (await response.json()) as UnityBuild;
  for (const key of ['loaderUrl', 'dataUrl', 'frameworkUrl', 'codeUrl'] as const) {
    if (typeof manifest[key] !== 'string') throw new Error('Unityビルド情報が不正です。');
    manifest[key] = new URL(manifest[key], base).href;
  }
  return manifest;
}
export async function loadUnity(canvas: HTMLCanvasElement): Promise<UnityInstance> {
  // Unity's keyboard/pointer bootstrap uses an ID selector even when it only renders.
  if (!canvas.id) canvas.id = `azarashi-unity-${crypto.randomUUID()}`;
  const build = await (buildPromise ??= loadBuild().catch((error) => {
    buildPromise = undefined;
    throw error;
  }));
  await (loaderPromise ??= new Promise<void>((resolve, reject) => {
    const script = document.createElement('script');
    script.src = build.loaderUrl;
    script.onload = () => resolve();
    script.onerror = () => {
      script.remove();
      loaderPromise = undefined;
      reject(new Error('Unityローダーを読み込めませんでした。'));
    };
    document.head.append(script);
  }));
  if (!window.createUnityInstance) throw new Error('Unityローダーの初期化に失敗しました。');
  return window.createUnityInstance(canvas, {
    ...build,
    companyName: 'Azarashi Shogi',
    productName: 'アザラシ将棋',
    productVersion: '1.0',
    matchWebGLToCanvasSize: true,
    devicePixelRatio: Math.min(window.devicePixelRatio, 1.8),
  });
}
