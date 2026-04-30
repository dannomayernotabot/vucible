import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen, fireEvent, renderHook, act } from "@testing-library/react";
import { useRoundForm } from "./useRoundForm";
import { ModelToggle } from "./ModelToggle";
import { GenerateButton } from "./GenerateButton";
import { NewSessionButton } from "./NewSessionButton";

vi.mock("@/lib/storage/keys", () => ({
  getStorage: vi.fn(() => ({
    providers: {
      openai: { apiKey: "sk-test", tier: "tier2", ipm: 20, concurrencyCap: 5, validatedAt: "" },
      gemini: { apiKey: "AIza-test", tier: "tier1", ipm: 5, concurrencyCap: 5, validatedAt: "" },
    },
    defaults: {
      imageCount: 8,
      aspectRatio: { kind: "discrete", ratio: "1:1" },
      theme: "system",
    },
    schemaVersion: 1,
    createdAt: "",
  })),
}));

afterEach(cleanup);

describe("useRoundForm", () => {
  it("initializes with defaults from storage", () => {
    const { result } = renderHook(() => useRoundForm(false));
    expect(result.current.state.prompt).toBe("");
    expect(result.current.state.imageCount).toBe(8);
    expect(result.current.state.modelsEnabled.openai).toBe(true);
    expect(result.current.state.modelsEnabled.gemini).toBe(true);
  });

  it("updates prompt", () => {
    const { result } = renderHook(() => useRoundForm(false));
    act(() => {
      result.current.dispatch({ type: "set-prompt", prompt: "draw a cat" });
    });
    expect(result.current.state.prompt).toBe("draw a cat");
  });

  it("toggles model", () => {
    const { result } = renderHook(() => useRoundForm(false));
    act(() => {
      result.current.dispatch({ type: "toggle-model", provider: "openai" });
    });
    expect(result.current.state.modelsEnabled.openai).toBe(false);
  });

  it("rejects actions when isRunning", () => {
    const { result } = renderHook(() => useRoundForm(true));
    act(() => {
      result.current.dispatch({ type: "set-prompt", prompt: "should not change" });
    });
    expect(result.current.state.prompt).toBe("");
  });

  it("produces snapshot matching StartRoundInput", () => {
    const { result } = renderHook(() => useRoundForm(false));
    act(() => {
      result.current.dispatch({ type: "set-prompt", prompt: "test" });
      result.current.dispatch({ type: "set-image-count", count: 16 });
    });
    const snap = result.current.snapshot();
    expect(snap.prompt).toBe("test");
    expect(snap.count).toBe(16);
    expect(snap.modelsEnabled.openai).toBe(true);
  });

  it("resets to initial state", () => {
    const { result } = renderHook(() => useRoundForm(false));
    act(() => {
      result.current.dispatch({ type: "set-prompt", prompt: "test" });
    });
    act(() => {
      result.current.dispatch({ type: "reset" });
    });
    expect(result.current.state.prompt).toBe("");
  });
});

describe("ModelToggle", () => {
  it("renders provider label", () => {
    render(
      <ModelToggle
        provider="openai"
        enabled={true}
        onToggle={() => {}}
      />,
    );
    expect(screen.getByText("OpenAI")).toBeDefined();
  });

  it("fires onToggle on click", () => {
    const onToggle = vi.fn();
    render(
      <ModelToggle
        provider="openai"
        enabled={true}
        onToggle={onToggle}
      />,
    );
    fireEvent.click(screen.getByRole("switch"));
    expect(onToggle).toHaveBeenCalled();
  });

  it("disables when disabled prop is true", () => {
    render(
      <ModelToggle
        provider="openai"
        enabled={true}
        onToggle={() => {}}
        disabled={true}
      />,
    );
    const sw = screen.getByRole("switch");
    expect(
      sw.hasAttribute("disabled") || sw.getAttribute("aria-disabled") === "true",
    ).toBe(true);
  });
});

describe("GenerateButton", () => {
  it("renders Generate text when not running", () => {
    render(
      <GenerateButton
        isRunning={false}
        bothDisabled={false}
        promptEmpty={false}
        onGenerate={() => {}}
      />,
    );
    expect(screen.getByRole("button", { name: "Generate" })).toBeDefined();
  });

  it("renders Generating... when running", () => {
    render(
      <GenerateButton
        isRunning={true}
        bothDisabled={false}
        promptEmpty={false}
        onGenerate={() => {}}
      />,
    );
    expect(screen.getByText("Generating...")).toBeDefined();
  });

  it("disabled when both providers off", () => {
    render(
      <GenerateButton
        isRunning={false}
        bothDisabled={true}
        promptEmpty={false}
        onGenerate={() => {}}
      />,
    );
    const btn = screen.getByRole("button");
    expect(btn.hasAttribute("disabled")).toBe(true);
  });

  it("disabled when prompt empty", () => {
    render(
      <GenerateButton
        isRunning={false}
        bothDisabled={false}
        promptEmpty={true}
        onGenerate={() => {}}
      />,
    );
    const btn = screen.getByRole("button");
    expect(btn.hasAttribute("disabled")).toBe(true);
  });

  it("does not fire onGenerate when isRunning", () => {
    const onGenerate = vi.fn();
    render(
      <GenerateButton
        isRunning={true}
        bothDisabled={false}
        promptEmpty={false}
        onGenerate={onGenerate}
      />,
    );
    fireEvent.click(screen.getByRole("button"));
    expect(onGenerate).not.toHaveBeenCalled();
  });
});

describe("NewSessionButton", () => {
  it("renders when visible", () => {
    render(<NewSessionButton visible={true} onNewSession={() => {}} />);
    expect(screen.getByRole("button", { name: "New session" })).toBeDefined();
  });

  it("does not render when not visible", () => {
    const { container } = render(
      <NewSessionButton visible={false} onNewSession={() => {}} />,
    );
    expect(container.innerHTML).toBe("");
  });

  it("fires onNewSession on click", () => {
    const onNewSession = vi.fn();
    render(<NewSessionButton visible={true} onNewSession={onNewSession} />);
    fireEvent.click(screen.getByRole("button"));
    expect(onNewSession).toHaveBeenCalled();
  });
});
