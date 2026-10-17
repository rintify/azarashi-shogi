import { expect, it, vi } from 'vitest';
import { NpcClient } from './NpcClient';
import type { SearchInput, ThinkRequest, ThinkResponse } from './protocol';
import { createGame } from '../game/engine';

function fixture() {
  const workers: {
    worker: Worker;
    postMessage: ReturnType<typeof vi.fn>;
    terminate: ReturnType<typeof vi.fn>;
    send: (data: ThinkResponse) => void;
    id: () => number;
  }[] = [];
  const client = new NpcClient(() => {
    const postMessage = vi.fn(),
      terminate = vi.fn();
    const worker = { postMessage, terminate, onmessage: null, onerror: null } as unknown as Worker;
    workers.push({
      worker,
      postMessage,
      terminate,
      send: (data) => worker.onmessage?.({ data } as MessageEvent<ThinkResponse>),
      id: () => (postMessage.mock.lastCall![0] as ThinkRequest).id,
    });
    return worker;
  });
  const input: SearchInput = { state: createGame(), seed: 1, difficulty: 6, positionHistory: [] };
  return { workers, client, input };
}
const result = { action: null, score: 0, nodes: 50, depth: 2, elapsedMs: 100, timedOut: false };

it('preserves foreground caches on a forecast miss and never submits its result', () => {
  const { workers, client, input } = fixture();
  const receive = vi.fn();
  client.think(input, receive);
  workers[0].send({ type: 'result', id: workers[0].id(), result });
  client.ponder(input);
  workers[1].send({ type: 'forecast', id: workers[1].id(), input });
  const callback = vi.fn();
  expect(client.think({ ...input, positionHistory: ['different'] }, callback)).toBe(30000);
  expect(workers).toHaveLength(2);
  expect(workers[0].postMessage).toHaveBeenCalledTimes(2);
  expect(workers[0].terminate).not.toHaveBeenCalled();
  expect(workers[1].terminate).toHaveBeenCalledOnce();
  workers[1].send({ type: 'result', id: workers[1].id(), result });
  expect(callback).not.toHaveBeenCalled();
  client.dispose();
});

it.each(['history', 'difficulty', 'seed', 'pieceId', 'revision'] as const)(
  'does not reuse a prediction with a different %s',
  (changed) => {
    const { workers, client, input } = fixture();
    client.ponder(input);
    workers[0].send({ type: 'forecast', id: workers[0].id(), input });
    const next = structuredClone(input);
    if (changed === 'history') next.positionHistory = ['old'];
    if (changed === 'difficulty') next.difficulty = 5;
    if (changed === 'seed') next.seed++;
    if (changed === 'pieceId') next.state.pieces[0].id += 'new';
    if (changed === 'revision') next.state.revision++;
    client.think(next, vi.fn());
    expect(workers[0].terminate).toHaveBeenCalledOnce();
    expect(workers[1].postMessage.mock.lastCall![0].type).toBe('think');
    client.dispose();
  },
);

it('falls back to a full search if speculation fails after announcing its forecast', () => {
  const { workers, client, input } = fixture();
  client.ponder(input);
  workers[0].send({ type: 'forecast', id: workers[0].id(), input });
  workers[0].send({ type: 'error', id: workers[0].id(), message: 'failed' });
  expect(client.think(input, vi.fn())).toBe(30000);
  expect(workers[1].postMessage).toHaveBeenCalledOnce();
  client.dispose();
});
