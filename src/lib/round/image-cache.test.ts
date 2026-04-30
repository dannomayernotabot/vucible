import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ImageCache } from "./image-cache";

let urlCounter = 0;
const revokedUrls: string[] = [];

beforeEach(() => {
  urlCounter = 0;
  revokedUrls.length = 0;
  vi.stubGlobal(
    "URL",
    {
      ...URL,
      createObjectURL: vi.fn(() => `blob:mock-${++urlCounter}`),
      revokeObjectURL: vi.fn((url: string) => revokedUrls.push(url)),
    },
  );
});

afterEach(() => {
  vi.unstubAllGlobals();
});

const BYTES = new ArrayBuffer(10);
const MIME = "image/png";

describe("ImageCache", () => {
  it("returns an object URL on first get", () => {
    const cache = new ImageCache(10);
    const url = cache.get("r1", "s0", BYTES, MIME);
    expect(url).toBe("blob:mock-1");
    expect(URL.createObjectURL).toHaveBeenCalledTimes(1);
  });

  it("returns the same URL for repeat get with same key", () => {
    const cache = new ImageCache(10);
    const url1 = cache.get("r1", "s0", BYTES, MIME);
    const url2 = cache.get("r1", "s0", BYTES, MIME);
    expect(url1).toBe(url2);
    expect(URL.createObjectURL).toHaveBeenCalledTimes(1);
  });

  it("returns different URLs for different keys", () => {
    const cache = new ImageCache(10);
    const url1 = cache.get("r1", "s0", BYTES, MIME);
    const url2 = cache.get("r1", "s1", BYTES, MIME);
    expect(url1).not.toBe(url2);
  });

  it("release decrements refcount; URL not revoked while refcount > 0", () => {
    const cache = new ImageCache(10);
    cache.get("r1", "s0", BYTES, MIME);
    cache.get("r1", "s0", BYTES, MIME);
    cache.release("r1", "s0");
    expect(revokedUrls).toHaveLength(0);
  });

  it("evicts oldest refcount-0 entry when cap reached", () => {
    const cache = new ImageCache(3);
    cache.get("r1", "s0", BYTES, MIME);
    cache.release("r1", "s0");
    cache.get("r1", "s1", BYTES, MIME);
    cache.release("r1", "s1");
    cache.get("r1", "s2", BYTES, MIME);
    cache.release("r1", "s2");

    cache.get("r1", "s3", BYTES, MIME);

    expect(revokedUrls).toContain("blob:mock-1");
    expect(cache.size).toBe(3);
  });

  it("does not evict entries with refcount > 0", () => {
    const cache = new ImageCache(2);
    cache.get("r1", "s0", BYTES, MIME);
    cache.get("r1", "s1", BYTES, MIME);

    cache.get("r1", "s2", BYTES, MIME);

    expect(revokedUrls).toHaveLength(0);
    expect(cache.size).toBe(3);
  });

  it("warns when cache exceeds 2x cap", () => {
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
    const cache = new ImageCache(2);

    for (let i = 0; i < 5; i++) {
      cache.get("r1", `s${i}`, BYTES, MIME);
    }

    expect(warnSpy).toHaveBeenCalledWith(
      expect.stringContaining("exceeds 2×"),
    );
    warnSpy.mockRestore();
  });

  it("returns empty string and warns for missing mimeType", () => {
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
    const cache = new ImageCache(10);
    const url = cache.get("r1", "s0", BYTES, "");
    expect(url).toBe("");
    expect(warnSpy).toHaveBeenCalledWith(
      expect.stringContaining("missing mimeType"),
    );
    warnSpy.mockRestore();
  });

  it("release is a no-op for unknown key", () => {
    const cache = new ImageCache(10);
    expect(() => cache.release("r1", "unknown")).not.toThrow();
  });

  it("refcount does not go below 0", () => {
    const cache = new ImageCache(10);
    cache.get("r1", "s0", BYTES, MIME);
    cache.release("r1", "s0");
    cache.release("r1", "s0");
    cache.release("r1", "s0");
    expect(revokedUrls).toHaveLength(0);
  });

  it("evicts LRU order (oldest first)", () => {
    const cache = new ImageCache(3);
    cache.get("r1", "s0", BYTES, MIME);
    cache.release("r1", "s0");
    cache.get("r1", "s1", BYTES, MIME);
    cache.release("r1", "s1");
    cache.get("r1", "s2", BYTES, MIME);
    cache.release("r1", "s2");

    cache.get("r1", "s0", BYTES, MIME);
    cache.release("r1", "s0");

    cache.get("r1", "s3", BYTES, MIME);

    expect(revokedUrls).toContain("blob:mock-2");
    expect(revokedUrls).not.toContain("blob:mock-1");
  });

  it("creates Blob with correct mimeType", () => {
    const cache = new ImageCache(10);
    cache.get("r1", "s0", BYTES, "image/webp");
    const blobArg = (URL.createObjectURL as ReturnType<typeof vi.fn>).mock
      .calls[0][0] as Blob;
    expect(blobArg.type).toBe("image/webp");
  });
});
