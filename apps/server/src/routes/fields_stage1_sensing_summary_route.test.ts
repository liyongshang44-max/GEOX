import test from "node:test";
import assert from "node:assert/strict";

import {
  STAGE1_REFRESH_SEMANTICS,
  STAGE1_RUNTIME_DIAGNOSTIC_BOUNDARY,
} from "../domain/sensing/stage1_sensing_contract_v1.js";
import { registerFieldsV1Routes } from "./fields_v1.js";

type RouteHandler = (req: any, reply: any) => Promise<unknown> | unknown;

class FakeReply {
  statusCode = 200;
  payload: unknown = null;

  status(code: number): this {
    this.statusCode = code;
    return this;
  }

  send(payload: unknown): unknown {
    this.payload = payload;
    return payload;
  }
}

class FakeApp {
  routes = new Map<string, RouteHandler>();
  log = { error: () => null };
  refreshFieldReadModelsWithObservabilityV1?: RouteRefreshStub;

  get(path: string, handler: RouteHandler): void { this.routes.set(`GET ${path}`, handler); }
  post(path: string, handler: RouteHandler): void { this.routes.set(`POST ${path}`, handler); }
  put(path: string, handler: RouteHandler): void { this.routes.set(`PUT ${path}`, handler); }
  patch(path: string, handler: RouteHandler): void { this.routes.set(`PATCH ${path}`, handler); }
  delete(path: string, handler: RouteHandler): void { this.routes.set(`DELETE ${path}`, handler); }
}

class FakePool {
  async query(sql: string): Promise<{ rowCount: number; rows: any[] }> {
    if (sql.includes("FROM field_index_v1")) return { rowCount: 1, rows: [{ ok: 1 }] };
    return { rowCount: 0, rows: [] };
  }
}

type RouteRefreshStub = (
  db: unknown,
  params: { tenant_id: string; project_id: string; group_id: string; field_id: string }
) => Promise<any>;

function buildAuthRequest(field_id: string): any {
  return {
    headers: { authorization: "Bearer fields-route-test-token" },
    params: { field_id },
  };
}

function buildRefreshedReadModels(field_id: string): any {
  const now = 1_710_000_010_000;
  return {
    sensing_summary_stage1: {
      payload: {
        tenant_id: "t-1",
        project_id: "p-1",
        group_id: "g-1",
        field_id,
        freshness: "fresh",
        confidence: 0.92,
        canopy_temp_status: "normal",
        evapotranspiration_risk: "low",
        sensor_quality_level: "GOOD",
        irrigation_effectiveness: "high",
        leak_risk: "low",
        official_soil_metrics_json: [
          { metric: "soil_moisture_pct", value: 35, confidence: 0.9, observed_at_ts_ms: now - 30_000, freshness: "fresh" },
        ],
        computed_at_ts_ms: now - 10_000,
        updated_ts_ms: now,
      },
      freshness: "fresh",
      status: "ok",
      refreshed_ts_ms: now,
      refresh_metrics: { refresh_total: 1, refresh_fail_total: 0, retry_total: 0, last_duration_ms: 1, last_success_ts_ms: now, last_failure_ts_ms: null, attempts: 1 },
      refresh_tracking: { last_success_ts: now, failure_count: 0, latency_ms: 1, attempts: 1 },
    },
    sensing_overview: {
      payload: { irrigation_need_level: "HIGH", sensor_quality: "good", soil_indicators_json: [{ metric: "soil_moisture_pct", value: 35 }] },
      freshness: "fresh",
      status: "ok",
      refreshed_ts_ms: now,
      refresh_metrics: { refresh_total: 1, refresh_fail_total: 0, retry_total: 0, last_duration_ms: 1, last_success_ts_ms: now, last_failure_ts_ms: null, attempts: 1 },
      refresh_tracking: { last_success_ts: now, failure_count: 0, latency_ms: 1, attempts: 1 },
    },
    fertility_state: {
      payload: { fertility_level: "good" },
      freshness: "fresh",
      status: "ok",
      refreshed_ts_ms: now,
      refresh_metrics: { refresh_total: 1, refresh_fail_total: 0, retry_total: 0, last_duration_ms: 1, last_success_ts_ms: now, last_failure_ts_ms: null, attempts: 1 },
      refresh_tracking: { last_success_ts: now, failure_count: 0, latency_ms: 1, attempts: 1 },
    },
  };
}

test("fields stage1 sensing-summary endpoint returns official customer-facing contract only", async () => {
  process.env.GEOX_TOKEN = "fields-route-test-token";
  process.env.GEOX_TENANT_ID = "t-1";
  process.env.GEOX_PROJECT_ID = "p-1";
  process.env.GEOX_GROUP_ID = "g-1";
  process.env.GEOX_SCOPES = "fields.read";

  const app = new FakeApp();
  app.refreshFieldReadModelsWithObservabilityV1 = async (_db, params) => buildRefreshedReadModels(params.field_id);
  registerFieldsV1Routes(app as any, new FakePool() as any);

  const handler = app.routes.get("GET /api/v1/fields/:field_id/sensing-summary");
  assert.ok(handler, "route must be registered");

  const reply = new FakeReply();
  await handler!(buildAuthRequest("f-1"), reply);
  const payload = reply.payload as Record<string, any>;

  assert.equal(reply.statusCode, 200);
  assert.equal(payload.ok, true);
  assert.equal(payload.endpoint_contract, "stage1_sensing_summary_v1");
  assert.equal(payload.contract_scope, "customer-facing Stage-1 sensing source-of-truth");
  assert.equal(payload.customer_facing_stage1_contract, true);
  assert.equal(payload.field_id, "f-1");
  assert.ok("stage1_sensing_summary" in payload);
  assert.ok(payload.stage1_sensing_summary);
  assert.ok("stage1_refresh" in payload);
  assert.equal(payload.stage1_refresh.freshness, "fresh");
  assert.equal(payload.stage1_refresh.status, "ok");
  assert.ok("refresh_semantics" in payload);
  assert.deepEqual(payload.refresh_semantics, STAGE1_REFRESH_SEMANTICS);
  assert.ok("sensing_runtime_boundary" in payload);
  assert.deepEqual(payload.sensing_runtime_boundary, STAGE1_RUNTIME_DIAGNOSTIC_BOUNDARY);

  // Must not expose internal/compatibility read-model fields at route top-level.
  assert.equal(payload.sensing_overview, undefined);
  assert.equal(payload.fertility_state, undefined);
  assert.equal(payload.irrigation_need_level, undefined);
  assert.equal(payload.sensor_quality, undefined);
});

test("fields mixed sensing-read-models endpoint is explicitly marked internal/debug/compatibility", async () => {
  process.env.GEOX_TOKEN = "fields-route-test-token";
  process.env.GEOX_TENANT_ID = "t-1";
  process.env.GEOX_PROJECT_ID = "p-1";
  process.env.GEOX_GROUP_ID = "g-1";
  process.env.GEOX_SCOPES = "fields.read";

  const app = new FakeApp();
  app.refreshFieldReadModelsWithObservabilityV1 = async (_db, params) => buildRefreshedReadModels(params.field_id);
  registerFieldsV1Routes(app as any, new FakePool() as any);

  const handler = app.routes.get("GET /api/v1/fields/:field_id/sensing-read-models");
  assert.ok(handler, "route must be registered");

  const reply = new FakeReply();
  await handler!(buildAuthRequest("f-2"), reply);
  const payload = reply.payload as Record<string, any>;

  assert.equal(reply.statusCode, 200);
  assert.equal(payload.endpoint_contract, "internal_sensing_read_models_v1");
  assert.match(payload.contract_scope, /internal\/debug\/compatibility only/i);
  assert.match(payload.contract_scope, /non-authoritative/i);
  assert.match(payload.contract_scope, /not source-of-truth/i);
  assert.equal(payload.customer_facing_stage1_contract, false);

  // Internal endpoint intentionally contains mixed read models.
  assert.ok(payload.sensing_overview);
  assert.ok(payload.sensing_summary_stage1);
  assert.ok(payload.fertility_state);
  assert.equal(payload.status.sensing_summary_stage1, "ok");
  assert.equal(payload.freshness.sensing_summary_stage1, "fresh");
});

test("fields detail route exposes stage1 sensing summary aligned with formal contract payload", async () => {
  process.env.GEOX_TOKEN = "fields-route-test-token";
  process.env.GEOX_TENANT_ID = "t-1";
  process.env.GEOX_PROJECT_ID = "p-1";
  process.env.GEOX_GROUP_ID = "g-1";
  process.env.GEOX_SCOPES = "fields.read";

  const app = new FakeApp();
  app.refreshFieldReadModelsWithObservabilityV1 = async (_db, params) => buildRefreshedReadModels(params.field_id);
  registerFieldsV1Routes(app as any, new FakePool() as any);

  const handler = app.routes.get("GET /api/v1/fields/:field_id");
  assert.ok(handler, "route must be registered");

  const reply = new FakeReply();
  await handler!(buildAuthRequest("f-3"), reply);
  const payload = reply.payload as Record<string, any>;
  const expected = buildRefreshedReadModels("f-3");

  assert.equal(reply.statusCode, 200);
  assert.equal(payload.ok, true);
  assert.equal(payload.stage1_sensing_contract, "stage1_sensing_summary_v1");
  assert.deepEqual(payload.stage1_sensing_summary, expected.sensing_summary_stage1.payload);
  assert.equal(payload.stage1_sensing_refresh.freshness, expected.sensing_summary_stage1.freshness);
  assert.equal(payload.stage1_sensing_refresh.status, expected.sensing_summary_stage1.status);
  assert.equal(payload.stage1_sensing_refresh.refreshed_ts_ms, expected.sensing_summary_stage1.refreshed_ts_ms);
});
