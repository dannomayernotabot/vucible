/**
 * @vitest-environment jsdom
 */
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  cleanup,
  render,
  screen,
  fireEvent,
  waitFor,
  act,
} from "@testing-library/react";
import { http, HttpResponse } from "msw";
import { server } from "../../../vitest.setup";
import { OpenaiModelPicker } from "./OpenaiModelPicker";

afterEach(cleanup);

const MODELS_URL = "https://api.openai.com/v1/models";

const MOCK_MODELS_RESPONSE = {
  data: [
    { id: "gpt-4o", object: "model" },
    { id: "gpt-image-1", object: "model" },
    { id: "gpt-image-1.5", object: "model" },
    { id: "gpt-image-1-mini", object: "model" },
    { id: "gpt-image-2", object: "model" },
    { id: "chatgpt-image-latest", object: "model" },
    { id: "dall-e-3", object: "model" },
    { id: "dall-e-2", object: "model" },
    { id: "whisper-1", object: "model" },
    { id: "o1-preview", object: "model" },
  ],
};

function setupModelsHandler(response = MOCK_MODELS_RESPONSE, status = 200) {
  server.use(
    http.get(MODELS_URL, () => {
      return HttpResponse.json(response, { status });
    }),
  );
}

describe("OpenaiModelPicker", () => {
  it("shows loading skeleton then renders models", async () => {
    setupModelsHandler();
    const onSelect = vi.fn();

    render(
      <OpenaiModelPicker
        apiKey="sk-test"
        selected="gpt-image-1"
        onSelect={onSelect}
      />,
    );

    expect(screen.getByLabelText("Loading models")).toBeDefined();

    await waitFor(() => {
      expect(screen.getByRole("radiogroup")).toBeDefined();
    });

    expect(screen.getByLabelText("gpt-image-1")).toBeDefined();
    expect(screen.getByLabelText("gpt-image-1.5")).toBeDefined();
    expect(screen.getByLabelText("gpt-image-2")).toBeDefined();
    expect(screen.getByLabelText("dall-e-3")).toBeDefined();

    expect(screen.queryByText("gpt-4o")).toBeNull();
    expect(screen.queryByText("whisper-1")).toBeNull();
  });

  it("marks selected model with aria-checked", async () => {
    setupModelsHandler();

    render(
      <OpenaiModelPicker
        apiKey="sk-test"
        selected="gpt-image-1.5"
        onSelect={vi.fn()}
      />,
    );

    await waitFor(() => {
      expect(screen.getByRole("radiogroup")).toBeDefined();
    });

    const selected = screen.getByLabelText("gpt-image-1.5");
    expect(selected.getAttribute("aria-checked")).toBe("true");

    const other = screen.getByLabelText("gpt-image-1");
    expect(other.getAttribute("aria-checked")).toBe("false");
  });

  it("calls onSelect when a model is clicked", async () => {
    setupModelsHandler();
    const onSelect = vi.fn();

    render(
      <OpenaiModelPicker
        apiKey="sk-test"
        selected="gpt-image-1"
        onSelect={onSelect}
      />,
    );

    await waitFor(() => {
      expect(screen.getByRole("radiogroup")).toBeDefined();
    });

    fireEvent.click(screen.getByLabelText("gpt-image-1.5"));
    expect(onSelect).toHaveBeenCalledWith("gpt-image-1.5");
  });

  it("shows verification badge on gated models", async () => {
    setupModelsHandler();

    render(
      <OpenaiModelPicker
        apiKey="sk-test"
        selected="gpt-image-1"
        onSelect={vi.fn()}
      />,
    );

    await waitFor(() => {
      expect(screen.getByRole("radiogroup")).toBeDefined();
    });

    const badges = screen.getAllByText("Verification required");
    expect(badges.length).toBeGreaterThanOrEqual(2);

    expect(screen.getByText("Requires org verification")).toBeDefined();
  });

  it("shows model descriptions", async () => {
    setupModelsHandler();

    render(
      <OpenaiModelPicker
        apiKey="sk-test"
        selected="gpt-image-1"
        onSelect={vi.fn()}
      />,
    );

    await waitFor(() => {
      expect(screen.getByRole("radiogroup")).toBeDefined();
    });

    expect(screen.getByText("Standard quality")).toBeDefined();
    expect(screen.getByText("Higher quality")).toBeDefined();
    expect(screen.getByText("Newest model")).toBeDefined();
    expect(screen.getByText("Legacy DALL-E 3")).toBeDefined();
  });

  it("renders nothing on API error (silent fallback)", async () => {
    server.use(
      http.get(MODELS_URL, () => {
        return HttpResponse.json(
          { error: { message: "Unauthorized" } },
          { status: 401 },
        );
      }),
    );

    const { container } = render(
      <OpenaiModelPicker
        apiKey="sk-bad"
        selected="gpt-image-1"
        onSelect={vi.fn()}
      />,
    );

    await waitFor(() => {
      expect(screen.queryByLabelText("Loading models")).toBeNull();
    });

    expect(screen.queryByRole("radiogroup")).toBeNull();
    expect(container.children.length).toBe(0);
  });

  it("renders nothing when model list is empty", async () => {
    server.use(
      http.get(MODELS_URL, () => {
        return HttpResponse.json({ data: [{ id: "gpt-4o" }] });
      }),
    );

    const { container } = render(
      <OpenaiModelPicker
        apiKey="sk-test"
        selected="gpt-image-1"
        onSelect={vi.fn()}
      />,
    );

    await waitFor(() => {
      expect(screen.queryByLabelText("Loading models")).toBeNull();
    });

    expect(container.children.length).toBe(0);
  });

  it("separates ungated models before gated models", async () => {
    setupModelsHandler();

    render(
      <OpenaiModelPicker
        apiKey="sk-test"
        selected="gpt-image-1"
        onSelect={vi.fn()}
      />,
    );

    await waitFor(() => {
      expect(screen.getByRole("radiogroup")).toBeDefined();
    });

    const radios = screen.getAllByRole("radio");
    const labels = radios.map((r) => r.getAttribute("aria-label"));

    const dividerIdx = labels.findIndex(
      (l) => l?.startsWith("gpt-image-2") || l?.startsWith("chatgpt-image-"),
    );

    for (let i = 0; i < dividerIdx; i++) {
      expect(
        labels[i]?.startsWith("gpt-image-2") ||
          labels[i]?.startsWith("chatgpt-image-"),
      ).toBe(false);
    }
  });
});
