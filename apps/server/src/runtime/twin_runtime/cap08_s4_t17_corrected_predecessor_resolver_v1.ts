// Purpose: resolve the exact MCFT-CAP-08.S4 corrected T16 predecessor for T17 exclusively from the immutable append-forward authority and canonical facts.
// Boundary: read-only Runtime resolution only; no persistence, pointer mutation, repair, lease, Tick execution, route, scheduler, Residual commit, Calibration, Shadow, or production Runtime authority.

import type { Pool } from "pg";
import {
  CAP08_S4_AUTHORITY_KIND_V1,
  CAP08_S4_AUTHORITY_SCHEMA_VERSION_V1,
  type Cap08S4AppendForwardAuthorityV1,
  type Cap08S4ScopeV1,
  type Cap08S4T17CorrectedPredecessorV1,
} from "../../domain/twin_runtime/cap08_s4_append_forward_contracts_v1.js";
import { PostgresCap08S4AppendForwardRepositoryV1 } from "../../persistence/twin_runtime/postgres_cap08_s4_append_forward_repository_v1.js";

function requiredStringV1(value: unknown, code: string): string {
  if (typeof value !== "string" || !value.trim()) throw new Error(code);
  return value;
}

function exactScopeV1(actual: Cap08S4ScopeV1, expected: Cap08S4ScopeV1): void {
  for (const field of [
    "tenant_id",
    "project_id",
    "group_id",
    "field_id",
    "season_id",
    "zone_id",
  ] as const) {
    if (actual[field] !== expected[field]) {
      throw new Error(`CAP08_S4_T17_SCOPE_MISMATCH:${field}`);
    }
  }
}

function parseAuthorityV1(value: unknown): Cap08S4AppendForwardAuthorityV1 {
  const parsed = typeof value === "string" ? JSON.parse(value) : value;
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
    throw new Error("CAP08_S4_T17_AUTHORITY_PAYLOAD_INVALID");
  }
  return structuredClone(parsed as Cap08S4AppendForwardAuthorityV1);
}

export class Cap08S4T17CorrectedPredecessorResolverV1 {
  private readonly repository: PostgresCap08S4AppendForwardRepositoryV1;

  constructor(private readonly pool: Pool) {
    this.repository = new PostgresCap08S4AppendForwardRepositoryV1(pool);
  }

  async resolve(input: {
    authority_ref: string;
    formal_run_id: string;
    scope: Cap08S4ScopeV1;
    expected_next_logical_time: string;
  }): Promise<Cap08S4T17CorrectedPredecessorV1> {
    const authorityRef = requiredStringV1(
      input.authority_ref,
      "CAP08_S4_T17_AUTHORITY_REF_REQUIRED",
    );
    const result = await this.pool.query(
      `SELECT determinism_hash,semantic_payload
         FROM twin_runtime_authority_snapshot_v1
        WHERE authority_kind=$1 AND authority_ref=$2`,
      [CAP08_S4_AUTHORITY_KIND_V1, authorityRef],
    );
    if (result.rows.length !== 1) {
      throw new Error("CAP08_S4_T17_AUTHORITY_CARDINALITY");
    }
    const authority = parseAuthorityV1(result.rows[0].semantic_payload);
    if (authority.schema_version !== CAP08_S4_AUTHORITY_SCHEMA_VERSION_V1
      || authority.authority_ref !== authorityRef
      || authority.determinism_hash !== result.rows[0].determinism_hash
      || authority.formal_run_id !== input.formal_run_id
      || authority.next_logical_time !== input.expected_next_logical_time) {
      throw new Error("CAP08_S4_T17_AUTHORITY_IDENTITY_MISMATCH");
    }
    exactScopeV1(authority.scope, input.scope);

    const exact = await this.repository.inspect(authority);
    if (exact.disposition !== "ALREADY_COMPLETE_EXACT") {
      throw new Error("CAP08_S4_T17_EXACT_APPEND_FORWARD_REQUIRED");
    }

    const latest = await this.pool.query(
      `SELECT
         s.state_object_id,
         c.checkpoint_object_id,
         f.forecast_object_id
       FROM twin_state_latest_index_v1 s
       JOIN twin_runtime_checkpoint_latest_index_v1 c
         USING (tenant_id,project_id,group_id,field_id,season_id,zone_id)
       JOIN twin_forecast_result_latest_index_v1 f
         USING (tenant_id,project_id,group_id,field_id,season_id,zone_id)
       WHERE s.tenant_id=$1 AND s.project_id=$2 AND s.group_id=$3
         AND s.field_id=$4 AND s.season_id=$5 AND s.zone_id=$6`,
      [
        input.scope.tenant_id,
        input.scope.project_id,
        input.scope.group_id,
        input.scope.field_id,
        input.scope.season_id,
        input.scope.zone_id,
      ],
    );
    if (latest.rows.length !== 1) throw new Error("CAP08_S4_T17_CURRENT_POINTERS_REQUIRED");
    if (latest.rows[0].state_object_id === authority.corrected_objects.state.ref
      || latest.rows[0].checkpoint_object_id === authority.corrected_objects.checkpoint.ref
      || latest.rows[0].forecast_object_id === authority.corrected_objects.forecast.ref) {
      throw new Error("CAP08_S4_LATEST_POINTER_REGRESSION_DETECTED");
    }

    return {
      ...structuredClone(authority.t17_predecessor),
      correction_authority_hash: authority.determinism_hash,
    };
  }
}
