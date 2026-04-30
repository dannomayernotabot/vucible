const MIME_EXTENSIONS: Record<string, string> = {
  "image/png": "png",
  "image/jpeg": "jpg",
  "image/webp": "webp",
};

export function buildFilename(
  sessionId: string,
  roundN: number,
  slotIndex: number,
  mimeType: string,
): string {
  const ext = MIME_EXTENSIONS[mimeType] ?? "png";
  const shortId = sessionId.slice(0, 8);
  return `vucible-${shortId}-r${roundN}-${slotIndex}.${ext}`;
}

export function triggerDownload(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.style.display = "none";
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
