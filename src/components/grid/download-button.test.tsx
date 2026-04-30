import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen, fireEvent } from "@testing-library/react";

const mockTriggerDownload = vi.fn();

vi.mock("@/lib/round/download", () => ({
  buildFilename: (sid: string, roundN: number, idx: number, mime: string) => {
    const ext = mime === "image/jpeg" ? "jpg" : "png";
    return `vucible-${sid.slice(0, 8)}-r${roundN}-${idx}.${ext}`;
  },
  triggerDownload: (...args: unknown[]) => mockTriggerDownload(...args),
}));

vi.mock("@/lib/round/image-cache", () => ({
  imageCache: {
    get: () => "blob:mock-url",
    release: vi.fn(),
  },
}));

vi.mock("@/components/round/RoundProvider", () => ({
  useRound: () => ({
    round: { id: "r1", number: 2, sessionId: "sess12345678rest" },
    sessionId: "sess12345678rest",
  }),
}));

import { DownloadButton } from "./DownloadButton";
import { ImageCardSuccess } from "./ImageCardSuccess";

afterEach(() => {
  cleanup();
  mockTriggerDownload.mockClear();
});

describe("DownloadButton", () => {
  it("renders with download aria-label", () => {
    render(
      <DownloadButton
        slotKey="r1:openai:0"
        bytes={new ArrayBuffer(8)}
        mimeType="image/png"
      />,
    );
    expect(
      screen.getByRole("button", { name: "Download image" }),
    ).toBeDefined();
  });

  it("calls triggerDownload with correct filename and blob on click", () => {
    const bytes = new ArrayBuffer(8);
    render(
      <DownloadButton
        slotKey="r1:openai:2"
        bytes={bytes}
        mimeType="image/jpeg"
      />,
    );

    fireEvent.click(
      screen.getByRole("button", { name: "Download image" }),
    );

    expect(mockTriggerDownload).toHaveBeenCalledTimes(1);
    const [blob, filename] = mockTriggerDownload.mock.calls[0];
    expect(blob).toBeInstanceOf(Blob);
    expect(blob.type).toBe("image/jpeg");
    expect(filename).toBe("vucible-sess1234-r2-2.jpg");
  });
});

describe("ImageCardSuccess with DownloadButton", () => {
  it("renders download button alongside image", () => {
    render(
      <ImageCardSuccess
        roundId="r1"
        slotKey="r1:openai:0"
        bytes={new ArrayBuffer(8)}
        mimeType="image/png"
      />,
    );

    expect(screen.getByRole("img")).toBeDefined();
    expect(
      screen.getByRole("button", { name: "Download image" }),
    ).toBeDefined();
  });
});
