// @vitest-environment jsdom
import { act, cleanup, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { applyAction, createGame } from '../game/engine';
import type { SearchInput, ThinkRequest, ThinkResponse } from './protocol';
import { useNpc } from './useNpc';
import { positionIdentity } from '../game/position';

const emptyHistory: readonly string[] = [];
class FakeWorker {
  static instances: FakeWorker[] = [];
  onmessage: ((event: MessageEvent<ThinkResponse>) => void) | null = null;
  onerror: (() => void) | null = null;
  postMessage = vi.fn();
  terminate = vi.fn();
  constructor() {
    FakeWorker.instances.push(this);
  }
  get request(): ThinkRequest {
    return this.postMessage.mock.lastCall![0];
  }
  send(data: ThinkResponse) {
    this.onmessage?.({ data } as MessageEvent<ThinkResponse>);
  }
  finish() {
    this.send({ type: 'result', id: this.request.id, result });
  }
}
const result = {
  action: { type: 'place' as const, kind: 'penguin' as const, at: { x: 4, y: 7 } },
  depth: 2,
  nodes: 100,
  elapsedMs: 100,
  score: 0,
  timedOut: false,
};
beforeEach(() => {
  FakeWorker.instances = [];
  vi.stubGlobal('Worker', FakeWorker);
});
afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

it('retains an idle Worker across ordinary AI turns, including playback', () => {
  const game = createGame(),
    submit = vi.fn();
  const hook = renderHook(
    ({ state, defer }) => useNpc(state, null, 3, submit, true, 12, emptyHistory, 'match', defer),
    {
      initialProps: { state: game, defer: false },
    },
  );
  const first = FakeWorker.instances[0];
  act(() => first.finish());
  expect(submit).toHaveBeenCalledWith(result.action, 0);
  const next = applyAction(game, result.action);
  hook.rerender({ state: next, defer: true });
  expect(first.terminate).not.toHaveBeenCalled();
  hook.rerender({ state: next, defer: false });
  expect(FakeWorker.instances).toHaveLength(1);
  expect(first.request.state).toBe(next);
  expect(first.request.type).toBe('think');
  expect(first.postMessage).toHaveBeenCalledTimes(2);
});

it('ponders during the human turn without showing thinking or submitting speculative moves', () => {
  const game = createGame(),
    submit = vi.fn();
  const hook = renderHook(() => useNpc(game, 'south', 6, submit));
  const worker = FakeWorker.instances[0];
  expect(worker.request.type).toBe('ponder');
  act(() => worker.finish());
  expect(submit).not.toHaveBeenCalled();
  expect(hook.result.current.status.thinking).toBe(false);
  expect(hook.result.current.thinkingSession).toBeNull();
});

it.each([false, true])('adopts a matching forecast across landing, completed=%s', (completed) => {
  const game = createGame(),
    submit = vi.fn();
  const history = [positionIdentity(game)];
  const next = applyAction(game, result.action);
  const nextHistory = [...history, positionIdentity(next)];
  const hook = renderHook(
    ({ state, positions, defer }) =>
      useNpc(state, 'south', 6, submit, true, 12, positions, 'match', defer),
    {
      initialProps: { state: game, positions: history, defer: false },
    },
  );
  const worker = FakeWorker.instances[0];
  const input: SearchInput = { state: next, positionHistory: nextHistory, difficulty: 6, seed: 12 };
  act(() => worker.send({ type: 'forecast', id: worker.request.id, input }));
  if (completed) act(() => worker.finish());
  hook.rerender({ state: next, positions: nextHistory, defer: true });
  expect(worker.terminate).not.toHaveBeenCalled();
  expect(submit).not.toHaveBeenCalled();
  hook.rerender({ state: next, positions: nextHistory, defer: false });
  if (!completed) act(() => worker.finish());
  expect(worker.postMessage).toHaveBeenCalledOnce();
  expect(FakeWorker.instances).toHaveLength(1);
  expect(submit).toHaveBeenCalledExactlyOnceWith(result.action, next.revision);
});

it('discards missed predictions and gives the actual position its full budget', () => {
  const game = createGame(),
    submit = vi.fn();
  const hook = renderHook(({ state }) => useNpc(state, 'south', 6, submit), {
    initialProps: { state: game },
  });
  const predicted = FakeWorker.instances[0];
  act(() =>
    predicted.send({
      type: 'forecast',
      id: predicted.request.id,
      input: { state: game, seed: 0, difficulty: 6, positionHistory: [] },
    }),
  );
  const next = applyAction(game, result.action);
  hook.rerender({ state: next });
  expect(predicted.terminate).toHaveBeenCalledOnce();
  expect(FakeWorker.instances[1].request.type).toBe('think');
  expect(hook.result.current.thinkingSession?.budgetMs).toBe(30000);
  act(() => predicted.finish());
  expect(submit).not.toHaveBeenCalled();
});

it('cancels on pause/replay, rejects obsolete results, and restarts on retry', () => {
  const game = createGame(),
    submit = vi.fn();
  const hook = renderHook(({ enabled }) => useNpc(game, null, 3, submit, enabled), {
    initialProps: { enabled: true },
  });
  const old = FakeWorker.instances[0];
  hook.rerender({ enabled: false });
  expect(old.terminate).toHaveBeenCalledOnce();
  act(() => old.finish());
  expect(submit).not.toHaveBeenCalled();
  hook.rerender({ enabled: true });
  const worker = FakeWorker.instances[1];
  act(() => worker.send({ type: 'error', id: worker.request.id, message: 'retry' }));
  expect(hook.result.current.error).toBe('retry');
  act(() => hook.result.current.retry());
  expect(FakeWorker.instances).toHaveLength(3);
  expect(hook.result.current.error).toBeNull();
});

it('isolates new matches even when revision and seed match', () => {
  const game = createGame(),
    submit = vi.fn();
  const hook = renderHook(({ id }) => useNpc(game, null, 6, submit, true, 12, emptyHistory, id), {
    initialProps: { id: 'a' },
  });
  const old = FakeWorker.instances[0];
  hook.rerender({ id: 'b' });
  expect(old.terminate).toHaveBeenCalledOnce();
  act(() => old.finish());
  expect(submit).not.toHaveBeenCalled();
  act(() => FakeWorker.instances[1].finish());
  expect(submit).toHaveBeenCalledOnce();
});

it('rejects stale request IDs and duplicate results from a retained Worker', () => {
  const game = createGame(),
    submit = vi.fn();
  const hook = renderHook(({ state }) => useNpc(state, null, 6, submit), {
    initialProps: { state: game },
  });
  const worker = FakeWorker.instances[0],
    id = worker.request.id;
  act(() => worker.finish());
  hook.rerender({ state: applyAction(game, result.action) });
  act(() => worker.send({ type: 'result', id, result }));
  expect(submit).toHaveBeenCalledTimes(1);
  act(() => {
    worker.finish();
    worker.finish();
  });
  expect(submit).toHaveBeenCalledTimes(2);
});

it('halts speculation when the tab becomes hidden', () => {
  const game = createGame();
  const submit = vi.fn();
  renderHook(() => useNpc(game, 'south', 6, submit));
  vi.spyOn(document, 'hidden', 'get').mockReturnValue(true);
  act(() => document.dispatchEvent(new Event('visibilitychange')));
  expect(FakeWorker.instances[0].terminate).toHaveBeenCalledOnce();
});

it('does not allocate a Worker in local PvP or disabled play', () => {
  renderHook(() => useNpc(createGame(), null, 6, vi.fn(), false));
  expect(FakeWorker.instances).toHaveLength(0);
});
