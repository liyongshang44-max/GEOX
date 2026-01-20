import { PgStore } from "./pg_store";

export type Store =
  | { kind: "pg"; pg: PgStore };

export function makeStoreFromEnv(): Store {
  const driver = (process.env.DB_DRIVER ?? "postgres").toLowerCase();
  if (driver !== "postgres") {
    throw new Error(`DB_DRIVER=${driver} not supported in Route A (postgres only)`);
  }
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("missing DATABASE_URL");
  return { kind: "pg", pg: new PgStore(url) };
}