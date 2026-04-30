"use client";

import { useCallback, useRef } from "react";

interface SelectionOverlayProps {
  readonly selected: boolean;
  readonly selectionIndex: number | null;
  readonly disabled: boolean;
  readonly atMax: boolean;
  readonly onToggle: () => void;
  readonly children: React.ReactNode;
}

export function SelectionOverlay({
  selected,
  selectionIndex,
  disabled,
  atMax,
  onToggle,
  children,
}: SelectionOverlayProps) {
  const wrapperRef = useRef<HTMLDivElement>(null);

  const handleClick = useCallback(() => {
    if (disabled) return;
    if (!selected && atMax) {
      const el = wrapperRef.current;
      if (el && !window.matchMedia?.("(prefers-reduced-motion: reduce)").matches) {
        el.classList.remove("animate-shake");
        void el.offsetWidth;
        el.classList.add("animate-shake");
      }
      return;
    }
    onToggle();
  }, [disabled, selected, atMax, onToggle]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === "Enter" || e.key === " ") {
        e.preventDefault();
        handleClick();
      }
    },
    [handleClick],
  );

  return (
    <div
      ref={wrapperRef}
      role="checkbox"
      aria-checked={selected}
      aria-label={
        selected
          ? `Selected image ${(selectionIndex ?? 0) + 1} of 4`
          : "Select this image"
      }
      aria-disabled={disabled}
      tabIndex={disabled ? -1 : 0}
      className="group relative cursor-pointer"
      onClick={handleClick}
      onKeyDown={handleKeyDown}
    >
      {children}
      <div
        className={[
          "pointer-events-none absolute inset-0 rounded-lg border-2 transition-all",
          selected
            ? "border-primary bg-primary/10"
            : "border-transparent group-hover:border-primary/40 group-focus-visible:border-primary/40",
        ].join(" ")}
      />
      {selected && selectionIndex !== null && (
        <div className="absolute top-2 right-2 flex h-6 w-6 items-center justify-center rounded-full bg-primary text-xs font-bold text-primary-foreground">
          {selectionIndex + 1}
        </div>
      )}
    </div>
  );
}
