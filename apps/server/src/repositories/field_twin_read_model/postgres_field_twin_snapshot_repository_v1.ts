// apps/server/src/repositories/field_twin_read_model/postgres_field_twin_snapshot_repository_v1.ts
// Purpose: provide one-connection, one-transaction, six-dimensional, REPEATABLE READ READ ONLY request snapshots for CAP-07 repositories and exact resolvers.
// Boundary: transaction orchestration and SELECT-only context construction; no cross-database stitching, writes, route behavior, historical pointer reselection, or long-lived MVCC snapshot export/import.

import type { Pool, PoolClient } from "pg";
import type {
  FieldTwinCanonicalVisibilitySnapshotV1,
  FieldTwinScopeV1,
} from "../../domain/field_twin_read_model/contracts_v1.js";
import { canonicalUtcInstantV1 } from "../../domain/field_twin_read_model/cursor_contracts_v1.js";
import { CanonicalFactVisibilityMetadataRepositoryV1 } from "./canonical_fact_visibility_metadata_repository_v1.js";

export type PostgresFieldTwinSnapshotContextV1 = {
  client: PoolClient;
  scope: FieldTwinScopeV1;
  response_started_at: ReturnType<typeof canonicalUtcInstantV1>;
  canonical_visibility_snapshot: FieldTwinCanonicalVisibilitySnapshotV1;
};

export class PostgresFieldTwinSnapshotRepositoryErrorV1 extends Error {
  constructor(readonly code: string, detail?: string) {
    super(detail ? `${code}:${detail}` : code);
    this.name = "PostgresFieldTwinSnapshotRepositoryErrorV1";
  }
}

function validateScopeV1(scope: FieldTwinScopeV1): FieldTwinScopeV1 {
  const orderedKeys = ["tenant_id", "project_id", "group_id", "field_id", "season_id", "zone_id"] as const;
  for (const key of orderedKeys) {
    if (!String(scope[key] || "").trim()) {
      throw new PostgresFieldTwinSnapshotRepositoryErrorV1("MCFT_SCOPE_INVALID", key);
    }
  }
  return Object.freeze({ ...scope });
}

function canonicalTimestamp(value: Date | string): ReturnType<typeof canonicalUtcInstantV1> {
  const date = value instanceof Date ? value : new Date(value);
  if (!Number.isFinite(date.getTime())) {
    throw new PostgresFieldTwinSnapshotRepositoryErrorV1("MCFT_RESPONSE_STARTED_AT_INVALID");
  }
  return canonicalUtcInstantV1(date.toISOString());
}

export class PostgresFieldTwinSnapshotRepositoryV1 {
  constructor(
    private readonly pool: Pool,
    private readonly visibilityRepository = new CanonicalFactVisibilityMetadataRepositoryV1(),
  ) {}

  async withReadOnlyRequestSnapshot<T>(
    scopeInput: FieldTwinScopeV1,
    operation: (context: PostgresFieldTwinSnapshotContextV1) => Promise<T>,
  ): Promise<T> {
    const scope = validateScopeV1(scopeInput);
    const client = await this.pool.connect();
    try {
      await client.query("BEGIN");
      await client.query("SET TRANSACTION ISOLATION LEVEL REPEATABLE READ READ ONLY");
      const transaction = await client.query<{
        response_started_at: Date | string;
        transaction_read_only: string;
        transaction_isolation: string;
      }>(`
        SELECT pg_catalog.transaction_timestamp() AS response_started_at,
               pg_catalog.current_setting('transaction_read_only') AS transaction_read_only,
               pg_catalog.current_setting('transaction_isolation') AS transaction_isolation
      `);
      const row = transaction.rows[0];
      if (!row || row.transaction_read_only !== "on" || row.transaction_isolation.toLowerCase() !== "repeatable read") {
        throw new PostgresFieldTwinSnapshotRepositoryErrorV1("MCFT_READ_TRANSACTION_CONTRACT_INVALID");
      }
      const activeEpochId = await this.visibilityRepository.resolveActiveEpochId(client);
      const visibilitySnapshot = await this.visibilityRepository.resolveCurrentVisibilitySnapshot(client, activeEpochId);
      const result = await operation({
        client,
        scope,
        response_started_at: canonicalTimestamp(row.response_started_at),
        canonical_visibility_snapshot: visibilitySnapshot,
      });
      await client.query("COMMIT");
      return result;
    } catch (error) {
      await client.query("ROLLBACK").catch(() => undefined);
      throw error;
    } finally {
      client.release();
    }
  }

  async withCursorContinuationTransaction<T>(input: {
    scope: FieldTwinScopeV1;
    signed_visibility_snapshot: FieldTwinCanonicalVisibilitySnapshotV1;
    operation: (context: PostgresFieldTwinSnapshotContextV1) => Promise<T>;
  }): Promise<T> {
    const scope = validateScopeV1(input.scope);
    const client = await this.pool.connect();
    try {
      await client.query("BEGIN");
      await client.query("SET TRANSACTION ISOLATION LEVEL REPEATABLE READ READ ONLY");
      const activeEpochId = await this.visibilityRepository.resolveActiveEpochId(client);
      if (activeEpochId !== input.signed_visibility_snapshot.database_visibility_epoch_id) {
        throw new PostgresFieldTwinSnapshotRepositoryErrorV1("MCFT_CURSOR_VISIBILITY_EPOCH_MISMATCH");
      }
      const validatedVisibilitySnapshot = await this.visibilityRepository.validateSignedVisibilitySnapshot(
        client,
        input.signed_visibility_snapshot,
      );
      const transaction = await client.query<{ response_started_at: Date | string }>(
        "SELECT pg_catalog.transaction_timestamp() AS response_started_at",
      );
      const result = await input.operation({
        client,
        scope,
        response_started_at: canonicalTimestamp(transaction.rows[0]?.response_started_at ?? ""),
        canonical_visibility_snapshot: validatedVisibilitySnapshot,
      });
      await client.query("COMMIT");
      return result;
    } catch (error) {
      await client.query("ROLLBACK").catch(() => undefined);
      throw error;
    } finally {
      client.release();
    }
  }
}
