/**
 * @vitest-environment jsdom
 *
 * Validates ARIA roles, labels, and keyboard interaction across key components.
 */
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen, fireEvent } from "@testing-library/react";
import { ImageCardLoading } from "./grid/ImageCardLoading";
import { ImageCardError } from "./grid/ImageCardError";
import { SelectionOverlay } from "./grid/SelectionOverlay";
import type { NormalizedError } from "@/lib/providers/errors";

vi.mock("@/lib/round/failures", async () => {
  const actual = await vi.importActual<typeof import("@/lib/round/failures")>(
    "@/lib/round/failures",
  );
  return actual;
});

afterEach(cleanup);

describe("ARIA: loading states", () => {
  it("ImageCardLoading has role=status and accessible name", () => {
    render(<ImageCardLoading />);
    const el = screen.getByRole("status");
    expect(el.getAttribute("aria-label")).toBe("Loading image");
  });
});

describe("ARIA: error states", () => {
  it("ImageCardError has role=alert", () => {
    const error: NormalizedError = { kind: "server_error", message: "fail" };
    render(<ImageCardError error={error} />);
    expect(screen.getByRole("alert")).toBeDefined();
  });

  it("error message is visible text within alert", () => {
    const error: NormalizedError = { kind: "auth_failed", message: "bad key" };
    render(<ImageCardError error={error} />);
    const alert = screen.getByRole("alert");
    expect(alert.textContent).toContain("Invalid API key");
  });
});

describe("ARIA: selection overlay", () => {
  it("has role=checkbox with correct aria-checked", () => {
    render(
      <SelectionOverlay
        selected={false}
        selectionIndex={null}
        disabled={false}
        atMax={false}
        onToggle={vi.fn()}
      >
        <span>child</span>
      </SelectionOverlay>,
    );
    const cb = screen.getByRole("checkbox");
    expect(cb.getAttribute("aria-checked")).toBe("false");
  });

  it("selected state reflected in aria-checked", () => {
    render(
      <SelectionOverlay
        selected={true}
        selectionIndex={0}
        disabled={false}
        atMax={false}
        onToggle={vi.fn()}
      >
        <span>child</span>
      </SelectionOverlay>,
    );
    expect(screen.getByRole("checkbox", { checked: true })).toBeDefined();
  });

  it("disabled state reflected in aria-disabled", () => {
    render(
      <SelectionOverlay
        selected={false}
        selectionIndex={null}
        disabled={true}
        atMax={false}
        onToggle={vi.fn()}
      >
        <span>child</span>
      </SelectionOverlay>,
    );
    const cb = screen.getByRole("checkbox");
    expect(cb.getAttribute("aria-disabled")).toBe("true");
  });

  it("has descriptive aria-label when not selected", () => {
    render(
      <SelectionOverlay
        selected={false}
        selectionIndex={null}
        disabled={false}
        atMax={false}
        onToggle={vi.fn()}
      >
        <span>child</span>
      </SelectionOverlay>,
    );
    const cb = screen.getByRole("checkbox");
    expect(cb.getAttribute("aria-label")).toBe("Select this image");
  });

  it("has descriptive aria-label when selected with position", () => {
    render(
      <SelectionOverlay
        selected={true}
        selectionIndex={2}
        disabled={false}
        atMax={false}
        onToggle={vi.fn()}
      >
        <span>child</span>
      </SelectionOverlay>,
    );
    const cb = screen.getByRole("checkbox");
    expect(cb.getAttribute("aria-label")).toBe("Selected image 3 of 4");
  });

  it("is focusable via tabIndex when not disabled", () => {
    render(
      <SelectionOverlay
        selected={false}
        selectionIndex={null}
        disabled={false}
        atMax={false}
        onToggle={vi.fn()}
      >
        <span>child</span>
      </SelectionOverlay>,
    );
    const cb = screen.getByRole("checkbox");
    expect(cb.getAttribute("tabindex")).toBe("0");
  });

  it("is not focusable when disabled", () => {
    render(
      <SelectionOverlay
        selected={false}
        selectionIndex={null}
        disabled={true}
        atMax={false}
        onToggle={vi.fn()}
      >
        <span>child</span>
      </SelectionOverlay>,
    );
    const cb = screen.getByRole("checkbox");
    expect(cb.getAttribute("tabindex")).toBe("-1");
  });

  it("toggles on Enter key", () => {
    const toggle = vi.fn();
    render(
      <SelectionOverlay
        selected={false}
        selectionIndex={null}
        disabled={false}
        atMax={false}
        onToggle={toggle}
      >
        <span>child</span>
      </SelectionOverlay>,
    );
    fireEvent.keyDown(screen.getByRole("checkbox"), { key: "Enter" });
    expect(toggle).toHaveBeenCalledOnce();
  });

  it("toggles on Space key", () => {
    const toggle = vi.fn();
    render(
      <SelectionOverlay
        selected={false}
        selectionIndex={null}
        disabled={false}
        atMax={false}
        onToggle={toggle}
      >
        <span>child</span>
      </SelectionOverlay>,
    );
    fireEvent.keyDown(screen.getByRole("checkbox"), { key: " " });
    expect(toggle).toHaveBeenCalledOnce();
  });
});
