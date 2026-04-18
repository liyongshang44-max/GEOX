import test from "node:test";
import assert from "node:assert/strict";

import {
  STAGE1_CUSTOMER_FACING_SUMMARY_CONTRACT_SHAPE,
  STAGE1_CUSTOMER_SUMMARY_FIELDS,
  STAGE1_INPUT_CONTRACT_LAYERS,
  STAGE1_OFFICIAL_DERIVED_STATES,
  STAGE1_OFFICIAL_PIPELINE_CANONICAL_INPUT_METRICS,
  STAGE1_OFFICIAL_SOIL_METRICS_SUMMARY_SUBSTRUCTURE,
  STAGE1_OFFICIAL_SUMMARY_SOIL_METRICS,
  STAGE1_REFRESH_SEMANTICS,
  STAGE1_SENSOR_QUALITY_DIAGNOSTIC_STATUS,
  STAGE1_SUMMARY_CUSTOMER_FORBIDDEN_FIELDS,
  STAGE1_SUMMARY_INTERNAL_ONLY_FIELDS,
} from "./stage1_sensing_contract_v1.js";
import {
  STAGE1_OFFICIAL_PIPELINE_CANONICAL_INPUT_METRICS_V1,
  STAGE1_SENSING_INPUT_MAPPING_V1,
} from "./stage1_sensing_input_mapping_v1.js";
import { refreshFieldSensingSummaryStage1V1 } from "../../projections/field_sensing_summary_stage1_v1.js";
import { registerDashboardV1Routes } from "../../routes/dashboard_v1.js";
import { registerFieldsV1Routes } from "../../routes/fields_v1.js";

type RouteHandler = (req: any, reply: any) => Promise<unknown> | unknown;

class FakeReply {
  statusCode = 200;
  payload: unknown = null;
  status(code: number): this { this.statusCode = code; return this; }
  send(payload: unknown): unknown { this.payload = payload; return payload; }
}

class FakeApp {
  routes = new Map<string, RouteHandler>();
  log = { error: () => null };
  refreshFieldReadModelsWithObservabilityV1?: (db: unknown, params: any) => Promise<any>;
  get(path: string, handler: RouteHandler): void { this.routes.set(`GET ${path}`, handler); }
  post(path: string, handler: RouteHandler): void { this.routes.set(`POST ${path}`, handler); }
  put(path: string, handler: RouteHandler): void { this.routes.set(`PUT ${path}`, handler); }
  patch(path: string, handler: RouteHandler): void { this.routes.set(`PATCH ${path}`, handler); }
  delete(path: string, handler: RouteHandler): void { this.routes.set(`DELETE ${path}`, handler); }
}

class FakePoolForProjection {
  async query(sql: string): Promise<{ rows: any[]; rowCount?: number }> {
    if (sql.includes("FROM device_observation_index_v1")) {
      return {
        rows: [
          { device_id: "d-1", metric: "soil_moisture_pct", observed_at_ts_ms: 1_710_000_000_000, value_num: 36, confidence: 0.8 },
          { device_id: "d-1", metric: "ec_ds_m", observed_at_ts_ms: 1_710_000_000_100, value_num: 2.2, confidence: 0.75 },
          { device_id: "d-1", metric: "soil_moisture", observed_at_ts_ms: 1_710_000_000_100, value_num: 37, confidence: 0.82 },
        ],
      };
    }
    if (sql.includes("FROM derived_sensing_state_index_v1")) {
      return {
        rows: [
          { state_type: "sensor_quality_state", payload_json: { level: "GOOD" }, computed_at_ts_ms: 1_710_000_000_500, confidence: 0.9, source_observation_ids_json: ["obs-1"] },
          { state_type: "canopy_temperature_state", payload_json: { status: "normal" }, computed_at_ts_ms: 1_710_000_000_500, confidence: 0.9, source_observation_ids_json: ["obs-1"] },
          { state_type: "evapotranspiration_risk_state", payload_json: { risk: "low" }, computed_at_ts_ms: 1_710_000_000_500, confidence: 0.9, source_observation_ids_json: ["obs-1"] },
          { state_type: "irrigation_effectiveness_state", payload_json: { level: "high" }, computed_at_ts_ms: 1_710_000_000_500, confidence: 0.9, source_observation_ids_json: ["obs-1"] },
          { state_type: "leak_risk_state", payload_json: { level: "low" }, computed_at_ts_ms: 1_710_000_000_500, confidence: 0.9, source_observation_ids_json: ["obs-1"] },
        ],
      };
    }
    return { rows: [], rowCount: 1 };
  }
}

class FakePoolForRoutes {
  async query(sql: string): Promise<{ rowCount: number; rows: any[] }> {
    if (sql.includes("FROM field_index_v1")) return { rowCount: 1, rows: [{ ok: 1 }] };
    return { rowCount: 0, rows: [] };
  }
}

function buildAuthReq(field_id: string): any {
  return { headers: { authorization: "Bearer consistency-token" }, params: { field_id } };
}

function buildRefreshed(field_id: string): any {
  const now = 1_710_000_010_000;
  return {
    sensing_summary_stage1: {
      payload: {
        tenant_id: "t-1",
        project_id: "p-1",
        group_id: "g-1",
        field_id,
        freshness: "fresh",
        confidence: 0.93,
        canopy_temp_status: "normal",
        evapotranspiration_risk: "low",
        sensor_quality_level: "GOOD",
        irrigation_effectiveness: "high",
        leak_risk: "low",
        official_soil_metrics_json: STAGE1_OFFICIAL_SUMMARY_SOIL_METRICS.map((metric) => ({
          metric, value: metric === "soil_moisture_pct" ? 35 : null, confidence: metric === "soil_moisture_pct" ? 0.9 : null, observed_at_ts_ms: metric === "soil_moisture_pct" ? now - 1000 : null, freshness: metric === "soil_moisture_pct" ? "fresh" : "unknown",
        })),
        computed_at_ts_ms: now - 5000,
        updated_ts_ms: now,
      },
      freshness: "fresh",
      status: "ok",
      refreshed_ts_ms: now,
      refresh_metrics: { refresh_total: 1, refresh_fail_total: 0, retry_total: 0, last_duration_ms: 1, last_success_ts_ms: now, last_failure_ts_ms: null, attempts: 1 },
      refresh_tracking: { last_success_ts: now, failure_count: 0, latency_ms: 1, attempts: 1 },
    },
    sensing_overview: { payload: { soil_indicators_json: [] }, freshness: "fresh", status: "ok", refreshed_ts_ms: now, refresh_metrics: {}, refresh_tracking: {} },
    fertility_state: { payload: { fertility_level: "good" }, freshness: "fresh", status: "ok", refreshed_ts_ms: now, refresh_metrics: {}, refresh_tracking: {} },
  };
}

test("contract and mapping remain aligned on layered semantics", () => {
  assert.equal(STAGE1_INPUT_CONTRACT_LAYERS.source_of_truth_layer, "official_pipeline_input_whitelist");
  assert.equal(STAGE1_INPUT_CONTRACT_LAYERS.aggregate_field_layer, "official_pipeline_aggregate_fields");
  assert.equal(STAGE1_INPUT_CONTRACT_LAYERS.summary_display_subset_layer, "official_customer_summary_soil_metrics_subset");
  assert.equal(STAGE1_INPUT_CONTRACT_LAYERS.source_of_truth_module, "stage1_sensing_input_mapping_v1");

  assert.deepEqual(STAGE1_INPUT_CONTRACT_LAYERS.official_pipeline_input_whitelist, STAGE1_OFFICIAL_PIPELINE_CANONICAL_INPUT_METRICS);
  assert.deepEqual(STAGE1_INPUT_CONTRACT_LAYERS.official_customer_summary_soil_metrics_subset, STAGE1_OFFICIAL_SUMMARY_SOIL_METRICS);
  assert.deepEqual(
    [...STAGE1_OFFICIAL_PIPELINE_CANONICAL_INPUT_METRICS].sort(),
    Object.keys(STAGE1_SENSING_INPUT_MAPPING_V1).sort(),
    "official pipeline canonical input whitelist must equal official mapping metric keys"
  );
  for (const [metric, entry] of Object.entries(STAGE1_SENSING_INPUT_MAPPING_V1)) {
    assert.equal(entry.metric, metric, `mapping entry.metric must match key for ${metric}`);
  }

  const allMappedDerivedStates = new Set(
    Object.values(STAGE1_SENSING_INPUT_MAPPING_V1).flatMap((entry) => entry.downstream_derived_states)
  );
  allMappedDerivedStates.add(STAGE1_SENSOR_QUALITY_DIAGNOSTIC_STATUS.derived_state_type);
  for (const state of STAGE1_OFFICIAL_DERIVED_STATES) assert.ok(allMappedDerivedStates.has(state), `derived state missing from mapping/official diagnostics contract: ${state}`);

  assert.ok(STAGE1_OFFICIAL_PIPELINE_CANONICAL_INPUT_METRICS_V1.length > 0);
  for (const field of STAGE1_CUSTOMER_SUMMARY_FIELDS) {
    assert.ok(STAGE1_CUSTOMER_FACING_SUMMARY_CONTRACT_SHAPE.required_top_level_fields.includes(field));
  }
  for (const field of STAGE1_SUMMARY_INTERNAL_ONLY_FIELDS) {
    assert.ok(STAGE1_SUMMARY_CUSTOMER_FORBIDDEN_FIELDS.includes(field as typeof STAGE1_SUMMARY_CUSTOMER_FORBIDDEN_FIELDS[number]));
  }
});

test("contract and projection remain aligned for summary payload shape and soil metric whitelist", async () => {
  const payload = await refreshFieldSensingSummaryStage1V1(new FakePoolForProjection() as any, {
    tenant_id: "t-1",
    project_id: "p-1",
    group_id: "g-1",
    field_id: "f-1",
    now_ms: 1_710_000_020_000,
  });

  const payloadKeys = Object.keys(payload).sort();
  const requiredKeys = [...STAGE1_CUSTOMER_FACING_SUMMARY_CONTRACT_SHAPE.required_top_level_fields].sort();
  assert.deepEqual(payloadKeys, requiredKeys);

  const metricKeys = payload.official_soil_metrics_json.map((x) => x.metric);
  assert.deepEqual(metricKeys, [...STAGE1_OFFICIAL_SOIL_METRICS_SUMMARY_SUBSTRUCTURE.ordered_metrics]);
  assert.deepEqual(
    [...metricKeys].sort(),
    [...STAGE1_OFFICIAL_SUMMARY_SOIL_METRICS].sort(),
    "projection summary soil metric subset must match contract subset exactly"
  );

  for (const forbidden of STAGE1_SUMMARY_CUSTOMER_FORBIDDEN_FIELDS) {
    assert.equal((payload as Record<string, unknown>)[forbidden], undefined, `forbidden field leaked: ${forbidden}`);
  }
});

function assertSummaryRoutePayloadAligned(payload: Record<string, any>): void {
  assert.equal(payload.endpoint_contract, "stage1_sensing_summary_v1");
  assert.deepEqual(
    Object.keys(payload.stage1_sensing_summary).sort(),
    [...STAGE1_CUSTOMER_FACING_SUMMARY_CONTRACT_SHAPE.required_top_level_fields].sort()
  );
  for (const forbidden of STAGE1_SUMMARY_CUSTOMER_FORBIDDEN_FIELDS) {
    assert.equal(payload.stage1_sensing_summary[forbidden], undefined, `forbidden field leaked from route payload: ${forbidden}`);
  }
  assert.deepEqual(payload.refresh_semantics, STAGE1_REFRESH_SEMANTICS);
}

test("contract and fields route stay aligned for official sensing endpoint", async () => {
  process.env.GEOX_TOKEN = "consistency-token";
  process.env.GEOX_TENANT_ID = "t-1";
  process.env.GEOX_PROJECT_ID = "p-1";
  process.env.GEOX_GROUP_ID = "g-1";
  process.env.GEOX_SCOPES = "fields.read,ao_act.index.read";

  const pool = new FakePoolForRoutes();
  const fieldsApp = new FakeApp();
  fieldsApp.refreshFieldReadModelsWithObservabilityV1 = async (_db, params) => buildRefreshed(params.field_id);
  registerFieldsV1Routes(fieldsApp as any, pool as any);

  const fieldsHandler = fieldsApp.routes.get("GET /api/v1/fields/:field_id/sensing-summary");
  assert.ok(fieldsHandler);

  const fieldsReply = new FakeReply();
  await fieldsHandler!(buildAuthReq("f-1"), fieldsReply);
  const fieldsPayload = fieldsReply.payload as Record<string, any>;
  assertSummaryRoutePayloadAligned(fieldsPayload);
});

test("contract and dashboard route stay aligned for official sensing endpoint", async () => {
  process.env.GEOX_TOKEN = "consistency-token";
  process.env.GEOX_TENANT_ID = "t-1";
  process.env.GEOX_PROJECT_ID = "p-1";
  process.env.GEOX_GROUP_ID = "g-1";
  process.env.GEOX_SCOPES = "fields.read,ao_act.index.read";

  const pool = new FakePoolForRoutes();
  const dashboardApp = new FakeApp();
  dashboardApp.refreshFieldReadModelsWithObservabilityV1 = async (_db, params) => buildRefreshed(params.field_id);
  registerDashboardV1Routes(dashboardApp as any, pool as any);

  const dashboardHandler = dashboardApp.routes.get("GET /api/v1/dashboard/fields/:field_id/sensing-summary");
  assert.ok(dashboardHandler);

  const dashboardReply = new FakeReply();
  await dashboardHandler!(buildAuthReq("f-1"), dashboardReply);
  const dashboardPayload = dashboardReply.payload as Record<string, any>;
  assertSummaryRoutePayloadAligned(dashboardPayload);
});

test("forbidden-fields consistency is enforced in customer-facing summary contracts", () => {
  const required = new Set(STAGE1_CUSTOMER_FACING_SUMMARY_CONTRACT_SHAPE.required_top_level_fields);
  const forbidden = new Set(STAGE1_SUMMARY_CUSTOMER_FORBIDDEN_FIELDS);

  for (const field of STAGE1_SUMMARY_INTERNAL_ONLY_FIELDS) {
    assert.ok(forbidden.has(field), `internal-only field must be forbidden in customer-facing summary contract: ${field}`);
  }
  assert.ok(forbidden.has("sensing_overview"), "mixed overview payload field must remain forbidden");
  assert.ok(forbidden.has("fertility_state"), "mixed overview payload field must remain forbidden");
  for (const field of forbidden) {
    assert.ok(!required.has(field as any), `forbidden field must not appear in customer-facing summary required shape: ${field}`);
  }
});
