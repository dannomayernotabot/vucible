import { describe, expect, it } from "vitest";
import {
  PNG_1x1,
  PNG_16x9_SAMPLE,
  PNG_9x16_SAMPLE,
  JPEG_SAMPLE,
  WEBP_SAMPLE,
  PNG_OVERSIZED,
  toBlob,
  toBase64,
  readPngDimensions,
} from "./images";
import {
  SEED_ULID_1,
  SEED_ULID_2,
  SEED_ULID_3,
} from "./ulid";
import {
  emptyDb,
  oneSessionTwoRounds,
  orphanRoundDb,
  migrationV0Db,
} from "./idb-snapshots";

const PNG_SIGNATURE = [137, 80, 78, 71, 13, 10, 26, 10];
const JPEG_SIGNATURE = [0xff, 0xd8, 0xff];
const WEBP_SIGNATURE_RIFF = [0x52, 0x49, 0x46, 0x46];

function hasSignature(buf: ArrayBuffer, sig: number[]): boolean {
  const u8 = new Uint8Array(buf);
  return sig.every((b, i) => u8[i] === b);
}

describe("image fixtures", () => {
  it("PNG_1x1: valid PNG with correct dimensions", () => {
    expect(hasSignature(PNG_1x1, PNG_SIGNATURE)).toBe(true);
    const dims = readPngDimensions(PNG_1x1);
    expect(dims).toEqual({ width: 1, height: 1 });
  });

  it("PNG_16x9_SAMPLE: valid 1024x576 PNG", () => {
    expect(hasSignature(PNG_16x9_SAMPLE, PNG_SIGNATURE)).toBe(true);
    const dims = readPngDimensions(PNG_16x9_SAMPLE);
    expect(dims).toEqual({ width: 1024, height: 576 });
  });

  it("PNG_9x16_SAMPLE: valid 576x1024 PNG", () => {
    expect(hasSignature(PNG_9x16_SAMPLE, PNG_SIGNATURE)).toBe(true);
    const dims = readPngDimensions(PNG_9x16_SAMPLE);
    expect(dims).toEqual({ width: 576, height: 1024 });
  });

  it("JPEG_SAMPLE: valid JPEG signature", () => {
    expect(hasSignature(JPEG_SAMPLE, JPEG_SIGNATURE)).toBe(true);
    expect(JPEG_SAMPLE.byteLength).toBeGreaterThan(0);
  });

  it("WEBP_SAMPLE: valid WebP RIFF signature", () => {
    expect(hasSignature(WEBP_SAMPLE, WEBP_SIGNATURE_RIFF)).toBe(true);
    const u8 = new Uint8Array(WEBP_SAMPLE);
    const webpTag = String.fromCharCode(u8[8], u8[9], u8[10], u8[11]);
    expect(webpTag).toBe("WEBP");
  });

  it("PNG_OVERSIZED: exceeds 5 MB", () => {
    expect(PNG_OVERSIZED.byteLength).toBeGreaterThan(5 * 1024 * 1024);
    expect(hasSignature(PNG_OVERSIZED, PNG_SIGNATURE)).toBe(true);
  });

  it("toBlob: creates a Blob with correct type", () => {
    const blob = toBlob(PNG_1x1, "image/png");
    expect(blob).toBeInstanceOf(Blob);
    expect(blob.type).toBe("image/png");
    expect(blob.size).toBe(PNG_1x1.byteLength);
  });

  it("toBase64: round-trips through atob", () => {
    const b64 = toBase64(PNG_1x1);
    expect(typeof b64).toBe("string");
    expect(b64.length).toBeGreaterThan(0);
    const decoded = atob(b64);
    expect(decoded.length).toBe(PNG_1x1.byteLength);
  });
});

describe("ULID seeds", () => {
  it("seeds are 26 characters and lexicographically ordered", () => {
    const seeds = [SEED_ULID_1, SEED_ULID_2, SEED_ULID_3];
    for (const s of seeds) {
      expect(s.length).toBe(26);
    }
    expect(SEED_ULID_1 < SEED_ULID_2).toBe(true);
    expect(SEED_ULID_2 < SEED_ULID_3).toBe(true);
  });
});

describe("IDB snapshots", () => {
  it("emptyDb: opens with sessions and rounds stores", async () => {
    const db = await emptyDb();
    expect(db.objectStoreNames.contains("sessions")).toBe(true);
    expect(db.objectStoreNames.contains("rounds")).toBe(true);
    const sessions = await db.getAll("sessions");
    expect(sessions).toEqual([]);
    db.close();
  });

  it("oneSessionTwoRounds: contains 1 session and 2 rounds", async () => {
    const db = await oneSessionTwoRounds();
    const sessions = await db.getAll("sessions");
    expect(sessions).toHaveLength(1);
    expect(sessions[0].originalPrompt).toBe("a serene mountain landscape");
    expect(sessions[0].roundIds).toHaveLength(2);

    const rounds = await db.getAll("rounds");
    expect(rounds).toHaveLength(2);
    expect(rounds[0].number).toBe(1);
    expect(rounds[1].number).toBe(2);

    const round1 = rounds[0];
    expect(round1.openaiResults).toHaveLength(2);
    expect(round1.geminiResults).toHaveLength(2);
    expect(round1.openaiResults[0].status).toBe("success");
    expect(round1.openaiResults[0].bytes.byteLength).toBeGreaterThan(0);

    const round2 = rounds[1];
    expect(round2.geminiResults[1].status).toBe("error");
    db.close();
  });

  it("orphanRoundDb: contains unsettled round with loading slots", async () => {
    const db = await orphanRoundDb();
    const rounds = await db.getAll("rounds");
    expect(rounds).toHaveLength(1);
    expect(rounds[0].settledAt).toBeNull();
    expect(rounds[0].openaiResults[0].status).toBe("loading");
    db.close();
  });

  it("migrationV0Db: contains legacy-shaped round", async () => {
    const db = await migrationV0Db();
    const rounds = await db.getAll("rounds");
    expect(rounds).toHaveLength(1);
    expect(rounds[0].id).toBe("legacy-round-001");
    expect(rounds[0]).toHaveProperty("prompt");
    expect(rounds[0]).toHaveProperty("images");
    db.close();
  });
});
