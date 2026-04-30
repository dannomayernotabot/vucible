export type MigrationFn = (data: Record<string, unknown>) => Record<string, unknown>;

const migrations = new Map<number, MigrationFn>();

export function registerMigration(fromVersion: number, fn: MigrationFn): void {
  migrations.set(fromVersion, fn);
}

export const CURRENT_SCHEMA_VERSION = 1;

export function applyMigrations(
  stored: Record<string, unknown>,
  currentVersion: number = CURRENT_SCHEMA_VERSION,
): Record<string, unknown> | null {
  const version = stored.schemaVersion;
  if (typeof version !== "number" || !Number.isInteger(version) || version < 0) {
    return null;
  }
  if (version === currentVersion) {
    return stored;
  }
  if (version > currentVersion) {
    return null;
  }

  let data = { ...stored };
  for (let v = version; v < currentVersion; v++) {
    const migrate = migrations.get(v);
    if (!migrate) {
      return null;
    }
    data = migrate(data);
    data.schemaVersion = v + 1;
  }

  return data;
}

export { migrations as _migrations_for_testing };
