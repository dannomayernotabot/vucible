import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen, fireEvent } from "@testing-library/react";
import { ImageCountPicker } from "./ImageCountPicker";
import { AspectRatioPicker } from "./AspectRatioPicker";
import { DiscreteRatioGrid } from "./parts/DiscreteRatioGrid";
import { FreeformRatioInput } from "./parts/FreeformRatioInput";
import type { AspectRatioConfig } from "@/lib/providers/types";

afterEach(cleanup);

describe("ImageCountPicker", () => {
  it("renders all count options", () => {
    render(<ImageCountPicker value={4} onChange={() => {}} />);
    expect(screen.getByRole("button", { name: "4 images" })).toBeDefined();
    expect(screen.getByRole("button", { name: "8 images" })).toBeDefined();
    expect(screen.getByRole("button", { name: "16 images" })).toBeDefined();
  });

  it("fires onChange with selected count", () => {
    const onChange = vi.fn();
    render(<ImageCountPicker value={4} onChange={onChange} />);
    fireEvent.click(screen.getByRole("button", { name: "8 images" }));
    expect(onChange).toHaveBeenCalledWith(8);
  });

  it("shows caption when count fits cap", () => {
    render(
      <ImageCountPicker
        value={4}
        onChange={() => {}}
        caps={[{ ipm: 20, label: "Gemini" }]}
      />,
    );
    expect(screen.getByText(/Gemini cap: 20\/min/)).toBeDefined();
  });

  it("shows warning when count exceeds cap", () => {
    render(
      <ImageCountPicker
        value={16}
        onChange={() => {}}
        caps={[{ ipm: 5, label: "Gemini" }]}
      />,
    );
    expect(screen.getByText(/rounds will queue/)).toBeDefined();
  });

  it("shows no caption without caps", () => {
    const { container } = render(
      <ImageCountPicker value={4} onChange={() => {}} />,
    );
    expect(container.querySelectorAll("p").length).toBe(0);
  });
});

describe("DiscreteRatioGrid", () => {
  it("renders all 10 ratio buttons", () => {
    render(<DiscreteRatioGrid value="1:1" onChange={() => {}} />);
    const radios = screen.getAllByRole("radio");
    expect(radios.length).toBe(10);
  });

  it("marks the selected ratio as checked", () => {
    render(<DiscreteRatioGrid value="16:9" onChange={() => {}} />);
    const btn = screen.getByRole("radio", { name: "16:9" });
    expect(btn.getAttribute("aria-checked")).toBe("true");
  });

  it("marks non-selected ratios as unchecked", () => {
    render(<DiscreteRatioGrid value="16:9" onChange={() => {}} />);
    const btn = screen.getByRole("radio", { name: "1:1" });
    expect(btn.getAttribute("aria-checked")).toBe("false");
  });

  it("fires onChange on click", () => {
    const onChange = vi.fn();
    render(<DiscreteRatioGrid value="1:1" onChange={onChange} />);
    fireEvent.click(screen.getByRole("radio", { name: "3:2" }));
    expect(onChange).toHaveBeenCalledWith("3:2");
  });

  it("has radiogroup role", () => {
    render(<DiscreteRatioGrid value="1:1" onChange={() => {}} />);
    expect(screen.getByRole("radiogroup", { name: "Aspect ratio" })).toBeDefined();
  });
});

describe("FreeformRatioInput", () => {
  it("renders width and height inputs", () => {
    render(
      <FreeformRatioInput
        width={800}
        height={600}
        onChangeWidth={() => {}}
        onChangeHeight={() => {}}
        onSelectPreset={() => {}}
      />,
    );
    const widthInput = screen.getByLabelText("Width") as HTMLInputElement;
    const heightInput = screen.getByLabelText("Height") as HTMLInputElement;
    expect(widthInput.value).toBe("800");
    expect(heightInput.value).toBe("600");
  });

  it("fires onChangeWidth for valid input", () => {
    const onChangeWidth = vi.fn();
    render(
      <FreeformRatioInput
        width={800}
        height={600}
        onChangeWidth={onChangeWidth}
        onChangeHeight={() => {}}
        onSelectPreset={() => {}}
      />,
    );
    fireEvent.change(screen.getByLabelText("Width"), {
      target: { value: "1024" },
    });
    expect(onChangeWidth).toHaveBeenCalledWith(1024);
  });

  it("ignores non-positive width input", () => {
    const onChangeWidth = vi.fn();
    render(
      <FreeformRatioInput
        width={800}
        height={600}
        onChangeWidth={onChangeWidth}
        onChangeHeight={() => {}}
        onSelectPreset={() => {}}
      />,
    );
    fireEvent.change(screen.getByLabelText("Width"), {
      target: { value: "0" },
    });
    expect(onChangeWidth).not.toHaveBeenCalled();
  });

  it("toggles preset grid visibility", () => {
    render(
      <FreeformRatioInput
        width={800}
        height={600}
        onChangeWidth={() => {}}
        onChangeHeight={() => {}}
        onSelectPreset={() => {}}
      />,
    );
    expect(screen.queryByRole("radiogroup")).toBeNull();
    fireEvent.click(screen.getByText("Quick presets"));
    expect(screen.getByRole("radiogroup")).toBeDefined();
    fireEvent.click(screen.getByText("Hide presets"));
    expect(screen.queryByRole("radiogroup")).toBeNull();
  });
});

describe("AspectRatioPicker", () => {
  it("renders DiscreteRatioGrid when geminiEnabled", () => {
    render(
      <AspectRatioPicker
        geminiEnabled={true}
        value={{ kind: "discrete", ratio: "1:1" }}
        onChange={() => {}}
      />,
    );
    expect(screen.getByRole("radiogroup", { name: "Aspect ratio" })).toBeDefined();
  });

  it("renders FreeformRatioInput when gemini disabled", () => {
    render(
      <AspectRatioPicker
        geminiEnabled={false}
        value={{ kind: "freeform", width: 800, height: 600 }}
        onChange={() => {}}
      />,
    );
    expect(screen.getByLabelText("Width")).toBeDefined();
    expect(screen.getByLabelText("Height")).toBeDefined();
  });

  it("switches from discrete to freeform on prop change", () => {
    const { rerender } = render(
      <AspectRatioPicker
        geminiEnabled={true}
        value={{ kind: "discrete", ratio: "16:9" }}
        onChange={() => {}}
      />,
    );
    expect(screen.getByRole("radiogroup")).toBeDefined();

    rerender(
      <AspectRatioPicker
        geminiEnabled={false}
        value={{ kind: "freeform", width: 1024, height: 576 }}
        onChange={() => {}}
      />,
    );
    expect(screen.queryByRole("radiogroup")).toBeNull();
    expect(screen.getByLabelText("Width")).toBeDefined();
  });

  it("emits discrete config from grid selection", () => {
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

  it("emits freeform config from width change", () => {
    const onChange = vi.fn();
    render(
      <AspectRatioPicker
        geminiEnabled={false}
        value={{ kind: "freeform", width: 800, height: 600 }}
        onChange={onChange}
      />,
    );
    fireEvent.change(screen.getByLabelText("Width"), {
      target: { value: "1200" },
    });
    expect(onChange).toHaveBeenCalledWith({
      kind: "freeform",
      width: 1200,
      height: 600,
    });
  });

  it("defaults to 1:1 when switching from freeform to discrete", () => {
    const onChange = vi.fn();
    render(
      <AspectRatioPicker
        geminiEnabled={true}
        value={{ kind: "freeform", width: 800, height: 600 }}
        onChange={onChange}
      />,
    );
    const selected = screen.getByRole("radio", { checked: true });
    expect(selected.getAttribute("aria-label")).toBe("1:1");
  });

  it("defaults to 1024x1024 when switching from discrete to freeform", () => {
    render(
      <AspectRatioPicker
        geminiEnabled={false}
        value={{ kind: "discrete", ratio: "16:9" }}
        onChange={() => {}}
      />,
    );
    const widthInput = screen.getByLabelText("Width") as HTMLInputElement;
    const heightInput = screen.getByLabelText("Height") as HTMLInputElement;
    expect(widthInput.value).toBe("1024");
    expect(heightInput.value).toBe("1024");
  });
});
