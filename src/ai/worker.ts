import { loadEngine } from './wasmRuntime';
import type { ThinkRequest, ThinkResponse } from './protocol';
const respond = (message: ThinkResponse) => self.postMessage(message);
self.onmessage = async ({ data }: MessageEvent<ThinkRequest>) => {
  try {
    const engine = await loadEngine({
      onProgress: (progress) => respond({ type: 'progress', revision: data.revision, progress }),
    });
    const result = engine.search(data.state, data.difficulty, {
      seed: data.seed,
      positionHistory: data.positionHistory,
    });
    respond({ type: 'result', revision: data.revision, result });
  } catch {
    respond({
      type: 'error',
      revision: data.revision,
      message: 'NPCの読み込みか思考に失敗しました。「もう一度考える」で再試行できます。',
    });
  }
};
