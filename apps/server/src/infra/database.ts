import { Pool } from "pg";

export function createDatabasePool(databaseUrl?: string): Pool {
  const resolvedDatabaseUrl = databaseUrl ?? process.env.DATABASE_URL ?? "";
  if (!resolvedDatabaseUrl) {
    throw new Error("Missing DATABASE_URL (expected postgres://user:pass@host:5432/db)");
  }

  return new Pool({ connectionString: resolvedDatabaseUrl });
}
