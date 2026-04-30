import { afterEach, describe, expect, it } from "vitest";
import { clearHistory } from "./purge";
import {
  openHistoryDB,
  resetDbSingleton,
  createSession,
  putRoundPlaceholder,
  listSessions,
  listRoundsBySession,
} from "./history";
import { DB_NAME } from "./schema";
import type { Round } from "./schema";

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

describe("clearHistory", () => {
  it("clears all sessions and rounds", async () => {
    await createSession("prompt 1");
    await createSession("prompt 2");
    await putRoundPlaceholder(makeRound({ id: "r1", sessionId: "s1" }));
    await putRoundPlaceholder(makeRound({ id: "r2", sessionId: "s1" }));

    const beforeSessions = await listSessions();
    expect(beforeSessions.length).toBeGreaterThan(0);

    await clearHistory();

    expect(await listSessions()).toEqual([]);
    expect(await listRoundsBySession("s1")).toEqual([]);
  });

  it("is safe to call on empty database", async () => {
    await openHistoryDB();
    await clearHistory();
    expect(await listSessions()).toEqual([]);
  });
});
