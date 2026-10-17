// @vitest-environment jsdom
import { act, cleanup, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { applyAction, createGame } from '../game/engine';
import type { ThinkResponse } from './protocol';
import { useNpc } from './useNpc';
import { positionIdentity } from '../game/position';
class FakeWorker {
  static instances: FakeWorker[] = [];
  onmessage: ((event: MessageEvent<ThinkResponse>) => void) | null = null;
  onerror: (() => void) | null = null;
  postMessage = vi.fn();
  terminate = vi.fn();
  constructor() {
    FakeWorker.instances.push(this);
  }
  send(data: ThinkResponse) {
    this.onmessage?.({ data } as MessageEvent<ThinkResponse>);
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
  vi.unstubAllGlobals();
});
describe('NPC worker lifecycle', () => {
  it('sends the played history to either AI and replaces it for a new match', () => {
    const game = createGame();
    const submit = vi.fn();
    const previous = [positionIdentity(game), 'earlier-position'];
    const hook = renderHook(({ positions }) => useNpc(game, null, 3, submit, true, 12, positions), {
      initialProps: { positions: previous },
    });
    expect(FakeWorker.instances[0].postMessage).toHaveBeenCalledWith(
      expect.objectContaining({ positionHistory: previous }),
    );
    const fresh = [positionIdentity(game)];
    hook.rerender({ positions: fresh });
    expect(FakeWorker.instances[0].terminate).toHaveBeenCalledOnce();
    expect(FakeWorker.instances[1].postMessage).toHaveBeenCalledWith(
      expect.objectContaining({ positionHistory: fresh }),
    );
  });
  it('passes match entropy to the worker and cancels it when opening a replay', () => {
    const game = createGame(),
      submit = vi.fn();
    const hook = renderHook(({ enabled, seed }) => useNpc(game, null, 2, submit, enabled, seed), {
      initialProps: { enabled: true, seed: 12345 },
    });
    const worker = FakeWorker.instances[0];
    expect(worker.postMessage).toHaveBeenCalledWith({
      state: game,
      difficulty: 2,
      revision: 0,
      seed: 12345,
      positionHistory: [],
    });
    hook.rerender({ enabled: false, seed: 12345 });
    expect(worker.terminate).toHaveBeenCalledOnce();
    act(() => worker.send({ type: 'result', revision: 0, result }));
    expect(submit).not.toHaveBeenCalled();
    hook.rerender({ enabled: true, seed: 98765 });
    expect(FakeWorker.instances[1].postMessage).toHaveBeenCalledWith(
      expect.objectContaining({ seed: 98765 }),
    );
  });
  it('leaves the human turn on the main thread', () => {
    const game = createGame(),
      submit = vi.fn();
    renderHook(() => useNpc(game, 'south', 3, submit));
    expect(FakeWorker.instances).toHaveLength(0);
  });
  it('updates progress and submits only the current position', () => {
    const submit = vi.fn();
    const game = createGame();
    const hook = renderHook(() => useNpc(game, 'north', 3, submit));
    const worker = FakeWorker.instances[0];
    expect(worker.postMessage).toHaveBeenCalledWith({
      state: game,
      difficulty: 3,
      revision: 0,
      seed: 0,
      positionHistory: [],
    });
    act(() =>
      worker.send({
        type: 'progress',
        revision: 0,
        progress: { depth: 2, nodes: 100, elapsedMs: 10 },
      }),
    );
    expect(hook.result.current.status.thinking).toBe(true);
    expect(hook.result.current.status.depth).toBe(2);
    act(() => worker.send({ type: 'result', revision: 99, result }));
    expect(submit).not.toHaveBeenCalled();
    act(() => worker.send({ type: 'result', revision: 0, result }));
    expect(submit).toHaveBeenCalledWith(result.action, 0);
  });
  it('terminates an old search and rejects its result even when a new match has the same revision', () => {
    const submit = vi.fn();
    const hook = renderHook(({ game }) => useNpc(game, 'north', 5, submit), {
      initialProps: { game: createGame() },
    });
    const oldWorker = FakeWorker.instances[0];
    hook.rerender({ game: createGame() });
    expect(oldWorker.terminate).toHaveBeenCalledOnce();
    act(() => oldWorker.send({ type: 'result', revision: 0, result }));
    expect(submit).not.toHaveBeenCalled();
    act(() => FakeWorker.instances[1].send({ type: 'result', revision: 0, result }));
    expect(submit).toHaveBeenCalledOnce();
    hook.unmount();
    expect(FakeWorker.instances[1].terminate).toHaveBeenCalledOnce();
  });
  it('exposes errors and starts a fresh worker on retry', () => {
    const submit = vi.fn(),
      game = createGame();
    const hook = renderHook(() => useNpc(game, 'north', 3, submit));
    act(() => FakeWorker.instances[0].send({ type: 'error', revision: 0, message: 'retry' }));
    expect(hook.result.current.error).toBe('retry');
    expect(hook.result.current.status.thinking).toBe(false);
    act(() => hook.result.current.retry());
    expect(FakeWorker.instances).toHaveLength(2);
    expect(hook.result.current.error).toBeNull();
  });
});

it('does not start the NPC until playback releases the next turn', () => {
  const game = createGame(),
    submit = vi.fn();
  const hook = renderHook(({ enabled }) => useNpc(game, 'north', 3, submit, enabled), {
    initialProps: { enabled: false },
  });
  expect(FakeWorker.instances).toHaveLength(0);
  hook.rerender({ enabled: true });
  expect(FakeWorker.instances).toHaveLength(1);
  hook.rerender({ enabled: false });
  expect(FakeWorker.instances[0].terminate).toHaveBeenCalledOnce();
  act(() => FakeWorker.instances[0].send({ type: 'result', revision: 0, result }));
  expect(submit).not.toHaveBeenCalled();
});

it('runs both armies in spectator mode and submits their ordinary placements in sequence', () => {
  const initial = createGame(),
    submit = vi.fn();
  const hook = renderHook(({ game, level }) => useNpc(game, null, level, submit), {
    initialProps: { game: initial, level: 2 as import('../match/record').Difficulty },
  });
  const first = FakeWorker.instances[0];
  expect(first.postMessage).toHaveBeenCalledWith({
    state: initial,
    difficulty: 2,
    revision: 0,
    seed: 0,
    positionHistory: [],
  });
  act(() => first.send({ type: 'result', revision: 0, result }));
  expect(submit).toHaveBeenCalledWith(result.action, 0);
  const north = applyAction(initial, result.action);
  hook.rerender({ game: north, level: 4 });
  expect(first.terminate).toHaveBeenCalledOnce();
  expect(FakeWorker.instances[1].postMessage).toHaveBeenCalledWith({
    state: north,
    difficulty: 4,
    revision: 1,
    seed: 0,
    positionHistory: [],
  });
  const reply = {
    ...result,
    action: { type: 'place' as const, kind: 'penguin' as const, at: { x: 4, y: 2 } },
  };
  act(() => FakeWorker.instances[1].send({ type: 'result', revision: 1, result: reply }));
  expect(submit).toHaveBeenLastCalledWith(reply.action, 1);
});
