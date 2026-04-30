import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen, fireEvent, act } from "@testing-library/react";
import { CommentaryInput } from "./CommentaryInput";

const mockSelections: { provider: "openai" | "gemini"; index: number }[] = [];
let mockCommentary = "";
const mockSetCommentary = vi.fn((v: string) => {
  mockCommentary = v;
});

vi.mock("./RoundProvider", () => ({
  useRound: () => ({
    selections: mockSelections,
    commentary: mockCommentary,
    setCommentary: mockSetCommentary,
  }),
}));

afterEach(() => {
  cleanup();
  mockSelections.length = 0;
  mockCommentary = "";
  mockSetCommentary.mockClear();
});

describe("CommentaryInput", () => {
  it("renders nothing when no selections", () => {
    const { container } = render(<CommentaryInput />);
    expect(container.innerHTML).toBe("");
  });

  it("renders textarea when at least one selection exists", () => {
    mockSelections.push({ provider: "openai", index: 0 });
    render(<CommentaryInput />);
    expect(screen.getByLabelText("Optional commentary for next round")).toBeDefined();
  });

  it("calls setCommentary on input change", () => {
    mockSelections.push({ provider: "openai", index: 0 });
    render(<CommentaryInput />);
    const textarea = screen.getByLabelText("Optional commentary for next round");
    fireEvent.change(textarea, { target: { value: "more red" } });
    expect(mockSetCommentary).toHaveBeenCalledWith("more red");
  });

  it("preserves text across selection count changes", () => {
    mockSelections.push({ provider: "openai", index: 0 });
    mockCommentary = "existing text";
    const { rerender } = render(<CommentaryInput />);

    const textarea = screen.getByLabelText("Optional commentary for next round") as HTMLTextAreaElement;
    expect(textarea.value).toBe("existing text");

    mockSelections.push({ provider: "gemini", index: 1 });
    rerender(<CommentaryInput />);
    const textarea2 = screen.getByLabelText("Optional commentary for next round") as HTMLTextAreaElement;
    expect(textarea2.value).toBe("existing text");
  });

  it("shows placeholder text", () => {
    mockSelections.push({ provider: "openai", index: 0 });
    render(<CommentaryInput />);
    const textarea = screen.getByPlaceholderText(/more vibrant colors/);
    expect(textarea).toBeDefined();
  });
});
