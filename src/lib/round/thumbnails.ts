const MAX_EDGE = 320;
const JPEG_QUALITY = 0.85;

export function computeScale(
  width: number,
  height: number,
): { width: number; height: number } {
  const maxDim = Math.max(width, height);
  if (maxDim <= MAX_EDGE) return { width, height };
  const scale = MAX_EDGE / maxDim;
  return {
    width: Math.round(width * scale),
    height: Math.round(height * scale),
  };
}

export async function generateThumbnail(
  bytes: ArrayBuffer,
  sourceMime: string,
): Promise<{ thumbnail: ArrayBuffer; mimeType: "image/jpeg" }> {
  const blob = new Blob([bytes], { type: sourceMime });
  const bitmap = await createImageBitmap(blob);
  const { width: bw, height: bh } = bitmap;
  const { width, height } = computeScale(bw, bh);

  let jpegBlob: Blob;

  if (typeof OffscreenCanvas !== "undefined") {
    const canvas = new OffscreenCanvas(width, height);
    const ctx = canvas.getContext("2d")!;
    ctx.drawImage(bitmap, 0, 0, width, height);
    jpegBlob = await canvas.convertToBlob({
      type: "image/jpeg",
      quality: JPEG_QUALITY,
    });
  } else {
    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext("2d")!;
    ctx.drawImage(bitmap, 0, 0, width, height);
    jpegBlob = await new Promise<Blob>((resolve) => {
      canvas.toBlob(
        (b) => resolve(b!),
        "image/jpeg",
        JPEG_QUALITY,
      );
    });
  }

  bitmap.close();
  const thumbnail = await jpegBlob.arrayBuffer();
  return { thumbnail, mimeType: "image/jpeg" };
}
