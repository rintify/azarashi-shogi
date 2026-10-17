import { loadEngine } from './wasmRuntime';
import { applyAction } from '../game/engine';
import { positionIdentity } from '../game/position';
import type { SearchInput, ThinkRequest, ThinkResponse } from './protocol';

const respond = (message: ThinkResponse) => self.postMessage(message);
let currentId = 0;
let predicting = false;
// One instance retains separate Rust caches for both sides throughout this Worker's lifetime.
const engine = loadEngine({
  onProgress: (progress) => {
    if (!predicting) respond({ type: 'progress', id: currentId, progress });
  },
});
self.onmessage = async ({ data }: MessageEvent<ThinkRequest>) => {
  currentId = data.id;
  try {
    const ready = await engine;
    let input: SearchInput = data;
    if (data.type === 'ponder') {
      predicting = true;
      // Forecasting itself does not consume the reply's ordinary search budget.
      const prediction = ready.search(data.state, data.difficulty, {
        seed: data.seed,
        positionHistory: data.positionHistory,
        budgetMs: 150,
        maxDepth: 3,
      });
      predicting = false;
      if (!prediction.action) return;
      const next = applyAction(data.state, prediction.action);
      if (next.phase === 'finished') return;
      input = {
        state: next,
        difficulty: data.difficulty,
        seed: data.seed,
        positionHistory: [...data.positionHistory, positionIdentity(next)],
      };
      respond({ type: 'forecast', id: data.id, input });
    }
    const result = ready.search(input.state, input.difficulty, {
      seed: input.seed,
      positionHistory: input.positionHistory,
    });
    respond({ type: 'result', id: data.id, result });
  } catch {
    predicting = false;
    respond({
      type: 'error',
      id: data.id,
      message: 'NPCの読み込みか思考に失敗しました。「もう一度考える」で再試行できます。',
    });
  }
};
