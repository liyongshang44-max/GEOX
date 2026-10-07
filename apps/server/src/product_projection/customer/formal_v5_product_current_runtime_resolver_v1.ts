import type { Pool, PoolClient } from "pg";
import type {
  FieldTwinCanonicalObjectRefV1,
  FieldTwinScopeV1,
  SemanticHashTextV1,
} from "../../domain/field_twin_read_model/index.js";
import { computeMemberDeterminismHashV1 } from "../../domain/twin_runtime/canonical_identity_v1.js";
import type { CanonicalObjectEnvelopeV1 } from "../../domain/twin_runtime/canonical_object_contracts_v1.js";
import type {
  CustomerProductCurrentRuntimeRefsV1,
  CustomerProductCurrentRuntimeResolverV1,
} from "./customer_product_current_runtime_resolver_v1.js";

type ActiveLineagePointerV1 = {
  active_lineage_ref: string;
  activation_authority_kind: string;
  activation_authority_ref: string;
};

type LatestStatePointerV1 = {
  state_object_id: string;
  lineage_id: string;
  revision_id: string;
  logical_time: string | Date;
  determinism_hash: string;
  source_fact_id: string;
};

type CanonicalFactRowV1 = {
  fact_id: string;
  record_json: unknown;
};

function scopeValuesV1(scope: FieldTwinScopeV1): string[] {
  return [
    scope.tenant_id,
    scope.project_id,
    scope.group_id,
    scope.field_id,
    scope.season_id,
    scope.zone_id,
  ];
}

function failV1(code: string, detail?: string): never {
  throw new Error(detail ? `${code}:${detail}` : code);
}

function objectFromFactV1(
  row: CanonicalFactRowV1,
  expectedRef: string,
  expectedType: "twin_runtime_lineage_v1" | "twin_state_estimate_v1",
  scope: FieldTwinScopeV1,
): CanonicalObjectEnvelopeV1 {
  const record = typeof row.record_json === "string"
    ? JSON.parse(row.record_json)
    : row.record_json;
  if (!record || typeof record !== "object" || Array.isArray(record)) {
    failV1("MCFT_FORMAL_PRODUCT_CANONICAL_FACT_INVALID", expectedRef);
  }
  const outer = record as Record<string, unknown>;
  if (outer.type !== expectedType) {
    failV1("MCFT_FORMAL_PRODUCT_CANONICAL_TYPE_MISMATCH", expectedRef);
  }
  const payload = outer.payload;
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
    failV1("MCFT_FORMAL_PRODUCT_CANONICAL_PAYLOAD_INVALID", expectedRef);
  }
  const object = payload as CanonicalObjectEnvelopeV1;
  if (object.object_id !== expectedRef || object.object_type !== expectedType) {
    failV1("MCFT_FORMAL_PRODUCT_CANONICAL_REF_MISMATCH", expectedRef);
  }
  const expectedScope = {
    tenant_id: scope.tenant_id,
    project_id: scope.project_id,
    group_id: scope.group_id,
    field_id: scope.field_id,
    season_id: scope.season_id,
    zone_id: scope.zone_id,
  };
  const actualScope = {
    tenant_id: object.tenant_id,
    project_id: object.project_id,
    group_id: object.group_id,
    field_id: object.field_id,
    season_id: object.season_id,
    zone_id: object.zone_id,
  };
  if (JSON.stringify(actualScope) !== JSON.stringify(expectedScope)) {
    failV1("MCFT_FORMAL_PRODUCT_CANONICAL_SCOPE_MISMATCH", expectedRef);
  }
  const recomputed = computeMemberDeterminismHashV1(
    object as unknown as Record<string, unknown>,
  );
  if (recomputed !== object.determinism_hash) {
    failV1("MCFT_FORMAL_PRODUCT_CANONICAL_HASH_MISMATCH", expectedRef);
  }
  return object;
}

async function readExactCanonicalFactV1(
  client: PoolClient,
  objectRef: string,
  objectType: "twin_runtime_lineage_v1" | "twin_state_estimate_v1",
  scope: FieldTwinScopeV1,
): Promise<{ fact_id: string; object: CanonicalObjectEnvelopeV1 }> {
  const result = await client.query<CanonicalFactRowV1>(
    `SELECT fact_id, record_json
       FROM public.facts
      WHERE record_json->>'type'=$1
        AND record_json->'payload'->>'object_id'=$2
      LIMIT 2`,
    [objectType, objectRef],
  );
  if (result.rows.length === 0) {
    failV1("MCFT_EXACT_RESOURCE_NOT_FOUND", `${objectType}:${objectRef}`);
  }
  if (result.rows.length !== 1) {
    failV1("MCFT_FORMAL_PRODUCT_CANONICAL_CARDINALITY_INVALID", `${objectType}:${objectRef}`);
  }
  const row = result.rows[0];
  return {
    fact_id: String(row.fact_id),
    object: objectFromFactV1(row, objectRef, objectType, scope),
  };
}

function refV1(
  factId: string,
  object: CanonicalObjectEnvelopeV1,
): FieldTwinCanonicalObjectRefV1 {
  return {
    object_ref: object.object_id,
    object_type: object.object_type,
    object_hash: object.determinism_hash as SemanticHashTextV1,
    source_fact_ref: factId,
  };
}

export class PostgresFormalV5ProductCurrentRuntimeResolverV1
implements CustomerProductCurrentRuntimeResolverV1 {
  constructor(private readonly pool: Pool) {}

  async resolveCurrentRuntimeV1(
    scope: FieldTwinScopeV1,
  ): Promise<CustomerProductCurrentRuntimeRefsV1> {
    const client = await this.pool.connect();
    try {
      await client.query("BEGIN");
      await client.query("SET TRANSACTION ISOLATION LEVEL REPEATABLE READ READ ONLY");
      const tx = await client.query<{
        transaction_read_only: string;
        transaction_isolation: string;
      }>(
        `SELECT pg_catalog.current_setting('transaction_read_only') AS transaction_read_only,
                pg_catalog.current_setting('transaction_isolation') AS transaction_isolation`,
      );
      if (
        tx.rows[0]?.transaction_read_only !== "on"
        || String(tx.rows[0]?.transaction_isolation ?? "").toLowerCase() !== "repeatable read"
      ) {
        failV1("MCFT_FORMAL_PRODUCT_READ_TRANSACTION_INVALID");
      }

      const values = scopeValuesV1(scope);
      const active = await client.query<ActiveLineagePointerV1>(
        `SELECT active_lineage_ref, activation_authority_kind, activation_authority_ref
           FROM public.twin_active_lineage_index_v1
          WHERE tenant_id=$1
            AND project_id=$2
            AND group_id=$3
            AND field_id=$4
            AND season_id=$5
            AND zone_id=$6
          LIMIT 2`,
        values,
      );
      if (active.rows.length === 0) {
        failV1("MCFT_RUNTIME_NOT_ESTABLISHED");
      }
      if (active.rows.length !== 1) {
        failV1("MCFT_FORMAL_PRODUCT_ACTIVE_LINEAGE_CARDINALITY_INVALID");
      }

      const latest = await client.query<LatestStatePointerV1>(
        `SELECT state_object_id, lineage_id, revision_id, logical_time,
                determinism_hash, source_fact_id
           FROM public.twin_state_latest_index_v1
          WHERE tenant_id=$1
            AND project_id=$2
            AND group_id=$3
            AND field_id=$4
            AND season_id=$5
            AND zone_id=$6
          LIMIT 2`,
        values,
      );
      if (latest.rows.length === 0) {
        failV1("MCFT_CURRENT_STATE_REF_MISSING");
      }
      if (latest.rows.length !== 1) {
        failV1("MCFT_FORMAL_PRODUCT_STATE_POINTER_CARDINALITY_INVALID");
      }

      const activeRow = active.rows[0];
      const stateRow = latest.rows[0];
      const lineageFact = await readExactCanonicalFactV1(
        client,
        String(activeRow.active_lineage_ref),
        "twin_runtime_lineage_v1",
        scope,
      );
      const stateFact = await readExactCanonicalFactV1(
        client,
        String(stateRow.state_object_id),
        "twin_state_estimate_v1",
        scope,
      );

      const lineage = lineageFact.object;
      const state = stateFact.object;
      if (
        String(lineage.payload?.activation_authority_ref ?? "")
        !== String(activeRow.activation_authority_ref)
      ) {
        failV1("MCFT_FORMAL_PRODUCT_LINEAGE_AUTHORITY_MISMATCH");
      }
      if (
        String(state.determinism_hash) !== String(stateRow.determinism_hash)
        || stateFact.fact_id !== String(stateRow.source_fact_id)
      ) {
        failV1("MCFT_FORMAL_PRODUCT_STATE_POINTER_EXACT_REF_MISMATCH");
      }
      if (
        String(state.lineage_id ?? "") !== String(stateRow.lineage_id)
        || String(state.revision_id ?? "") !== String(stateRow.revision_id)
        || String(state.lineage_id ?? "") !== String(lineage.lineage_id ?? "")
        || String(state.revision_id ?? "") !== String(lineage.revision_id ?? "")
      ) {
        failV1("MCFT_FORMAL_PRODUCT_LINEAGE_STATE_MISMATCH");
      }
      const stateLogicalTime = new Date(state.logical_time).toISOString();
      const pointerLogicalTime = new Date(stateRow.logical_time).toISOString();
      if (stateLogicalTime !== pointerLogicalTime) {
        failV1("MCFT_FORMAL_PRODUCT_STATE_TIME_MISMATCH");
      }

      await client.query("COMMIT");
      return {
        source_profile: "MCFT_FORMAL_V5_EXACT",
        active_lineage: refV1(lineageFact.fact_id, lineage),
        posterior_state: refV1(stateFact.fact_id, state),
      };
    } catch (error) {
      await client.query("ROLLBACK").catch(() => undefined);
      throw error;
    } finally {
      client.release();
    }
  }
}
