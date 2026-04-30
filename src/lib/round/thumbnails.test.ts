import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import { computeScale, generateThumbnail } from "./thumbnails";

describe("computeScale", () => {
  it("preserves dimensions when both edges <= 320", () => {
    expect(computeScale(200, 150)).toEqual({ width: 200, height: 150 });
  });

  it("preserves square at exactly 320", () => {
    expect(computeScale(320, 320)).toEqual({ width: 320, height: 320 });
  });

  it("scales landscape to fit max edge", () => {
    const { width, height } = computeScale(1024, 576);
    expect(Math.max(width, height)).toBe(320);
    expect(width).toBe(320);
    expect(height).toBe(180);
  });

  it("scales portrait to fit max edge", () => {
    const { width, height } = computeScale(576, 1024);
    expect(Math.max(width, height)).toBe(320);
    expect(width).toBe(180);
    expect(height).toBe(320);
  });

  it("scales square to 320x320", () => {
    expect(computeScale(1024, 1024)).toEqual({ width: 320, height: 320 });
  });

  it("preserves aspect ratio", () => {
    const original = 1920 / 1080;
    const { width, height } = computeScale(1920, 1080);
    const scaled = width / height;
    expect(Math.abs(original - scaled)).toBeLessThan(0.02);
  });

  it("handles 1x1 input", () => {
    expect(computeScale(1, 1)).toEqual({ width: 1, height: 1 });
  });
});

describe("generateThumbnail", () => {
  let mockBitmap: {
    width: number;
    height: number;
    close: ReturnType<typeof vi.fn>;
  };
  let mockCtx: { drawImage: ReturnType<typeof vi.fn> };
  let mockCanvas: {
    getContext: ReturnType<typeof vi.fn>;
    convertToBlob: ReturnType<typeof vi.fn>;
  };

  beforeEach(() => {
    mockBitmap = { width: 1024, height: 576, close: vi.fn() };
    mockCtx = { drawImage: vi.fn() };
    mockCanvas = {
      getContext: vi.fn().mockReturnValue(mockCtx),
      convertToBlob: vi
        .fn()
        .mockResolvedValue(new Blob(["jpeg-bytes"], { type: "image/jpeg" })),
    };

    vi.stubGlobal(
      "createImageBitmap",
      vi.fn().mockResolvedValue(mockBitmap),
    );
    vi.stubGlobal(
      "OffscreenCanvas",
      class {
        width: number;
        height: number;
        constructor(w: number, h: number) {
          this.width = w;
          this.height = h;
        }
        getContext = mockCanvas.getContext;
        convertToBlob = mockCanvas.convertToBlob;
      },
    );
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("returns image/jpeg mimeType", async () => {
    const input = new ArrayBuffer(10);
    const result = await generateThumbnail(input, "image/png");
    expect(result.mimeType).toBe("image/jpeg");
  });

  it("draws at scaled dimensions for landscape input", async () => {
    await generateThumbnail(new ArrayBuffer(10), "image/png");
    expect(mockCtx.drawImage).toHaveBeenCalledWith(
      mockBitmap,
      0,
      0,
      320,
      180,
    );
  });

  it("draws bitmap onto canvas at scaled size", async () => {
    await generateThumbnail(new ArrayBuffer(10), "image/png");
    expect(mockCtx.drawImage).toHaveBeenCalledWith(
      mockBitmap,
      0,
      0,
      320,
      180,
    );
  });

  it("closes the bitmap after conversion", async () => {
    await generateThumbnail(new ArrayBuffer(10), "image/png");
    expect(mockBitmap.close).toHaveBeenCalledTimes(1);
  });

  it("converts to JPEG with quality 0.85", async () => {
    await generateThumbnail(new ArrayBuffer(10), "image/png");
    expect(mockCanvas.convertToBlob).toHaveBeenCalledWith({
      type: "image/jpeg",
      quality: 0.85,
    });
  });

  it("returns thumbnail as ArrayBuffer", async () => {
    const result = await generateThumbnail(new ArrayBuffer(10), "image/png");
    expect(result.thumbnail).toBeInstanceOf(ArrayBuffer);
    expect(result.thumbnail.byteLength).toBeGreaterThan(0);
  });

  it("falls back to HTMLCanvasElement when OffscreenCanvas unavailable", async () => {
    vi.stubGlobal("OffscreenCanvas", undefined);

    const mockHtmlCanvas = {
      width: 0,
      height: 0,
      getContext: vi.fn().mockReturnValue(mockCtx),
      toBlob: vi
        .fn()
        .mockImplementation(
          (cb: (b: Blob) => void, type: string, _q: number) => {
            cb(new Blob(["jpeg-fallback"], { type }));
          },
        ),
    };
    vi.spyOn(document, "createElement").mockReturnValue(
      mockHtmlCanvas as unknown as HTMLElement,
    );

    const result = await generateThumbnail(new ArrayBuffer(10), "image/webp");
    expect(result.mimeType).toBe("image/jpeg");
    expect(mockHtmlCanvas.toBlob).toHaveBeenCalled();
    expect(mockHtmlCanvas.width).toBe(320);
    expect(mockHtmlCanvas.height).toBe(180);
  });

  it("handles small images without upscaling", async () => {
    mockBitmap.width = 100;
    mockBitmap.height = 80;

    await generateThumbnail(new ArrayBuffer(10), "image/png");
    expect(mockCtx.drawImage).toHaveBeenCalledWith(
      mockBitmap,
      0,
      0,
      100,
      80,
    );
  });
});
