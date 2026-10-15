import { searchBestAction } from './search';
import type { ThinkRequest, ThinkResponse } from './protocol';
const respond = (message: ThinkResponse) => self.postMessage(message);
self.onmessage = ({ data }: MessageEvent<ThinkRequest>) => {
  try {
    const result = searchBestAction(data.state, { difficulty: data.difficulty, onProgress: progress => respond({ type: 'progress', revision: data.revision, progress }) });
    respond({ type: 'result', revision: data.revision, result });
  } catch { respond({ type: 'error', revision: data.revision, message: 'NPCの思考に失敗しました。「もう一度考える」で再試行できます。' }); }
};
