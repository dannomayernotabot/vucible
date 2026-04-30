import { describe, expect, it } from "vitest";
import { buildFilename } from "./download";

describe("buildFilename", () => {
  it("uses first 8 chars of sessionId", () => {
    const name = buildFilename("abcdef1234567890", 1, 0, "image/png");
    expect(name).toBe("vucible-abcdef12-r1-0.png");
  });

  it("maps image/jpeg to .jpg", () => {
    const name = buildFilename("session01234xxxx", 2, 3, "image/jpeg");
    expect(name).toBe("vucible-session0-r2-3.jpg");
  });

  it("maps image/webp to .webp", () => {
    const name = buildFilename("session01234xxxx", 1, 1, "image/webp");
    expect(name).toBe("vucible-session0-r1-1.webp");
  });

  it("falls back to .png for unknown MIME type", () => {
    const name = buildFilename("session01234xxxx", 3, 0, "image/bmp");
    expect(name).toBe("vucible-session0-r3-0.png");
  });

  it("handles short sessionId without error", () => {
    const name = buildFilename("abc", 1, 0, "image/png");
    expect(name).toBe("vucible-abc-r1-0.png");
  });
});
