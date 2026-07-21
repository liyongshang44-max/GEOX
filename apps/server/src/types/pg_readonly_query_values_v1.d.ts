// Purpose: preserve readonly query-value tuples across both pg Pool and ClientBase without breaking Pool | PoolClient call compatibility.
// Boundary: TypeScript overload compatibility only; no runtime code, SQL authority, database mutation, or transport behavior.

import type { QueryResult, QueryResultRow } from "pg";

declare module "pg" {
  interface ClientBase {
    query<R extends QueryResultRow = any>(queryText: string, values?: readonly unknown[]): Promise<QueryResult<R>>;
  }

  interface Pool {
    query<R extends QueryResultRow = any>(queryText: string, values?: readonly unknown[]): Promise<QueryResult<R>>;
  }
}
