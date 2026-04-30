import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";

afterEach(cleanup);

import { ImageCountPicker } from "./ImageCountPicker";
import { AspectRatioPicker } from "./AspectRatioPicker";
import { DiscreteRatioGrid } from "./parts/DiscreteRatioGrid";
import { FreeformRatioInput } from "./parts/FreeformRatioInput";

describe("ImageCountPicker", () => {
  it("renders all three count options", () => {
    render(
      <ImageCountPicker value={4} onChange={vi.fn()} />,
    );
    expect(screen.getByLabelText("4 images")).toBeDefined();
    expect(screen.getByLabelText("8 images")).toBeDefined();
    expect(screen.getByLabelText("16 images")).toBeDefined();
  });

  it("shows no caption when caps is empty", () => {
    const { container } = render(
      <ImageCountPicker value={8} onChange={vi.fn()} caps={[]} />,
    );
    expect(container.querySelector("p")).toBeNull();
  });

  it("shows single-provider cap caption when count fits", () => {
    render(
      <ImageCountPicker
        value={8}
        onChange={vi.fn()}
        caps={[{ ipm: 20, label: "OpenAI" }]}
      />,
    );
    expect(screen.getByText("OpenAI cap: 20/min. 8/round will fit.")).toBeDefined();
  });

  it("shows combined cap caption for two providers", () => {
    render(
      <ImageCountPicker
        value={4}
        onChange={vi.fn()}
        caps={[
          { ipm: 20, label: "OpenAI" },
          { ipm: 5, label: "Gemini" },
        ]}
      />,
    );
    expect(
      screen.getByText("Default cap: 5/min combined. 4/round will fit."),
    ).toBeDefined();
  });

  it("shows queuing warning when count exceeds cap", () => {
    render(
      <ImageCountPicker
        value={16}
        onChange={vi.fn()}
        caps={[{ ipm: 5, label: "OpenAI" }]}
      />,
    );
    expect(
      screen.getByText("You'll hit your cap on this — rounds will queue."),
    ).toBeDefined();
  });
});

describe("AspectRatioPicker", () => {
  it("renders DiscreteRatioGrid when geminiEnabled", () => {
    render(
      <AspectRatioPicker
        geminiEnabled={true}
        value={{ kind: "discrete", ratio: "1:1" }}
        onChange={vi.fn()}
      />,
    );
    expect(screen.getByRole("radiogroup")).toBeDefined();
    expect(screen.queryByLabelText("Width")).toBeNull();
  });

  it("renders FreeformRatioInput when gemini is disabled", () => {
    render(
      <AspectRatioPicker
        geminiEnabled={false}
        value={{ kind: "freeform", width: 1024, height: 1024 }}
        onChange={vi.fn()}
      />,
    );
    expect(screen.getByLabelText("Width")).toBeDefined();
    expect(screen.getByLabelText("Height")).toBeDefined();
    expect(screen.queryByRole("radiogroup")).toBeNull();
  });

  it("defaults freeform value to 1024x1024 when switching from discrete", () => {
    render(
      <AspectRatioPicker
        geminiEnabled={false}
        value={{ kind: "discrete", ratio: "16:9" }}
        onChange={vi.fn()}
      />,
    );
    const widthInput = screen.getByLabelText("Width") as HTMLInputElement;
    expect(widthInput.value).toBe("1024");
  });

  it("defaults discrete value to 1:1 when switching from freeform", () => {
    render(
      <AspectRatioPicker
        geminiEnabled={true}
        value={{ kind: "freeform", width: 800, height: 600 }}
        onChange={vi.fn()}
      />,
    );
    const btn = screen.getByRole("radio", { name: "1:1" });
    expect(btn.getAttribute("aria-checked")).toBe("true");
  });

  it("fires onChange with discrete config when grid ratio selected", () => {
    const onChange = vi.fn();
    render(
      <AspectRatioPicker
        geminiEnabled={true}
        value={{ kind: "discrete", ratio: "1:1" }}
        onChange={onChange}
      />,
    );
    fireEvent.click(screen.getByRole("radio", { name: "16:9" }));
    expect(onChange).toHaveBeenCalledWith({ kind: "discrete", ratio: "16:9" });
  });
});

describe("DiscreteRatioGrid", () => {
  const EXPECTED_RATIOS = ["1:1", "3:2", "2:3", "3:4", "4:3", "4:5", "5:4", "9:16", "16:9", "21:9"];

  it("renders all 10 ratio buttons", () => {
    render(<DiscreteRatioGrid value="1:1" onChange={vi.fn()} />);
    for (const ratio of EXPECTED_RATIOS) {
      expect(screen.getByRole("radio", { name: ratio })).toBeDefined();
    }
  });

  it("marks the selected ratio as aria-checked", () => {
    render(<DiscreteRatioGrid value="16:9" onChange={vi.fn()} />);
    expect(
      screen.getByRole("radio", { name: "16:9" }).getAttribute("aria-checked"),
    ).toBe("true");
    expect(
      screen.getByRole("radio", { name: "1:1" }).getAttribute("aria-checked"),
    ).toBe("false");
  });

  it("calls onChange with clicked ratio", () => {
    const onChange = vi.fn();
    render(<DiscreteRatioGrid value="1:1" onChange={onChange} />);
    fireEvent.click(screen.getByRole("radio", { name: "9:16" }));
    expect(onChange).toHaveBeenCalledWith("9:16");
  });

  it("has accessible radiogroup container", () => {
    render(<DiscreteRatioGrid value="1:1" onChange={vi.fn()} />);
    expect(screen.getByRole("radiogroup", { name: "Aspect ratio" })).toBeDefined();
  });
});

describe("FreeformRatioInput", () => {
  it("renders width and height inputs with correct values", () => {
    render(
      <FreeformRatioInput
        width={800}
        height={600}
        onChangeWidth={vi.fn()}
        onChangeHeight={vi.fn()}
        onSelectPreset={vi.fn()}
      />,
    );
    expect((screen.getByLabelText("Width") as HTMLInputElement).value).toBe("800");
    expect((screen.getByLabelText("Height") as HTMLInputElement).value).toBe("600");
  });

  it("calls onChangeWidth with parsed integer", () => {
    const onChangeWidth = vi.fn();
    render(
      <FreeformRatioInput
        width={1024}
        height={1024}
        onChangeWidth={onChangeWidth}
        onChangeHeight={vi.fn()}
        onSelectPreset={vi.fn()}
      />,
    );
    fireEvent.change(screen.getByLabelText("Width"), { target: { value: "512" } });
    expect(onChangeWidth).toHaveBeenCalledWith(512);
  });

  it("calls onChangeHeight with parsed integer", () => {
    const onChangeHeight = vi.fn();
    render(
      <FreeformRatioInput
        width={1024}
        height={1024}
        onChangeWidth={vi.fn()}
        onChangeHeight={onChangeHeight}
        onSelectPreset={vi.fn()}
      />,
    );
    fireEvent.change(screen.getByLabelText("Height"), { target: { value: "768" } });
    expect(onChangeHeight).toHaveBeenCalledWith(768);
  });

  it("toggles preset grid on button click", () => {
    render(
      <FreeformRatioInput
        width={1024}
        height={1024}
        onChangeWidth={vi.fn()}
        onChangeHeight={vi.fn()}
        onSelectPreset={vi.fn()}
      />,
    );
    expect(screen.queryByRole("radiogroup")).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: /Quick presets/i }));
    expect(screen.getByRole("radiogroup")).toBeDefined();
    fireEvent.click(screen.getByRole("button", { name: /Hide presets/i }));
    expect(screen.queryByRole("radiogroup")).toBeNull();
  });
});
