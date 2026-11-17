import test from "node:test";
import assert from "node:assert/strict";
import type { Pool, PoolClient } from "pg";
import { computeMemberDeterminismHashV1 } from "../../domain/twin_runtime/canonical_identity_v1.js";
import type { FieldTwinScopeV1 } from "../../domain/field_twin_read_model/index.js";
import { PostgresFormalV5ProductCurrentRuntimeResolverV1 } from "./formal_v5_product_current_runtime_resolver_v1.js";

const scope: FieldTwinScopeV1 = {
  tenant_id: "tenant-a",
  project_id: "project-a",
  group_id: "group-a",
  field_id: "field-a",
  season_id: "season-a",
  zone_id: "zone-a",
};

function canonical(
  objectId: string,
  objectType: string,
  extra: Record<string, unknown>,
): Record<string, unknown> {
  const value: Record<string, unknown> = {
    object_id: objectId,
    object_type: objectType,
    schema_version: "v1",
    tenant_id: scope.tenant_id,
    project_id: scope.project_id,
    group_id: scope.group_id,
    field_id: scope.field_id,
    season_id: scope.season_id,
    zone_id: scope.zone_id,
    logical_time: "2026-10-09T05:00:00.000Z",
    as_of: "2026-10-09T05:00:00.000Z",
    source_refs: [],
    evidence_refs: [],
    runtime_config_ref: null,
    runtime_config_hash: null,
    idempotency_key: `key:${objectId}`,
    determinism_hash: "",
    limitations: [],
    created_at: "2026-10-09T05:00:00.000Z",
    ...extra,
  };
  value.determinism_hash = computeMemberDeterminismHashV1(value);
  return value;
}

function fact(
  factId: string,
  object: Record<string, unknown>,
): { fact_id: string; record_json: unknown } {
  return {
    fact_id: factId,
    record_json: {
      type: object.object_type,
      payload: object,
    },
  };
}

type FixtureOptions = {
  revision?: boolean;
  corruptStatePointerHash?: boolean;
};

function fixture(options: FixtureOptions = {}) {
  const revision = options.revision === true;
  const revisionId = revision ? "revision-2" : "revision-1";
  const lineageRef = revision ? "lineage-revision" : "lineage-initial";

  const lineage = canonical(lineageRef, "twin_runtime_lineage_v1", {
    lineage_id: lineageRef,
    revision_id: revisionId,
    payload: revision
      ? {
          lineage_kind: "REVISION_CANDIDATE",
          promotion_ref: "promotion-1",
          revision_run_ref: "revision-run-1",
        }
      : {
          lineage_kind: "INITIAL",
          parent_lineage_ref: null,
          revision_run_ref: null,
          promotion_ref: null,
          activation_authority_ref: lineageRef,
          initial_revision_id: revisionId,
        },
  });

  const state = canonical("state-1", "twin_state_estimate_v1", {
    lineage_id: lineageRef,
    revision_id: revisionId,
    payload: {
      derived_state: {},
      confidence: {
        status: "NOT_ESTABLISHED",
        reason_code: "NO_CALIBRATED_CONFIDENCE_MODEL",
      },
      use_eligibility: {
        recommendation_input_eligible: false,
        action_input_eligible: false,
      },
    },
  });

  const promotion = canonical("promotion-1", "twin_lineage_promotion_v1", {
    lineage_id: lineageRef,
    revision_id: revisionId,
    payload: {
      candidate_lineage_ref: lineageRef,
      revision_run_ref: "revision-run-1",
    },
  });

  const revisionRun = canonical("revision-run-1", "twin_revision_run_v1", {
    lineage_id: lineageRef,
    revision_id: revisionId,
    payload: {
      status: "COMPLETED",
    },
  });

  const facts = new Map<string, { fact_id: string; record_json: unknown }>([
    [`twin_runtime_lineage_v1:${lineageRef}`, fact("fact-lineage", lineage)],
    ["twin_state_estimate_v1:state-1", fact("fact-state", state)],
    ["twin_lineage_promotion_v1:promotion-1", fact("fact-promotion", promotion)],
    ["twin_revision_run_v1:revision-run-1", fact("fact-revision", revisionRun)],
  ]);

  return {
    active: {
      active_lineage_ref: lineageRef,
      activation_authority_kind: revision
        ? "LINEAGE_PROMOTION"
        : "INITIAL_LINEAGE_DECLARATION",
      activation_authority_ref: revision ? "promotion-1" : lineageRef,
      expected_previous_active_lineage: revision ? "lineage-previous" : null,
    },
    latest: {
      state_object_id: "state-1",
      lineage_id: lineageRef,
      revision_id: revisionId,
      logical_time: "2026-10-09T05:00:00.000Z",
      determinism_hash: options.corruptStatePointerHash
        ? "sha256:bad"
        : String(state.determinism_hash),
      source_fact_id: "fact-state",
    },
    facts,
  };
}

function fakePool(options: FixtureOptions = {}): {
  pool: Pool;
  observed: string[];
} {
  const data = fixture(options);
  const observed: string[] = [];

  const client = {
    query: async (sql: string, params?: unknown[]) => {
      const normalized = sql.replace(/\s+/g, " ").trim();
      observed.push(normalized);

      if (normalized === "BEGIN"
        || normalized.startsWith("SET TRANSACTION")
        || normalized === "COMMIT"
        || normalized === "ROLLBACK") {
        return { rows: [], rowCount: 0 };
      }

      if (normalized.includes("current_setting('transaction_read_only')")) {
        return {
          rows: [{
            transaction_read_only: "on",
            transaction_isolation: "repeatable read",
          }],
          rowCount: 1,
        };
      }

      if (normalized.includes("FROM public.twin_active_lineage_index_v1")) {
        return { rows: [data.active], rowCount: 1 };
      }

      if (normalized.includes("FROM public.twin_state_latest_index_v1")) {
        return { rows: [data.latest], rowCount: 1 };
      }

      if (normalized.includes("FROM public.facts")) {
        const objectType = String(params?.[0] ?? "");
        const objectRef = String(params?.[1] ?? "");
        const row = data.facts.get(`${objectType}:${objectRef}`);
        return { rows: row ? [row] : [], rowCount: row ? 1 : 0 };
      }

      throw new Error(`UNEXPECTED_SQL:${normalized}`);
    },
    release: () => undefined,
  } as unknown as PoolClient;

  const pool = {
    connect: async () => client,
  } as unknown as Pool;

  return { pool, observed };
}

test("Formal-v5 exact Product resolver validates initial lineage and posterior state", async () => {
  const { pool, observed } = fakePool();
  const resolver = new PostgresFormalV5ProductCurrentRuntimeResolverV1(pool);
  const result = await resolver.resolveCurrentRuntimeV1(scope);

  assert.equal(result.source_profile, "MCFT_FORMAL_V5_EXACT");
  assert.equal(result.active_lineage.object_ref, "lineage-initial");
  assert.equal(result.active_lineage.object_type, "twin_runtime_lineage_v1");
  assert.equal(result.active_lineage.source_fact_ref, "fact-lineage");
  assert.equal(result.posterior_state.object_ref, "state-1");
  assert.equal(result.posterior_state.object_type, "twin_state_estimate_v1");
  assert.equal(result.posterior_state.source_fact_ref, "fact-state");

  assert.ok(observed.includes("BEGIN"));
  assert.ok(observed.some((sql) => sql.startsWith("SET TRANSACTION ISOLATION LEVEL REPEATABLE READ READ ONLY")));
  assert.ok(observed.includes("COMMIT"));
  assert.equal(observed.some((sql) => /INSERT|UPDATE|DELETE|CREATE|ALTER|DROP/i.test(sql)), false);
});

test("Formal-v5 exact Product resolver validates revision promotion authority chain", async () => {
  const { pool, observed } = fakePool({ revision: true });
  const resolver = new PostgresFormalV5ProductCurrentRuntimeResolverV1(pool);
  const result = await resolver.resolveCurrentRuntimeV1(scope);

  assert.equal(result.active_lineage.object_ref, "lineage-revision");
  assert.ok(observed.some((sql) => sql.includes("FROM public.facts")));
  assert.ok(
    observed.filter((sql) => sql.includes("FROM public.facts")).length >= 4,
    "lineage, promotion, revision, and state exact facts must be read",
  );
});

test("Formal-v5 exact Product resolver fails closed on state pointer hash mismatch", async () => {
  const { pool, observed } = fakePool({ corruptStatePointerHash: true });
  const resolver = new PostgresFormalV5ProductCurrentRuntimeResolverV1(pool);

  await assert.rejects(
    () => resolver.resolveCurrentRuntimeV1(scope),
    /MCFT_FORMAL_PRODUCT_STATE_POINTER_EXACT_REF_MISMATCH/,
  );
  assert.ok(observed.includes("ROLLBACK"));
});
