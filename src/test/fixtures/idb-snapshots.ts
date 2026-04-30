import { openDB, type IDBPDatabase } from "idb";
import { PNG_1x1 } from "./images";
import {
  SEED_ULID_1,
  SEED_ULID_2,
  SEED_ULID_3,
  SEED_ULID_4,
} from "./ulid";

const DB_NAME = "vucible-history";
const DB_VERSION = 1;

function upgradeDb(db: IDBPDatabase): void {
  const sessions = db.createObjectStore("sessions", { keyPath: "id" });
  sessions.createIndex("by_startedAt", "startedAt");

  const rounds = db.createObjectStore("rounds", { keyPath: "id" });
  rounds.createIndex("by_sessionId", "sessionId");
  rounds.createIndex("by_startedAt", "startedAt");
}

export async function emptyDb(): Promise<IDBPDatabase> {
  const name = `${DB_NAME}-empty-${Date.now()}`;
  return openDB(name, DB_VERSION, { upgrade: upgradeDb });
}

export async function oneSessionTwoRounds(): Promise<IDBPDatabase> {
  const name = `${DB_NAME}-one-session-${Date.now()}`;
  const db = await openDB(name, DB_VERSION, { upgrade: upgradeDb });

  const session = {
    id: SEED_ULID_1,
    startedAt: "2026-04-28T10:00:00.000Z",
    originalPrompt: "a serene mountain landscape",
    roundIds: [SEED_ULID_2, SEED_ULID_3],
  };
  await db.put("sessions", session);

  const thumbBytes = PNG_1x1.slice(0);

  const round1 = {
    id: SEED_ULID_2,
    sessionId: SEED_ULID_1,
    number: 1,
    promptSent: "a serene mountain landscape",
    modelsEnabled: { openai: true, gemini: true },
    imageCount: 4,
    aspect: { kind: "discrete" as const, ratio: "1:1" as const },
    openaiResults: [
      { status: "success", bytes: PNG_1x1.slice(0), thumbnail: thumbBytes.slice(0), mimeType: "image/png", meta: {} },
      { status: "success", bytes: PNG_1x1.slice(0), thumbnail: thumbBytes.slice(0), mimeType: "image/png", meta: {} },
    ],
    geminiResults: [
      { status: "success", bytes: PNG_1x1.slice(0), thumbnail: thumbBytes.slice(0), mimeType: "image/jpeg", meta: {} },
      { status: "success", bytes: PNG_1x1.slice(0), thumbnail: thumbBytes.slice(0), mimeType: "image/jpeg", meta: {} },
    ],
    selections: [
      { provider: "openai" as const, index: 0 },
      { provider: "gemini" as const, index: 1 },
    ],
    commentary: "I like the mountain in #1 and the colors in #4",
    startedAt: "2026-04-28T10:00:01.000Z",
    settledAt: "2026-04-28T10:00:30.000Z",
  };
  await db.put("rounds", round1);

  const round2 = {
    id: SEED_ULID_3,
    sessionId: SEED_ULID_1,
    number: 2,
    promptSent: "a serene mountain landscape\n\nAfter round 1, the user selected the 2 attached images.\nTheir feedback: \"I like the mountain in #1 and the colors in #4\"\n\nEvolve from these references.",
    modelsEnabled: { openai: true, gemini: true },
    imageCount: 4,
    aspect: { kind: "discrete" as const, ratio: "1:1" as const },
    openaiResults: [
      { status: "success", bytes: PNG_1x1.slice(0), thumbnail: thumbBytes.slice(0), mimeType: "image/png", meta: {} },
      { status: "success", bytes: PNG_1x1.slice(0), thumbnail: thumbBytes.slice(0), mimeType: "image/png", meta: {} },
    ],
    geminiResults: [
      { status: "success", bytes: PNG_1x1.slice(0), thumbnail: thumbBytes.slice(0), mimeType: "image/jpeg", meta: {} },
      { status: "error" as const, error: { code: "CONTENT_BLOCKED", message: "Content blocked by safety filter" } },
    ],
    selections: [],
    commentary: null,
    startedAt: "2026-04-28T10:01:00.000Z",
    settledAt: "2026-04-28T10:01:25.000Z",
  };
  await db.put("rounds", round2);

  return db;
}

export async function orphanRoundDb(): Promise<IDBPDatabase> {
  const name = `${DB_NAME}-orphan-${Date.now()}`;
  const db = await openDB(name, DB_VERSION, { upgrade: upgradeDb });

  const orphanRound = {
    id: SEED_ULID_4,
    sessionId: SEED_ULID_1,
    number: 1,
    promptSent: "a logo for project X",
    modelsEnabled: { openai: true, gemini: false },
    imageCount: 4,
    aspect: { kind: "discrete" as const, ratio: "1:1" as const },
    openaiResults: [
      { status: "loading" },
      { status: "loading" },
      { status: "loading" },
      { status: "loading" },
    ],
    geminiResults: [],
    selections: [],
    commentary: null,
    startedAt: "2026-04-28T09:00:00.000Z",
    settledAt: null,
  };
  await db.put("rounds", orphanRound);

  return db;
}

export async function migrationV0Db(): Promise<IDBPDatabase> {
  const name = `${DB_NAME}-v0-${Date.now()}`;
  const db = await openDB(name, 1, {
    upgrade(db) {
      db.createObjectStore("rounds", { keyPath: "id" });
    },
  });

  const v0Round = {
    id: "legacy-round-001",
    prompt: "old format prompt",
    images: [{ data: PNG_1x1.slice(0), model: "openai" }],
    selectedIndices: [0],
    timestamp: "2026-04-20T00:00:00.000Z",
  };
  await db.put("rounds", v0Round);

  return db;
}
