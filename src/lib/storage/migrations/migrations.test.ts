import { describe, expect, it, beforeEach } from "vitest";
import {
  applyMigrations,
  registerMigration,
  CURRENT_SCHEMA_VERSION,
  _migrations_for_testing,
} from "./index";

describe("applyMigrations", () => {
  beforeEach(() => {
    _migrations_for_testing.clear();
  });

  it("returns blob unchanged when schemaVersion matches current", () => {
    const stored = { schemaVersion: CURRENT_SCHEMA_VERSION, foo: "bar" };
    const result = applyMigrations(stored);
    expect(result).toEqual(stored);
  });

  it("returns null for missing schemaVersion", () => {
    expect(applyMigrations({})).toBeNull();
  });

  it("returns null for non-integer schemaVersion", () => {
    expect(applyMigrations({ schemaVersion: 1.5 })).toBeNull();
    expect(applyMigrations({ schemaVersion: "1" })).toBeNull();
  });

  it("returns null for negative schemaVersion", () => {
    expect(applyMigrations({ schemaVersion: -1 })).toBeNull();
  });

  it("returns null for schemaVersion above current", () => {
    expect(
      applyMigrations({ schemaVersion: CURRENT_SCHEMA_VERSION + 1 }),
    ).toBeNull();
  });

  it("applies a stub v0→v1 migration", () => {
    registerMigration(0, (data) => ({
      ...data,
      migrated: true,
    }));

    const stored = { schemaVersion: 0, foo: "original" };
    const result = applyMigrations(stored);

    expect(result).not.toBeNull();
    expect(result!.schemaVersion).toBe(1);
    expect(result!.migrated).toBe(true);
    expect(result!.foo).toBe("original");
  });

  it("returns null when migration is missing for a version gap", () => {
    const stored = { schemaVersion: 0, foo: "bar" };
    const result = applyMigrations(stored);
    expect(result).toBeNull();
  });

  it("chains multiple migrations in sequence", () => {
    registerMigration(0, (data) => ({ ...data, v1: true }));
    registerMigration(1, (data) => ({ ...data, v2: true }));

    const stored = { schemaVersion: 0 };
    const result = applyMigrations(stored, 2);

    expect(result).not.toBeNull();
    expect(result!.schemaVersion).toBe(2);
    expect(result!.v1).toBe(true);
    expect(result!.v2).toBe(true);
  });

  it("does not mutate the input object", () => {
    registerMigration(0, (data) => ({ ...data, added: true }));

    const stored = { schemaVersion: 0 };
    applyMigrations(stored);

    expect(stored).toEqual({ schemaVersion: 0 });
  });
});
