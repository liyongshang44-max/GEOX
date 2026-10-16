import test from "node:test";
import assert from "node:assert/strict";
import type { Pool } from "pg";
import type { McftFieldTwinReadApiV1, McftFieldTwinReadRequestV1 } from "../../services/mcft_field_twin_read_api_v1.js";
import {
  PostgresCustomerProductProjectionBuilderV1,
  type CustomerProductReadScopeV1,
} from "./customer_product_projection_builder_v1.js";
import {
  assertCustomerOverviewProjectionV1,
  assertFieldSummaryProjectionV1,
  assertFieldWorkspaceProjectionV1,
} from "./customer_product_projection_contracts_v1.js";

const scope: CustomerProductReadScopeV1 = {
  tenant_id: "tenant-a",
  project_id: "project-a",
  group_id: "group-a",
  allowed_field_ids: ["field-a"],
  can_preview_all_fields: false,
};

const exactRuntime = {
  schema_version: "minimal_field_twin_runtime_read_model_v1",
  root_graph_status: "COMPLETE_EXACT_GRAPH",
  posterior_state: {
    object_ref: "state-a",
    object_type: "twin_state_estimate_v1",
    object_hash: "sha256:state-a",
    source_fact_ref: "fact-state-a",
  },
  active_lineage: {
    object_ref: "lineage-a",
    object_type: "twin_runtime_lineage_v1",
    object_hash: "sha256:lineage-a",
    source_fact_ref: "fact-lineage-a",
  },
} as any;

const statePayload = {
  derived_state: {
    root_zone_water_storage_mm: {
      mean: 76.2,
      stddev: 4.5,
      interval_low: 67.4,
      interval_high: 85.0,
    },
    available_water_fraction: 0.61,
    depletion_from_field_capacity_mm: 14.8,
  },
  unavailable_state: {
    surface_soil_moisture_state: "UNAVAILABLE_NO_BOUND_SURFACE_OBSERVATION",
    water_stress_state: "NOT_ESTABLISHED_NO_STRESS_MODEL",
    drainage_state: "NOT_ESTABLISHED",
  },
  confidence: {
    status: "NOT_ESTABLISHED",
    reason_code: "NO_CALIBRATED_CONFIDENCE_MODEL",
  },
};

class FakeReadApi implements McftFieldTwinReadApiV1 {
  readRuntime(_request: McftFieldTwinReadRequestV1) { return Promise.resolve(exactRuntime); }
  async readTimeline(_request: McftFieldTwinReadRequestV1): Promise<Record<string, unknown>> { throw new Error("UNUSED"); }
  async readTrace(_request: McftFieldTwinReadRequestV1): Promise<Record<string, unknown>> { throw new Error("UNUSED"); }
  async readStates(_request: McftFieldTwinReadRequestV1): Promise<Record<string, unknown>> { throw new Error("UNUSED"); }
  async readForecasts(_request: McftFieldTwinReadRequestV1): Promise<Record<string, unknown>> { throw new Error("UNUSED"); }
  async readScenarios(_request: McftFieldTwinReadRequestV1): Promise<Record<string, unknown>> { throw new Error("UNUSED"); }
  async readResiduals(_request: McftFieldTwinReadRequestV1): Promise<Record<string, unknown>> { throw new Error("UNUSED"); }
  async readActionLifecycle(_request: McftFieldTwinReadRequestV1): Promise<Record<string, unknown>> { throw new Error("UNUSED"); }
  async readModelGovernance(_request: McftFieldTwinReadRequestV1): Promise<Record<string, unknown>> { throw new Error("UNUSED"); }
  async readHealth(_request: McftFieldTwinReadRequestV1): Promise<Record<string, unknown>> { throw new Error("UNUSED"); }
}

function fakePool(options?: { runtimeScopeCount?: number; includeField?: boolean }): Pool {
  const runtimeScopeCount = options?.runtimeScopeCount ?? 1;
  const includeField = options?.includeField ?? true;
  return {
    query: async (sql: string, params: unknown[]) => {
      if (sql.includes("FROM public.field_index_v1")) {
        assert.match(sql, /tenant_id = \$1/);
        assert.match(sql, /project_id = \$2/);
        assert.match(sql, /group_id = \$3/);
        assert.equal(params[0], "tenant-a");
        assert.equal(params[1], "project-a");
        assert.equal(params[2], "group-a");
        if (!includeField) return { rows: [], rowCount: 0 };
        return {
          rows: [{
            field_id: "field-a",
            field_name: "North Field 07",
            area_ha: 82,
            updated_ts_ms: 1789948800000,
          }],
          rowCount: 1,
        };
      }
      if (sql.includes("FROM public.twin_active_lineage_index_v1")) {
        const rows = Array.from({ length: runtimeScopeCount }, (_, index) => ({
          season_id: index === 0 ? "season-a" : `season-${index + 1}`,
          zone_id: index === 0 ? "zone-a" : `zone-${index + 1}`,
          active_lineage_ref: index === 0 ? "lineage-a" : `lineage-${index + 1}`,
          updated_at: "2026-09-23T00:00:00.000Z",
        }));
        return { rows, rowCount: rows.length };
      }
      if (sql.includes("FROM public.twin_state_history_projection_v1")) {
        assert.equal(params.at(-1), "state-a");
        return {
          rows: [{
            canonical_payload: statePayload,
            logical_time: "2026-09-22T23:00:00.000Z",
            determinism_hash: "sha256:state-a",
            source_fact_id: "fact-state-a",
          }],
          rowCount: 1,
        };
      }
      throw new Error(`UNEXPECTED_SQL:${sql}`);
    },
  } as unknown as Pool;
}

test("real field summary preserves exact MCFT state and does not infer risk/recommendation", async () => {
  const builder = new PostgresCustomerProductProjectionBuilderV1(fakePool(), {
    readApi: new FakeReadApi(),
    now: () => "2026-09-23T00:05:00.000Z",
  });
  const projection = await builder.buildFieldSummaryV1(scope, "field-a");
  assertFieldSummaryProjectionV1(projection);
  assert.equal(projection.identity.display_name, "North Field 07");
  assert.equal(projection.reporting_state.state, "CURRENT");
  assert.equal(projection.current_condition.status, "AVAILABLE");
  assert.equal(projection.current_condition.root_zone_water?.available_water_fraction, 0.61);
  assert.equal(projection.current_condition.root_zone_water?.water_stress_state.status, "NOT_ESTABLISHED");
  assert.equal(projection.attention.status, "UNAVAILABLE");
  assert.equal(projection.attention.has_attention, null);
  assert.equal(projection.envelope.source_authority_refs.some((ref) => ref.exact_ref === "state-a"), true);
  assert.equal(projection.envelope.source_authority_refs.some((ref) => ref.exact_ref === "lineage-a"), true);
  assert.equal("risk_level" in (projection as any), false);
  assert.equal("recommendation" in (projection as any), false);
});

test("field-level runtime ambiguity fails closed instead of selecting a zone", async () => {
  const builder = new PostgresCustomerProductProjectionBuilderV1(fakePool({ runtimeScopeCount: 2 }), {
    readApi: new FakeReadApi(),
    now: () => "2026-09-23T00:05:00.000Z",
  });
  const projection = await builder.buildFieldSummaryV1(scope, "field-a");
  assertFieldSummaryProjectionV1(projection);
  assert.equal(projection.reporting_state.state, "LIMITED");
  assert.equal(projection.current_condition.status, "LIMITED");
  assert.equal(projection.current_condition.root_zone_water, null);
  assert.ok(projection.limitation_reason_codes.includes("FIELD_LEVEL_RUNTIME_SCOPE_AMBIGUOUS_NO_AGGREGATION_AUTHORITY"));
});

test("field without an established MCFT runtime remains visible but condition is unavailable", async () => {
  const builder = new PostgresCustomerProductProjectionBuilderV1(fakePool({ runtimeScopeCount: 0 }), {
    readApi: new FakeReadApi(),
    now: () => "2026-09-23T00:05:00.000Z",
  });
  const projection = await builder.buildFieldSummaryV1(scope, "field-a");
  assertFieldSummaryProjectionV1(projection);
  assert.equal(projection.identity.display_name, "North Field 07");
  assert.equal(projection.reporting_state.state, "UNAVAILABLE");
  assert.equal(projection.current_condition.status, "UNAVAILABLE");
  assert.ok(projection.limitation_reason_codes.includes("MCFT_CURRENT_RUNTIME_NOT_ESTABLISHED"));
  const limitation = projection.envelope.limitations.find(
    (item) => item.reason_code === "MCFT_CURRENT_RUNTIME_NOT_ESTABLISHED",
  );
  assert.equal(
    limitation?.detail,
    "No exact active MCFT Runtime scope exists for this field in the caller tenant/project/group scope; Product API cannot select a current field state.",
  );
});

test("workspace keeps not-yet-productized domains explicitly unavailable", async () => {
  const builder = new PostgresCustomerProductProjectionBuilderV1(fakePool(), {
    readApi: new FakeReadApi(),
    now: () => "2026-09-23T00:05:00.000Z",
  });
  const projection = await builder.buildFieldWorkspaceV1(scope, "field-a");
  assertFieldWorkspaceProjectionV1(projection);
  assert.equal(projection.current_condition.status, "AVAILABLE");
  assert.equal(projection.open_action_cases.status, "UNAVAILABLE");
  assert.deepEqual(projection.open_action_cases.items, []);
  assert.equal(projection.recent_operations.status, "UNAVAILABLE");
  assert.equal(projection.observed_outcomes.status, "UNAVAILABLE");
  assert.equal(projection.history_summary.status, "UNAVAILABLE");
  assert.equal(
    projection.envelope.limitations.find((item) => item.reason_code === "HISTORY_PROJECTION_NOT_IMPLEMENTED")?.detail,
    "Canonical customer business History projection is not implemented in Wave-02; current state must not substitute for missing historical basis.",
  );
  assert.equal(
    projection.envelope.limitations.find((item) => item.reason_code === "OPERATION_PROJECTION_NOT_IMPLEMENTED")?.detail,
    "Canonical Product operation projection is not implemented in Wave-02; legacy Customer API operation DTOs are not a permitted source.",
  );
});

test("overview counts reporting state from canonical field summaries and does not synthesize attention", async () => {
  const builder = new PostgresCustomerProductProjectionBuilderV1(fakePool(), {
    readApi: new FakeReadApi(),
    now: () => "2026-09-23T00:05:00.000Z",
  });
  const projection = await builder.buildCustomerOverviewV1(scope);
  assertCustomerOverviewProjectionV1(projection);
  assert.deepEqual(projection.reporting_summary, {
    total_fields: 1,
    current_fields: 1,
    limited_fields: 0,
    unavailable_fields: 0,
  });
  assert.equal(projection.attention_items.status, "UNAVAILABLE");
  assert.deepEqual(projection.attention_items.items, []);
});

test("field outside caller allowlist is not found", async () => {
  const builder = new PostgresCustomerProductProjectionBuilderV1(fakePool(), {
    readApi: new FakeReadApi(),
    now: () => "2026-09-23T00:05:00.000Z",
  });
  await assert.rejects(
    () => builder.buildFieldSummaryV1({ ...scope, allowed_field_ids: ["field-b"] }, "field-a"),
    /PRODUCT_FIELD_NOT_FOUND/,
  );
});


test("validator rejects product-owned risk fields even on an otherwise valid summary", async () => {
  const builder = new PostgresCustomerProductProjectionBuilderV1(fakePool(), {
    readApi: new FakeReadApi(),
    now: () => "2026-09-23T00:05:00.000Z",
  });
  const projection = await builder.buildFieldSummaryV1(scope, "field-a");
  const invalid = { ...projection, risk_level: "HIGH" };
  assert.throws(
    () => assertFieldSummaryProjectionV1(invalid),
    /FIELD_SUMMARY_PRODUCT_AUTHORITY_INFERENCE_FORBIDDEN/,
  );
});

test("validator rejects claiming no attention when attention projection is unavailable", async () => {
  const builder = new PostgresCustomerProductProjectionBuilderV1(fakePool(), {
    readApi: new FakeReadApi(),
    now: () => "2026-09-23T00:05:00.000Z",
  });
  const projection = await builder.buildFieldSummaryV1(scope, "field-a");
  const invalid = {
    ...projection,
    attention: {
      ...projection.attention,
      status: "UNAVAILABLE",
      has_attention: false,
    },
  };
  assert.throws(
    () => assertFieldSummaryProjectionV1(invalid),
    /FIELD_ATTENTION_UNKNOWN_MUST_BE_NULL/,
  );
});

test("validator rejects CURRENT reporting when current condition is unavailable", async () => {
  const builder = new PostgresCustomerProductProjectionBuilderV1(fakePool({ runtimeScopeCount: 0 }), {
    readApi: new FakeReadApi(),
    now: () => "2026-09-23T00:05:00.000Z",
  });
  const projection = await builder.buildFieldSummaryV1(scope, "field-a");
  const invalid = {
    ...projection,
    reporting_state: {
      state: "CURRENT",
      reason_codes: [],
      last_qualified_at: "2026-09-23T00:00:00.000Z",
    },
  };
  assert.throws(
    () => assertFieldSummaryProjectionV1(invalid),
    /FIELD_CURRENT_REPORTING_REQUIRES_AVAILABLE_CONDITION/,
  );
});

function splitPool(source: Pool, kind: "identity" | "mcft"): Pool {
  return { query: async (sql: string, params: unknown[]) => {
    assert.equal(sql.includes("FROM public.field_index_v1"), kind === "identity",
      `cross-store query on ${kind}: ${sql}`);
    return source.query(sql, params);
  } } as unknown as Pool;
}

test("separate MCFT store supplies runtime and exact state while identity stays in Product store", async () => {
  const builder = new PostgresCustomerProductProjectionBuilderV1(splitPool(fakePool({runtimeScopeCount: 0}), "identity"), {
    mcftPool: splitPool(fakePool(), "mcft"),
    readApi: new FakeReadApi(),
  });
  const summary = await builder.buildFieldSummaryV1(scope, "field-a");
  assert.equal(summary.identity.display_name, "North Field 07");
  assert.equal(summary.current_condition.status, "AVAILABLE");
  assert.equal(summary.current_condition.root_zone_water?.available_water_fraction, 0.61);
  assert.ok(summary.envelope.source_authority_refs.some(ref => ref.exact_ref === "state-a"));
  const workspace = await builder.buildFieldWorkspaceV1(scope, "field-a");
  assert.equal(workspace.current_condition.status, "AVAILABLE");
});

test("empty configured MCFT store does not fall back to Product-store lineage", async () => {
  const builder = new PostgresCustomerProductProjectionBuilderV1(splitPool(fakePool(), "identity"), {
    mcftPool: splitPool(fakePool({runtimeScopeCount: 0}), "mcft"),
    readApi: new FakeReadApi(),
  });
  const summary = await builder.buildFieldSummaryV1(scope, "field-a");
  assert.equal(summary.current_condition.status, "UNAVAILABLE");
  assert.ok(summary.limitation_reason_codes.includes("MCFT_CURRENT_RUNTIME_NOT_ESTABLISHED"));
});

test("default canonical S4 reader opens its snapshot on the configured MCFT store", async () => {
  let opened = false;
  const identity = splitPool(fakePool(), "identity");
  (identity as any).connect = () => {throw new Error("IDENTITY_SNAPSHOT_FORBIDDEN");};
  const mcft = splitPool(fakePool(), "mcft");
  (mcft as any).connect = async () => {
    opened = true;
    return {release() {}, async query(sql: string) {
      if (sql.includes("transaction_timestamp")) return {rows: [{response_started_at: "2026-09-23T00:05:00.000Z", transaction_read_only: "on", transaction_isolation: "repeatable read"}]};
      if (sql.includes("twin_fact_visibility_epoch_v1")) throw new Error("FORMAL_VISIBILITY_SCHEMA_ABSENT");
      return {rows: []};
    }};
  };
  const builder = new PostgresCustomerProductProjectionBuilderV1(identity, {mcftPool: mcft});
  const summary = await builder.buildFieldSummaryV1(scope, "field-a");
  assert.equal(opened, true);
  assert.equal(summary.current_condition.status, "UNAVAILABLE");
  assert.ok(summary.limitation_reason_codes.includes("MCFT_READ_SURFACE_UNAVAILABLE"));
});
