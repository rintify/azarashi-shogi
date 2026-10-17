import { LEVELS } from './levels';
import type { SearchInput, ThinkRequest, ThinkResponse } from './protocol';
import { searchIdentity } from './searchIdentity';

type Listener = (message: ThinkResponse) => void;
interface Slot {
  worker: Worker;
  id: number;
  busy: boolean;
  key?: string;
  startedAt?: number;
  result?: Extract<ThinkResponse, { type: 'result' }>;
  listener?: Listener;
}

/** At most one search runs. Idle foreground caches survive speculative misses. */
export class NpcClient {
  private primary?: Slot;
  private spare?: Slot;
  private speculative?: Slot;
  private serial = 0;
  private createWorker: () => Worker;
  constructor(
    createWorker = () => new Worker(new URL('./worker.ts', import.meta.url), { type: 'module' }),
  ) {
    this.createWorker = createWorker;
  }

  private create(): Slot {
    const slot: Slot = { worker: this.createWorker(), id: 0, busy: false };
    slot.worker.onmessage = ({ data }: MessageEvent<ThinkResponse>) => {
      if (slot.id !== data.id || !slot.busy) return;
      if (data.type === 'forecast') {
        slot.key = searchIdentity(data.input);
        slot.startedAt = performance.now();
      } else if (data.type === 'result') {
        slot.busy = false;
        slot.result = data;
      } else if (data.type === 'error') {
        slot.key = undefined;
        slot.busy = false;
      }
      slot.listener?.(data);
    };
    slot.worker.onerror = () => {
      slot.key = undefined;
      slot.busy = false;
      slot.listener?.({
        type: 'error',
        id: slot.id,
        message: 'NPCの読み込みに失敗しました。再試行してください。',
      });
    };
    return slot;
  }

  private send(slot: Slot, input: SearchInput, type: ThinkRequest['type']) {
    slot.id = ++this.serial;
    slot.busy = true;
    slot.key = undefined;
    slot.result = undefined;
    slot.startedAt = undefined;
    slot.worker.postMessage({ ...input, id: slot.id, type } satisfies ThinkRequest);
  }

  think(input: SearchInput, listener: Listener): number {
    const budget = LEVELS[input.difficulty].thinkingMs;
    const forecast = this.speculative;
    if (forecast?.key === searchIdentity(input)) {
      // Adopt the running (or completed) reply. It already has its full normal search budget.
      this.spare = this.primary;
      this.primary = forecast;
      this.speculative = undefined;
      forecast.listener = listener;
      if (forecast.result) listener(forecast.result);
      return Math.max(1, budget - (performance.now() - (forecast.startedAt ?? performance.now())));
    }
    this.cancelSpeculation();
    if (this.primary?.busy) this.destroyPrimary();
    this.primary ??= this.create();
    this.primary.listener = listener;
    this.send(this.primary, input, 'think');
    return budget;
  }

  ponder(input: SearchInput) {
    this.stop();
    this.speculative = this.spare ?? this.create();
    this.spare = undefined;
    this.speculative.listener = undefined;
    this.send(this.speculative, input, 'ponder');
  }

  private cancelSpeculation() {
    if (this.speculative) {
      this.speculative.listener = undefined;
      this.speculative.worker.terminate();
      this.speculative = undefined;
    }
  }
  private destroyPrimary() {
    if (this.primary) {
      this.primary.listener = undefined;
      this.primary.worker.terminate();
      this.primary = undefined;
    }
  }
  /** Suspending active work is immediate, even while synchronous WASM is running. */
  stop() {
    this.cancelSpeculation();
    if (this.primary?.busy) this.destroyPrimary();
    if (this.primary) this.primary.listener = undefined;
  }
  dispose() {
    this.stop();
    this.destroyPrimary();
    this.spare?.worker.terminate();
    this.spare = undefined;
  }
}
