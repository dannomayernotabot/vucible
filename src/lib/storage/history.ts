import { openDB, type IDBPDatabase } from "idb";
import { DB_NAME, DB_VERSION, generateId } from "./schema";
import type { Round, Session } from "./schema";

let dbPromise: Promise<IDBPDatabase> | null = null;

export function openHistoryDB(): Promise<IDBPDatabase> {
  if (!dbPromise) {
    dbPromise = openDB(DB_NAME, DB_VERSION, {
      upgrade(db) {
        const sessions = db.createObjectStore("sessions", { keyPath: "id" });
        sessions.createIndex("by_startedAt", "startedAt");

        const rounds = db.createObjectStore("rounds", { keyPath: "id" });
        rounds.createIndex("by_sessionId", "sessionId");
        rounds.createIndex("by_startedAt", "startedAt");
      },
    });
  }
  return dbPromise;
}

export async function resetDbSingleton(): Promise<void> {
  if (dbPromise) {
    const db = await dbPromise;
    db.close();
    dbPromise = null;
  }
}

export async function createSession(prompt: string): Promise<Session> {
  const db = await openHistoryDB();
  const session: Session = {
    id: generateId(),
    startedAt: new Date().toISOString(),
    originalPrompt: prompt,
    roundIds: [],
  };
  await db.put("sessions", session);
  return session;
}

export async function appendRoundToSession(
  sessionId: string,
  roundId: string,
): Promise<void> {
  const db = await openHistoryDB();
  const tx = db.transaction("sessions", "readwrite");
  const store = tx.objectStore("sessions");
  const session = await store.get(sessionId);
  if (!session) throw new Error(`Session ${sessionId} not found`);
  const updated = { ...session, roundIds: [...session.roundIds, roundId] };
  await store.put(updated);
  await tx.done;
}

export async function putRoundPlaceholder(round: Round): Promise<void> {
  const db = await openHistoryDB();
  await db.put("rounds", round);
}

export async function finalizeRound(round: Round): Promise<void> {
  const db = await openHistoryDB();
  await db.put("rounds", round);
}

export async function getRound(id: string): Promise<Round | undefined> {
  const db = await openHistoryDB();
  return db.get("rounds", id);
}

export async function listRoundsBySession(sessionId: string): Promise<Round[]> {
  const db = await openHistoryDB();
  return db.getAllFromIndex("rounds", "by_sessionId", sessionId);
}

export async function listSessions(limit?: number): Promise<Session[]> {
  const db = await openHistoryDB();
  const tx = db.transaction("sessions", "readonly");
  const index = tx.objectStore("sessions").index("by_startedAt");
  const sessions: Session[] = [];
  let cursor = await index.openCursor(null, "prev");
  while (cursor && (limit === undefined || sessions.length < limit)) {
    sessions.push(cursor.value as Session);
    cursor = await cursor.continue();
  }
  await tx.done;
  return sessions;
}

export async function findOrphanRounds(): Promise<Round[]> {
  const db = await openHistoryDB();
  const all = await db.getAll("rounds");
  return all.filter((r: Round) => r.settledAt === null);
}

export async function markRoundOrphaned(
  round: Round,
  reason: string,
): Promise<void> {
  const db = await openHistoryDB();
  const now = new Date().toISOString();
  const errorResult = {
    status: "error" as const,
    error: {
      kind: "unknown" as const,
      message: reason,
    },
  };
  const fixSlots = (results: readonly (typeof round.openaiResults)[number][]) =>
    results.map((r) =>
      "status" in r && r.status === "loading"
        ? errorResult
        : r,
    );
  const updated = {
    ...round,
    openaiResults: fixSlots(round.openaiResults),
    geminiResults: fixSlots(round.geminiResults),
    settledAt: now,
  };
  await db.put("rounds", updated);
}
