interface CacheEntry {
  url: string;
  refcount: number;
  accessOrder: number;
}

export class ImageCache {
  private readonly maxSize: number;
  private readonly entries = new Map<string, CacheEntry>();
  private accessCounter = 0;

  constructor(maxSize: number) {
    this.maxSize = maxSize;
  }

  private key(roundId: string, slotKey: string): string {
    return `${roundId}:${slotKey}`;
  }

  get(
    roundId: string,
    slotKey: string,
    bytes: ArrayBuffer,
    mimeType: string,
  ): string {
    if (!mimeType) {
      console.warn(
        `[ImageCache] missing mimeType for ${roundId}:${slotKey}`,
      );
      return "";
    }

    const k = this.key(roundId, slotKey);
    const existing = this.entries.get(k);
    if (existing) {
      existing.refcount++;
      existing.accessOrder = ++this.accessCounter;
      return existing.url;
    }

    this.evict();

    const blob = new Blob([bytes], { type: mimeType });
    const url = URL.createObjectURL(blob);
    this.entries.set(k, {
      url,
      refcount: 1,
      accessOrder: ++this.accessCounter,
    });

    if (this.entries.size > this.maxSize * 2) {
      console.warn(
        `[ImageCache] cache size ${this.entries.size} exceeds 2× cap ${this.maxSize * 2}`,
      );
    }

    return url;
  }

  release(roundId: string, slotKey: string): void {
    const k = this.key(roundId, slotKey);
    const entry = this.entries.get(k);
    if (!entry) return;

    entry.refcount = Math.max(0, entry.refcount - 1);
  }

  private evict(): void {
    if (this.entries.size < this.maxSize) return;

    const evictable: [string, CacheEntry][] = [];
    for (const [k, e] of this.entries) {
      if (e.refcount === 0) evictable.push([k, e]);
    }

    evictable.sort((a, b) => a[1].accessOrder - b[1].accessOrder);

    const toRemove = this.entries.size - this.maxSize + 1;
    for (let i = 0; i < Math.min(toRemove, evictable.length); i++) {
      const [k, e] = evictable[i];
      URL.revokeObjectURL(e.url);
      this.entries.delete(k);
    }
  }

  clear(): void {
    for (const entry of this.entries.values()) {
      URL.revokeObjectURL(entry.url);
    }
    this.entries.clear();
    this.accessCounter = 0;
  }

  get size(): number {
    return this.entries.size;
  }
}

export const imageCache = new ImageCache(96);
export const thumbnailCache = new ImageCache(256);
