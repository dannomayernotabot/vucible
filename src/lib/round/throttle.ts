type QueueEntry<T = unknown> = {
  fn: () => Promise<T>;
  resolve: (value: T) => void;
  reject: (reason: unknown) => void;
};

export class ProviderThrottle extends EventTarget {
  private cap: number;
  private running = 0;
  private phantoms = 0;
  private queue: QueueEntry[] = [];

  constructor(cap: number) {
    super();
    this.cap = Math.max(1, cap);
  }

  setCap(cap: number): void {
    this.cap = Math.max(1, cap);
    this.drain();
    this.emit();
  }

  enqueue<T>(fn: () => Promise<T>): Promise<T> {
    return new Promise<T>((resolve, reject) => {
      this.queue.push({
        fn,
        resolve: resolve as (v: unknown) => void,
        reject,
      });
      this.drain();
      this.emit();
    });
  }

  inflight(): number {
    return this.running;
  }

  queued(): number {
    return this.queue.length;
  }

  seedConsumed(count: number, ttlMs: number): void {
    this.phantoms += count;
    this.emit();
    setTimeout(() => {
      this.phantoms = Math.max(0, this.phantoms - count);
      this.drain();
      this.emit();
    }, ttlMs);
  }

  private effectiveCap(): number {
    return Math.max(0, this.cap - this.phantoms);
  }

  private drain(): void {
    while (this.queue.length > 0 && this.running < this.effectiveCap()) {
      const entry = this.queue.shift()!;
      this.running++;
      void this.run(entry);
    }
  }

  private async run(entry: QueueEntry): Promise<void> {
    try {
      const value = await entry.fn();
      entry.resolve(value);
    } catch (e) {
      entry.reject(e);
    } finally {
      this.running--;
      this.drain();
      this.emit();
    }
  }

  private emit(): void {
    this.dispatchEvent(new Event("change"));
  }
}
