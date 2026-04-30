"use client";

export function ImageCardLoading() {
  return (
    <div
      className="aspect-square animate-pulse rounded-lg bg-muted motion-reduce:animate-none"
      role="status"
      aria-label="Loading image"
    />
  );
}
