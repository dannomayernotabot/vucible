"use client";

export function ImageCardLoading() {
  return (
    <div
      className="aspect-square animate-pulse rounded-lg bg-muted"
      role="status"
      aria-label="Loading image"
    />
  );
}
