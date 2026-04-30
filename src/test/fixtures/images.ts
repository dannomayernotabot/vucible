import { deflateSync } from "node:zlib";

function crc32(buf: Uint8Array): number {
  let crc = 0xffffffff;
  for (const byte of buf) {
    crc = crc ^ byte;
    for (let j = 0; j < 8; j++) {
      crc = (crc >>> 1) ^ (crc & 1 ? 0xedb88320 : 0);
    }
  }
  return (crc ^ 0xffffffff) >>> 0;
}

function u32be(n: number): Uint8Array {
  return new Uint8Array([(n >>> 24) & 0xff, (n >>> 16) & 0xff, (n >>> 8) & 0xff, n & 0xff]);
}

function pngChunk(type: string, data: Uint8Array): Uint8Array {
  const typeBytes = new TextEncoder().encode(type);
  const crcInput = new Uint8Array(typeBytes.length + data.length);
  crcInput.set(typeBytes, 0);
  crcInput.set(data, typeBytes.length);
  const len = u32be(data.length);
  const crcBytes = u32be(crc32(crcInput));
  const chunk = new Uint8Array(4 + 4 + data.length + 4);
  chunk.set(len, 0);
  chunk.set(typeBytes, 4);
  chunk.set(data, 8);
  chunk.set(crcBytes, 8 + data.length);
  return chunk;
}

type PixelFn = (x: number, y: number) => [number, number, number, number];

function createPng(width: number, height: number, pixel: PixelFn): ArrayBuffer {
  const signature = new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10]);

  const ihdrData = new Uint8Array(13);
  ihdrData.set(u32be(width), 0);
  ihdrData.set(u32be(height), 4);
  ihdrData[8] = 8; // bit depth
  ihdrData[9] = 6; // color type: RGBA
  ihdrData[10] = 0; // compression
  ihdrData[11] = 0; // filter
  ihdrData[12] = 0; // interlace
  const ihdr = pngChunk("IHDR", ihdrData);

  const rawRows = new Uint8Array(height * (1 + width * 4));
  for (let y = 0; y < height; y++) {
    const rowOffset = y * (1 + width * 4);
    rawRows[rowOffset] = 0; // filter: None
    for (let x = 0; x < width; x++) {
      const [r, g, b, a] = pixel(x, y);
      const px = rowOffset + 1 + x * 4;
      rawRows[px] = r;
      rawRows[px + 1] = g;
      rawRows[px + 2] = b;
      rawRows[px + 3] = a;
    }
  }
  const compressed = deflateSync(rawRows);
  const idat = pngChunk("IDAT", compressed);

  const iend = pngChunk("IEND", new Uint8Array(0));

  const png = new Uint8Array(signature.length + ihdr.length + idat.length + iend.length);
  let offset = 0;
  png.set(signature, offset); offset += signature.length;
  png.set(ihdr, offset); offset += ihdr.length;
  png.set(idat, offset); offset += idat.length;
  png.set(iend, offset);
  return png.buffer as ArrayBuffer;
}

const TRANSPARENT: PixelFn = () => [0, 0, 0, 0];

const FOUR_COLOR_GRADIENT: PixelFn = (x, y) => {
  const quadrant = (x < 512 ? 0 : 1) + (y < 288 ? 0 : 2);
  const colors: [number, number, number, number][] = [
    [255, 0, 0, 255],
    [0, 255, 0, 255],
    [0, 0, 255, 255],
    [255, 255, 0, 255],
  ];
  return colors[quadrant];
};

const FOUR_COLOR_PORTRAIT: PixelFn = (x, y) => {
  const quadrant = (x < 288 ? 0 : 1) + (y < 512 ? 0 : 2);
  const colors: [number, number, number, number][] = [
    [255, 0, 0, 255],
    [0, 255, 0, 255],
    [0, 0, 255, 255],
    [255, 255, 0, 255],
  ];
  return colors[quadrant];
};

export const PNG_1x1: ArrayBuffer = createPng(1, 1, TRANSPARENT);

export const PNG_16x9_SAMPLE: ArrayBuffer = createPng(1024, 576, FOUR_COLOR_GRADIENT);

export const PNG_9x16_SAMPLE: ArrayBuffer = createPng(576, 1024, FOUR_COLOR_PORTRAIT);

const JPEG_HEADER = new Uint8Array([
  0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46, 0x49, 0x46, 0x00, 0x01,
  0x01, 0x00, 0x00, 0x01, 0x00, 0x01, 0x00, 0x00,
  0xff, 0xdb, 0x00, 0x43, 0x00,
  0x08, 0x06, 0x06, 0x07, 0x06, 0x05, 0x08, 0x07,
  0x07, 0x07, 0x09, 0x09, 0x08, 0x0a, 0x0c, 0x14,
  0x0d, 0x0c, 0x0b, 0x0b, 0x0c, 0x19, 0x12, 0x13,
  0x0f, 0x14, 0x1d, 0x1a, 0x1f, 0x1e, 0x1d, 0x1a,
  0x1c, 0x1c, 0x20, 0x24, 0x2e, 0x27, 0x20, 0x22,
  0x2c, 0x23, 0x1c, 0x1c, 0x28, 0x37, 0x29, 0x2c,
  0x30, 0x31, 0x34, 0x34, 0x34, 0x1f, 0x27, 0x39,
  0x3d, 0x38, 0x32, 0x3c, 0x2e, 0x33, 0x34, 0x32,
  0xff, 0xc0, 0x00, 0x0b, 0x08, 0x00, 0x01, 0x00, 0x01, 0x01, 0x01, 0x11, 0x00,
  0xff, 0xc4, 0x00, 0x1f, 0x00, 0x00, 0x01, 0x05, 0x01, 0x01, 0x01, 0x01,
  0x01, 0x01, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00,
  0x00, 0x00, 0x01, 0x02, 0x03, 0x04, 0x05, 0x06,
  0x07, 0x08, 0x09, 0x0a, 0x0b,
  0xff, 0xda, 0x00, 0x08, 0x01, 0x01, 0x00, 0x00, 0x3f, 0x00, 0x7b, 0x40,
  0x1b, 0xff, 0xd9,
]);
export const JPEG_SAMPLE: ArrayBuffer = JPEG_HEADER.buffer.slice(
  JPEG_HEADER.byteOffset,
  JPEG_HEADER.byteOffset + JPEG_HEADER.byteLength,
) as ArrayBuffer;

const WEBP_HEADER = new Uint8Array([
  0x52, 0x49, 0x46, 0x46, // RIFF
  0x1a, 0x00, 0x00, 0x00, // file size - 8
  0x57, 0x45, 0x42, 0x50, // WEBP
  0x56, 0x50, 0x38, 0x20, // VP8
  0x0e, 0x00, 0x00, 0x00, // chunk size
  0x30, 0x01, 0x00, 0x9d, 0x01, 0x2a, 0x01, 0x00,
  0x01, 0x00, 0x01, 0x40, 0x25, 0xa4, 0x00, 0x03,
  0x70, 0x00, 0xfe, 0xfb, 0x94, 0x00, 0x00,
]);
export const WEBP_SAMPLE: ArrayBuffer = WEBP_HEADER.buffer.slice(
  WEBP_HEADER.byteOffset,
  WEBP_HEADER.byteOffset + WEBP_HEADER.byteLength,
) as ArrayBuffer;

export function createOversizedPng(): ArrayBuffer {
  const small = createPng(2, 2, () => [128, 128, 128, 255]);
  const padded = new Uint8Array(5 * 1024 * 1024 + 1);
  const smallBytes = new Uint8Array(small);
  padded.set(smallBytes, 0);
  return padded.buffer as ArrayBuffer;
}
export const PNG_OVERSIZED: ArrayBuffer = createOversizedPng();

export function toBlob(bytes: ArrayBuffer, mimeType: string): Blob {
  return new Blob([bytes], { type: mimeType });
}

export function toBase64(bytes: ArrayBuffer): string {
  const u8 = new Uint8Array(bytes);
  let binary = "";
  for (let i = 0; i < u8.length; i++) {
    binary += String.fromCharCode(u8[i]);
  }
  return btoa(binary);
}

export function readPngDimensions(buf: ArrayBuffer): { width: number; height: number } {
  const view = new DataView(buf);
  return {
    width: view.getUint32(16),
    height: view.getUint32(20),
  };
}
