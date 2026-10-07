import type { Pool, PoolClient } from "pg";
import type {
  FieldTwinCanonicalObjectRefV1,
  FieldTwinScopeV1,
  SemanticHashTextV1,
} from "../../domain/field_twin_read_model/index.js";
import { ActiveLineageAuthorityValidatorV1 } from "../../domain/field_twin_read_model/exact_resolvers_v1.js";
import { computeMemberDeterminismHashV1 } from "../../domain/twin_runtime/canonical_identity_v1.js";
import type {
  CustomerProductCurrentRuntimeRefsV1,
  CustomerProductCurrentRuntimeResolverV1,
} from "./customer_product_current_runtime_resolver_v1.js";

type ActiveLineagePointerV1 = {
  active_lineage_ref: string;
  activation_authority_kind: string;
  activation_authority_ref: string;
  expected_previous_active_lineage: string | null;
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

type ExactCanonicalFactV1 = {
  fact_id: string;
  object: Record<string, unknown>;
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

function recordV1(value: unknown, code: string): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) failV1(code);
  return value as Record<string, unknown>;
}

function exactTextV1(value: unknown, code: string): string {
  const text = String(value ?? "").trim();
  if (!text) failV1(code);
  return text;
}

function nullableTextV1(value: unknown): string | null {
  if (value === null || value === undefined) return null;
  const text = String(value).trim();
  return text || null;
}

function assertCanonicalScopeV1(
  object: Record<string, unknown>,
  scope: FieldTwinScopeV1,
  objectRef: string,
): void {
  const fields = [
    ["tenant_id", scope.tenant_id],
    ["project_id", scope.project_id],
    ["group_id", scope.group_id],
    ["field_id", scope.field_id],
    ["season_id", scope.season_id],
    ["zone_id", scope.zone_id],
  ] as const;
  for (const [key, expected] of fields) {
    if (String(object[key] ?? "") !== String(expected ?? "")) {
      failV1("MCFT_FORMAL_PRODUCT_CANONICAL_SCOPE_MISMATCH", `${objectRef}:${key}`);
    }
  }
}

function parseCanonicalFactV1(
  row: CanonicalFactRowV1,
  expectedRef: string,
  expectedType: string,
  scope: FieldTwinScopeV1,
): ExactCanonicalFactV1 {
  const envelope = typeof row.record_json === "string"
    ? JSON.parse(row.record_json)
    : row.record_json;
  const outer = recordV1(envelope, "MCFT_FORMAL_PRODUCT_CANONICAL_FACT_INVALID");
  if (exactTextV1(outer.type, "MCFT_FORMAL_PRODUCT_CANONICAL_TYPE_REQUIRED") !== expectedType) {
    failV1("MCFT_FORMAL_PRODUCT_CANONICAL_TYPE_MISMATCH", expectedRef);
  }

  const object = recordV1(
    outer.payload,
    "MCFT_FORMAL_PRODUCT_CANONICAL_PAYLOAD_INVALID",
  );
  if (
    exactTextV1(object.object_id, "MCFT_FORMAL_PRODUCT_OBJECT_ID_REQUIRED") !== expectedRef
    || exactTextV1(object.object_type, "MCFT_FORMAL_PRODUCT_OBJECT_TYPE_REQUIRED") !== expectedType
  ) {
    failV1("MCFT_FORMAL_PRODUCT_CANONICAL_REF_MISMATCH", expectedRef);
  }

  assertCanonicalScopeV1(object, scope, expectedRef);

  const storedHash = exactTextV1(
    object.determinism_hash,
    "MCFT_FORMAL_PRODUCT_CANONICAL_HASH_REQUIRED",
  );
  const recomputedHash = computeMemberDeterminismHashV1(object);
  if (storedHash !== recomputedHash) {
    failV1("MCFT_FORMAL_PRODUCT_CANONICAL_HASH_MISMATCH", expectedRef);
  }

  return {
    fact_id: String(row.fact_id),
    object,
  };
}

async function readExactCanonicalFactV1(
  client: PoolClient,
  objectRef: string,
  objectType: string,
  scope: FieldTwinScopeV1,
): Promise<ExactCanonicalFactV1> {
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
    failV1(
      "MCFT_FORMAL_PRODUCT_CANONICAL_CARDINALITY_INVALID",
      `${objectType}:${objectRef}`,
    );
  }
  return parseCanonicalFactV1(
    result.rows[0],
    objectRef,
    objectType,
    scope,
  );
}

function payloadV1(fact: ExactCanonicalFactV1, code: string): Record<string, unknown> {
  return recordV1(fact.object.payload, code);
}

function refV1(fact: ExactCanonicalFactV1): FieldTwinCanonicalObjectRefV1 {
  return {
    object_ref: exactTextV1(
      fact.object.object_id,
      "MCFT_FORMAL_PRODUCT_OBJECT_ID_REQUIRED",
    ),
    object_type: exactTextV1(
      fact.object.object_type,
      "MCFT_FORMAL_PRODUCT_OBJECT_TYPE_REQUIRED",
    ),
    object_hash: exactTextV1(
      fact.object.determinism_hash,
      "MCFT_FORMAL_PRODUCT_CANONICAL_HASH_REQUIRED",
    ) as SemanticHashTextV1,
    source_fact_ref: fact.fact_id,
  };
}

export class PostgresFormalV5ProductCurrentRuntimeResolverV1
implements CustomerProductCurrentRuntimeResolverV1 {
  private readonly lineageValidator = new ActiveLineageAuthorityValidatorV1();

  constructor(private readonly pool: Pool) {}

  private async validateActiveLineageAuthorityV1(
    client: PoolClient,
    scope: FieldTwinScopeV1,
    pointer: ActiveLineagePointerV1,
    lineage: ExactCanonicalFactV1,
  ): Promise<void> {
    const lineageRef = exactTextV1(
      lineage.object.object_id,
      "MCFT_FORMAL_PRODUCT_LINEAGE_REF_REQUIRED",
    );
    const lineagePayload = payloadV1(
      lineage,
      "MCFT_FORMAL_PRODUCT_LINEAGE_PAYLOAD_INVALID",
    );
    const lineageKind = exactTextV1(
      lineagePayload.lineage_kind,
      "MCFT_FORMAL_PRODUCT_LINEAGE_KIND_REQUIRED",
    );

    if (pointer.activation_authority_kind === "INITIAL_LINEAGE_DECLARATION") {
      this.lineageValidator.validateInitial({
        active_lineage_ref: pointer.active_lineage_ref,
        activation_authority_ref: pointer.activation_authority_ref,
        lineage_object_ref: lineageRef,
        lineage_kind: lineageKind,
        expected_previous_active_lineage: pointer.expected_previous_active_lineage,
      });
      return;
    }

    if (pointer.activation_authority_kind !== "LINEAGE_PROMOTION") {
      failV1(
        "MCFT_FORMAL_PRODUCT_LINEAGE_AUTHORITY_KIND_INVALID",
        pointer.activation_authority_kind,
      );
    }

    const promotion = await readExactCanonicalFactV1(
      client,
      pointer.activation_authority_ref,
      "twin_lineage_promotion_v1",
      scope,
    );
    const promotionPayload = payloadV1(
      promotion,
      "MCFT_FORMAL_PRODUCT_PROMOTION_PAYLOAD_INVALID",
    );
    const candidateLineageRef = exactTextV1(
      promotionPayload.candidate_lineage_ref
        ?? promotionPayload.candidate_lineage_object_ref,
      "MCFT_REVISION_PROMOTION_CHAIN_INVALID:CANDIDATE",
    );
    const revisionRunRef = exactTextV1(
      promotionPayload.revision_run_ref,
      "MCFT_REVISION_PROMOTION_CHAIN_INVALID:REVISION_RUN",
    );
    const revision = await readExactCanonicalFactV1(
      client,
      revisionRunRef,
      "twin_revision_run_v1",
      scope,
    );
    const revisionPayload = payloadV1(
      revision,
      "MCFT_FORMAL_PRODUCT_REVISION_PAYLOAD_INVALID",
    );
    const revisionStatus = exactTextV1(
      revisionPayload.status ?? revisionPayload.terminal_status,
      "MCFT_REVISION_PROMOTION_CHAIN_INVALID:STATUS",
    );

    this.lineageValidator.validateRevision({
      active_lineage_ref: pointer.active_lineage_ref,
      promotion_candidate_lineage_ref: candidateLineageRef,
      candidate_lineage_kind: lineageKind,
      promotion_revision_run_ref: revisionRunRef,
      revision_run_ref: exactTextV1(
        revision.object.object_id,
        "MCFT_REVISION_PROMOTION_CHAIN_INVALID:REVISION_OBJECT",
      ),
      revision_terminal_status: revisionStatus,
      validated_chain_refs: [
        lineageRef,
        pointer.activation_authority_ref,
        revisionRunRef,
      ],
    });
  }

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
        `SELECT active_lineage_ref,
                activation_authority_kind,
                activation_authority_ref,
                expected_previous_active_lineage
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
      if (active.rows.length === 0) failV1("MCFT_RUNTIME_NOT_ESTABLISHED");
      if (active.rows.length !== 1) {
        failV1("MCFT_FORMAL_PRODUCT_ACTIVE_LINEAGE_CARDINALITY_INVALID");
      }

      const latest = await client.query<LatestStatePointerV1>(
        `SELECT state_object_id,
                lineage_id,
                revision_id,
                logical_time,
                determinism_hash,
                source_fact_id
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
      if (latest.rows.length === 0) failV1("MCFT_CURRENT_STATE_REF_MISSING");
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
      await this.validateActiveLineageAuthorityV1(
        client,
        scope,
        activeRow,
        lineageFact,
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
        exactTextV1(
          state.determinism_hash,
          "MCFT_FORMAL_PRODUCT_STATE_HASH_REQUIRED",
        ) !== String(stateRow.determinism_hash)
        || stateFact.fact_id !== String(stateRow.source_fact_id)
      ) {
        failV1("MCFT_FORMAL_PRODUCT_STATE_POINTER_EXACT_REF_MISMATCH");
      }

      if (
        exactTextV1(state.lineage_id, "MCFT_FORMAL_PRODUCT_STATE_LINEAGE_REQUIRED")
          !== String(stateRow.lineage_id)
        || exactTextV1(state.revision_id, "MCFT_FORMAL_PRODUCT_STATE_REVISION_REQUIRED")
          !== String(stateRow.revision_id)
        || exactTextV1(state.lineage_id, "MCFT_FORMAL_PRODUCT_STATE_LINEAGE_REQUIRED")
          !== exactTextV1(lineage.lineage_id, "MCFT_FORMAL_PRODUCT_LINEAGE_ID_REQUIRED")
        || exactTextV1(state.revision_id, "MCFT_FORMAL_PRODUCT_STATE_REVISION_REQUIRED")
          !== exactTextV1(lineage.revision_id, "MCFT_FORMAL_PRODUCT_LINEAGE_REVISION_REQUIRED")
      ) {
        failV1("MCFT_FORMAL_PRODUCT_LINEAGE_STATE_MISMATCH");
      }

      const stateLogicalTime = new Date(
        exactTextV1(state.logical_time, "MCFT_FORMAL_PRODUCT_STATE_TIME_REQUIRED"),
      ).toISOString();
      const pointerLogicalTime = new Date(stateRow.logical_time).toISOString();
      if (stateLogicalTime !== pointerLogicalTime) {
        failV1("MCFT_FORMAL_PRODUCT_STATE_TIME_MISMATCH");
      }

      await client.query("COMMIT");
      return {
        source_profile: "MCFT_FORMAL_V5_EXACT",
        active_lineage: refV1(lineageFact),
        posterior_state: refV1(stateFact),
      };
    } catch (error) {
      await client.query("ROLLBACK").catch(() => undefined);
      throw error;
    } finally {
      client.release();
    }
  }
}
