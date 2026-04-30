import { describe, expect, it } from "vitest";
import { monotonicFactory } from "ulid";
import { openDB } from "idb";
import { http, HttpResponse } from "msw";
import { server } from "../../vitest.setup";

describe("dependency smoke tests", () => {
  it("ulid: monotonicFactory produces sortable IDs", () => {
    const monotonic = monotonicFactory();
    const a = monotonic();
    const b = monotonic();
    expect(a.length).toBe(26);
    expect(b.length).toBe(26);
    expect(b > a).toBe(true);
  });

  it("idb + fake-indexeddb: round-trip write/read", async () => {
    const db = await openDB("smoke-test", 1, {
      upgrade(db) {
        db.createObjectStore("items", { keyPath: "id" });
      },
    });
    await db.put("items", { id: "test-1", value: "hello" });
    const result = await db.get("items", "test-1");
    expect(result).toEqual({ id: "test-1", value: "hello" });
    db.close();
  });

  it("msw: intercepts fetch and returns mock response", async () => {
    server.use(
      http.get("https://api.example.com/test", () => {
        return HttpResponse.json({ ok: true, data: "mocked" });
      }),
    );
    const res = await fetch("https://api.example.com/test");
    const body = await res.json();
    expect(body).toEqual({ ok: true, data: "mocked" });
  });
});
