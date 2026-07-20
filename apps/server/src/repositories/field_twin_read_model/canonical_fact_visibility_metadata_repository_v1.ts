// apps/server/src/repositories/field_twin_read_model/canonical_fact_visibility_metadata_repository_v1.ts
// Purpose: read and validate the CAP-07 non-canonical visibility epoch/index support from one caller-owned read-only PostgreSQL transaction.
// Boundary: SELECT-only repository; no transaction ownership, DDL/DML, raw xmin authority, timestamp fallback, or application-supplied visibility anchors.

import type { PoolClient } from "pg";
import {
  buildCanonicalVisibilitySnapshotV1,
  validateCanonicalVisibilitySnapshotV1,
} from "../../domain/field_twin_read_model/cursor_contracts_v1.js";
import type { FieldTwinCanonicalVisibilitySnapshotV1 } from "../../domain/field_twin_read_model/contracts_v1.js";
import { canonicalJsonV1 } from "../../domain/twin_runtime/canonical_json_v1.js";

export type CanonicalVisibleFactRowV1 = {
  fact_id: string;
  occurred_at: Date | string;
  source: string;
  record_json: unknown;
  visibility_epoch_id: string;
  visibility_anchor_xid8: string;
  visibility_anchor_kind:
    | "FACT_INSERT_TRANSACTION"
    | "INITIAL_BASELINE_TRANSACTION"
    | "EPOCH_ROTATION_TRANSACTION";
};

export class CanonicalFactVisibilityMetadataRepositoryErrorV1 extends Error {
  constructor(readonly code: string, detail?: string) {
    super(detail ? `${code}:${detail}` : code);
    this.name = "CanonicalFactVisibilityMetadataRepositoryErrorV1";
  }
}

function fail(code: string, detail?: string): never {
  throw new CanonicalFactVisibilityMetadataRepositoryErrorV1(code, detail);
}

async function readSnapshotPartsV1(
  client: PoolClient,
  snapshotTokenSql: string,
  params: readonly unknown[],
): Promise<{
  pg_snapshot_token: string;
  snapshot_xmin: string;
  snapshot_xmax: string;
  snapshot_xip_values: string[];
}> {
  const result = await client.query<{
    pg_snapshot_token: string;
    snapshot_xmin: string;
    snapshot_xmax: string;
    snapshot_xip_values: string[];
  }>(`
    WITH snapshot AS (
      SELECT ${snapshotTokenSql} AS value
    )
    SELECT snapshot.value::text AS pg_snapshot_token,
           pg_catalog.pg_snapshot_xmin(snapshot.value)::text AS snapshot_xmin,
           pg_catalog.pg_snapshot_xmax(snapshot.value)::text AS snapshot_xmax,
           ARRAY(
             SELECT xid_value::text
               FROM pg_catalog.pg_snapshot_xip(snapshot.value) AS xid_value
              ORDER BY xid_value ASC
           ) AS snapshot_xip_values
      FROM snapshot
  `, [...params]);
  const row = result.rows[0];
  if (!row) fail("MCFT_CANONICAL_VISIBILITY_METADATA_NOT_ESTABLISHED", "SNAPSHOT_UNAVAILABLE");
  return row;
}

export class CanonicalVisibilitySnapshotResolverV1 {
  async resolveCurrent(
    client: PoolClient,
    databaseVisibilityEpochId: string,
  ): Promise<FieldTwinCanonicalVisibilitySnapshotV1> {
    const row = await readSnapshotPartsV1(client, "pg_catalog.pg_current_snapshot()", []);
    return buildCanonicalVisibilitySnapshotV1({
      database_visibility_epoch_id: databaseVisibilityEpochId,
      pg_snapshot_token: row.pg_snapshot_token,
      snapshot_xmin: row.snapshot_xmin,
      snapshot_xmax: row.snapshot_xmax,
      snapshot_xip_values_for_hash: row.snapshot_xip_values ?? [],
    });
  }

  async validateSignedSnapshot(
    client: PoolClient,
    snapshot: FieldTwinCanonicalVisibilitySnapshotV1,
  ): Promise<FieldTwinCanonicalVisibilitySnapshotV1> {
    validateCanonicalVisibilitySnapshotV1(snapshot);
    let row: Awaited<ReturnType<typeof readSnapshotPartsV1>>;
    try {
      row = await readSnapshotPartsV1(client, "$1::pg_snapshot", [snapshot.pg_snapshot_token]);
    } catch {
      fail("MCFT_CURSOR_VISIBILITY_SNAPSHOT_INVALID", "PG_SNAPSHOT_TOKEN");
    }
    const recomputed = buildCanonicalVisibilitySnapshotV1({
      database_visibility_epoch_id: snapshot.database_visibility_epoch_id,
      pg_snapshot_token: row.pg_snapshot_token,
      snapshot_xmin: row.snapshot_xmin,
      snapshot_xmax: row.snapshot_xmax,
      snapshot_xip_values_for_hash: row.snapshot_xip_values ?? [],
    });
    if (canonicalJsonV1(recomputed) !== canonicalJsonV1(snapshot)) {
      fail("MCFT_CURSOR_VISIBILITY_SNAPSHOT_INVALID", "TOKEN_DERIVATION_MISMATCH");
    }
    return recomputed;
  }
}

export class CanonicalFactVisibilityMetadataRepositoryV1 {
  constructor(private readonly snapshotResolver = new CanonicalVisibilitySnapshotResolverV1()) {}

  async resolveActiveEpochId(client: PoolClient): Promise<string> {
    const result = await client.query<{ visibility_epoch_id: string }>(`
      SELECT visibility_epoch_id
        FROM public.twin_fact_visibility_epoch_v1
       WHERE status = 'ACTIVE'
       ORDER BY visibility_epoch_id ASC
       LIMIT 2
    `);
    if (result.rowCount !== 1 || !result.rows[0]?.visibility_epoch_id) {
      fail("MCFT_VISIBILITY_ACTIVE_EPOCH_CARDINALITY_INVALID", String(result.rowCount ?? 0));
    }
    return result.rows[0].visibility_epoch_id;
  }

  resolveCurrentVisibilitySnapshot(
    client: PoolClient,
    databaseVisibilityEpochId: string,
  ): Promise<FieldTwinCanonicalVisibilitySnapshotV1> {
    return this.snapshotResolver.resolveCurrent(client, databaseVisibilityEpochId);
  }

  validateSignedVisibilitySnapshot(
    client: PoolClient,
    snapshot: FieldTwinCanonicalVisibilitySnapshotV1,
  ): Promise<FieldTwinCanonicalVisibilitySnapshotV1> {
    return this.snapshotResolver.validateSignedSnapshot(client, snapshot);
  }

  async assertExactFactMetadata(client: PoolClient, visibilityEpochId: string, factId: string): Promise<void> {
    const result = await client.query<{ count: string }>(
      `SELECT pg_catalog.count(*)::text AS count
         FROM public.twin_fact_visibility_index_v1
        WHERE visibility_epoch_id = $1 AND fact_id = $2`,
      [visibilityEpochId, factId],
    );
    if (result.rows[0]?.count !== "1") fail("MCFT_FACT_VISIBILITY_METADATA_INCONSISTENT", factId);
  }

  async readVisibleFactById(input: {
    client: PoolClient;
    visibility_epoch_id: string;
    pg_snapshot_token: string;
    fact_id: string;
  }): Promise<CanonicalVisibleFactRowV1 | null> {
    const result = await input.client.query<CanonicalVisibleFactRowV1>(
      `SELECT f.fact_id, f.occurred_at, f.source, f.record_json,
              v.visibility_epoch_id,
              v.visibility_anchor_xid8::text AS visibility_anchor_xid8,
              v.visibility_anchor_kind
         FROM public.facts AS f
         JOIN public.twin_fact_visibility_index_v1 AS v ON v.fact_id = f.fact_id
        WHERE v.visibility_epoch_id = $1
          AND f.fact_id = $2
          AND pg_catalog.pg_visible_in_snapshot(v.visibility_anchor_xid8, $3::pg_snapshot)`,
      [input.visibility_epoch_id, input.fact_id, input.pg_snapshot_token],
    );
    if ((result.rowCount ?? 0) > 1) fail("MCFT_FACT_VISIBILITY_METADATA_INCONSISTENT", input.fact_id);
    return result.rows[0] ?? null;
  }

  async readVisibleFactsByTypes(input: {
    client: PoolClient;
    visibility_epoch_id: string;
    pg_snapshot_token: string;
    record_types: readonly string[];
    limit_plus_one: number;
  }): Promise<readonly CanonicalVisibleFactRowV1[]> {
    if (!Number.isInteger(input.limit_plus_one) || input.limit_plus_one < 1 || input.limit_plus_one > 201) {
      fail("MCFT_COLLECTION_LIMIT_INVALID");
    }
    if (input.record_types.length < 1) return [];
    const result = await input.client.query<CanonicalVisibleFactRowV1>(
      `SELECT f.fact_id, f.occurred_at, f.source, f.record_json,
              v.visibility_epoch_id,
              v.visibility_anchor_xid8::text AS visibility_anchor_xid8,
              v.visibility_anchor_kind
         FROM public.facts AS f
         JOIN public.twin_fact_visibility_index_v1 AS v ON v.fact_id = f.fact_id
        WHERE v.visibility_epoch_id = $1
          AND pg_catalog.pg_visible_in_snapshot(v.visibility_anchor_xid8, $2::pg_snapshot)
          AND f.record_json->>'type' = ANY($3::text[])
        ORDER BY f.occurred_at DESC, f.fact_id ASC
        LIMIT $4`,
      [input.visibility_epoch_id, input.pg_snapshot_token, [...input.record_types], input.limit_plus_one],
    );
    return result.rows;
  }
}
