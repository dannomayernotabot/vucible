import { afterEach, describe, expect, it } from "vitest";
import {
  openHistoryDB,
  resetDbSingleton,
  createSession,
  appendRoundToSession,
  putRoundPlaceholder,
  finalizeRound,
  getRound,
  listRoundsBySession,
  listSessions,
  findOrphanRounds,
  markRoundOrphaned,
} from "./history";
import { DB_NAME } from "./schema";
import type { Round, RoundResult } from "./schema";
import { PNG_1x1 } from "@/test/fixtures/images";

afterEach(async () => {
  await resetDbSingleton();
  indexedDB.deleteDatabase(DB_NAME);
});

function makeRound(overrides: Partial<Round> = {}): Round {
  return {
    id: `round-${Date.now()}`,
    sessionId: "session-1",
    number: 1,
    promptSent: "test prompt",
    modelsEnabled: { openai: true, gemini: false },
    imageCount: 4,
    aspect: { kind: "discrete", ratio: "1:1" },
    openaiResults: [],
    geminiResults: [],
    selections: [],
    commentary: null,
    startedAt: new Date().toISOString(),
    settledAt: null,
    ...overrides,
  };
}

describe("openHistoryDB", () => {
  it("creates sessions and rounds object stores", async () => {
    const db = await openHistoryDB();
    expect(db.objectStoreNames.contains("sessions")).toBe(true);
    expect(db.objectStoreNames.contains("rounds")).toBe(true);
    db.close();
  });
});

describe("session CRUD", () => {
  it("createSession returns a session with ULID id", async () => {
    const session = await createSession("a mountain scene");
    expect(session.id.length).toBe(26);
    expect(session.originalPrompt).toBe("a mountain scene");
    expect(session.roundIds).toEqual([]);
  });

  it("appendRoundToSession adds round ID", async () => {
    const session = await createSession("test");
    await appendRoundToSession(session.id, "round-1");
    await appendRoundToSession(session.id, "round-2");
    const db = await openHistoryDB();
    const updated = await db.get("sessions", session.id);
    expect(updated.roundIds).toEqual(["round-1", "round-2"]);
    db.close();
  });

  it("appendRoundToSession throws for missing session", async () => {
    await openHistoryDB();
    await expect(
      appendRoundToSession("nonexistent", "round-1"),
    ).rejects.toThrow("Session nonexistent not found");
  });

  it("listSessions returns sessions in reverse chronological order", async () => {
    await createSession("first");
    await createSession("second");
    await createSession("third");
    const sessions = await listSessions();
    expect(sessions).toHaveLength(3);
    expect(sessions[0].originalPrompt).toBe("third");
    expect(sessions[2].originalPrompt).toBe("first");
  });

  it("listSessions respects limit", async () => {
    await createSession("a");
    await createSession("b");
    await createSession("c");
    const sessions = await listSessions(2);
    expect(sessions).toHaveLength(2);
  });
});

describe("round CRUD", () => {
  it("putRoundPlaceholder and getRound round-trip", async () => {
    const round = makeRound({ id: "round-rt" });
    await putRoundPlaceholder(round);
    const fetched = await getRound("round-rt");
    expect(fetched).toBeDefined();
    expect(fetched!.promptSent).toBe("test prompt");
  });

  it("finalizeRound overwrites placeholder", async () => {
    const placeholder = makeRound({ id: "round-fin", settledAt: null });
    await putRoundPlaceholder(placeholder);

    const finalized = makeRound({
      id: "round-fin",
      settledAt: "2026-04-28T10:00:00Z",
      openaiResults: [
        {
          status: "success",
          bytes: PNG_1x1.slice(0),
          thumbnail: PNG_1x1.slice(0),
          mimeType: "image/png",
          meta: {},
        },
      ],
    });
    await finalizeRound(finalized);

    const fetched = await getRound("round-fin");
    expect(fetched!.settledAt).toBe("2026-04-28T10:00:00Z");
    expect(fetched!.openaiResults).toHaveLength(1);
    expect((fetched!.openaiResults[0] as { status: "success" }).status).toBe("success");
  });

  it("listRoundsBySession returns matching rounds", async () => {
    await putRoundPlaceholder(makeRound({ id: "r1", sessionId: "s1", number: 1 }));
    await putRoundPlaceholder(makeRound({ id: "r2", sessionId: "s1", number: 2 }));
    await putRoundPlaceholder(makeRound({ id: "r3", sessionId: "s2", number: 1 }));

    const s1Rounds = await listRoundsBySession("s1");
    expect(s1Rounds).toHaveLength(2);

    const s2Rounds = await listRoundsBySession("s2");
    expect(s2Rounds).toHaveLength(1);
  });
});

describe("ArrayBuffer round-trip (§14.V)", () => {
  it("persisted bytes are not corrupted by post-write mutation", async () => {
    const originalBytes = PNG_1x1.slice(0);
    const bytesForWrite = PNG_1x1.slice(0);
    const round = makeRound({
      id: "round-ab",
      openaiResults: [
        {
          status: "success",
          bytes: bytesForWrite,
          thumbnail: PNG_1x1.slice(0),
          mimeType: "image/png",
          meta: {},
        },
      ],
    });

    await putRoundPlaceholder(round);

    const writeView = new Uint8Array(bytesForWrite);
    for (let i = 0; i < writeView.length; i++) {
      writeView[i] = 0xff;
    }

    const fetched = await getRound("round-ab");
    const result = fetched!.openaiResults[0] as { status: "success"; bytes: ArrayBuffer };
    const fetchedView = new Uint8Array(result.bytes);
    const originalView = new Uint8Array(originalBytes);
    expect(fetchedView.length).toBe(originalView.length);
    for (let i = 0; i < fetchedView.length; i++) {
      expect(fetchedView[i]).toBe(originalView[i]);
    }
  });
});

describe("orphan round handling", () => {
  it("findOrphanRounds returns unsettled rounds", async () => {
    await putRoundPlaceholder(makeRound({ id: "settled", settledAt: "2026-01-01T00:00:00Z" }));
    await putRoundPlaceholder(makeRound({ id: "orphan-1", settledAt: null }));
    await putRoundPlaceholder(makeRound({ id: "orphan-2", settledAt: null }));

    const orphans = await findOrphanRounds();
    expect(orphans).toHaveLength(2);
    expect(orphans.map((r: Round) => r.id).sort()).toEqual(["orphan-1", "orphan-2"]);
  });

  it("markRoundOrphaned converts loading slots to error and sets settledAt", async () => {
    const round = makeRound({
      id: "orphan-mark",
      openaiResults: [
        { status: "loading" } as unknown as RoundResult,
        { status: "loading" } as unknown as RoundResult,
      ],
    });
    await putRoundPlaceholder(round);
    await markRoundOrphaned(round, "Browser closed mid-generation");

    const fetched = await getRound("orphan-mark");
    expect(fetched!.settledAt).not.toBeNull();
    expect(fetched!.openaiResults).toHaveLength(2);
    expect((fetched!.openaiResults[0] as { status: "error" }).status).toBe("error");
  });
});
