import test from "node:test";
import assert from "node:assert/strict";

import { projectFieldPortfolioListV1 } from "./field_portfolio_v1";

class FakePool {
  async query(sql: string): Promise<{ rows: any[] }> {
    if (sql.includes("FROM field_index_v1")) {
      return {
        rows: [
          { field_id: "f-1", name: "Alpha" },
          { field_id: "f-2", name: "Beta" },
        ],
      };
    }
    if (sql.includes("FROM operation_plan_index_v1")) {
      return {
        rows: [
          { field_id: "f-1", operation_id: "op-1", action_type: "SPRAY", status: "DONE", updated_ts_ms: 1_000 },
          { field_id: "f-2", operation_id: "op-2", action_type: "IRRIGATE", status: "DONE", updated_ts_ms: 2_000 },
        ],
      };
    }
    if (sql.includes("FROM facts")) {
      return {
        rows: [
          {
            occurred_at: new Date(4_000).toISOString(),
            record_json: {
              identifiers: { field_id: "f-1" },
              generated_at: new Date(4_000).toISOString(),
              risk: { level: "MEDIUM", reasons: ["report-medium"] },
              execution: {
                final_status: "PENDING_ACCEPTANCE",
                execution_finished_at: new Date(4_000).toISOString(),
                action_type: "SPRAY",
              },
              cost: { estimated_total: 10.111, actual_total: 9.999 },
            },
          },
          {
            occurred_at: new Date(5_000).toISOString(),
            record_json: {
              identifiers: { field_id: "f-2" },
              generated_at: new Date(5_000).toISOString(),
              risk: { level: "LOW", reasons: ["report-low"] },
              execution: {
                final_status: "INVALID_EXECUTION",
                execution_finished_at: new Date(5_000).toISOString(),
                action_type: "IRRIGATE",
              },
              cost: { estimated_total: 20.222, actual_total: 19.888 },
            },
          },
        ],
      };
    }
    if (sql.includes("FROM alert_event_index_v1")) {
      return {
        rows: [
          { object_type: "FIELD", object_id: "f-1", severity: "CRITICAL", status: "OPEN", reasons: ["alert-critical"] },
          { object_type: "FIELD", object_id: "f-2", severity: "LOW", status: "OPEN", reasons: ["alert-low"] },
        ],
      };
    }
    if (sql.includes("FROM device_status_index_v1")) {
      return {
        rows: [
          { device_id: "d-1", field_id: "f-1", last_telemetry_ts_ms: 1_000, last_heartbeat_ts_ms: 1_000 },
          { device_id: "d-2", field_id: "f-2", last_telemetry_ts_ms: 2_000, last_heartbeat_ts_ms: 2_000 },
        ],
      };
    }
    if (sql.includes("FROM field_tags_v1")) {
      return {
        rows: [
          { field_id: "f-1", tag: "north" },
          { field_id: "f-2", tag: "south" },
        ],
      };
    }
    return { rows: [] };
  }
}

const tenant = { tenant_id: "t-1", project_id: "p-1", group_id: "g-1" };

test("field portfolio v1: uses unified risk/filter/sort/summary fields", async () => {
  const pool = new FakePool();
  const output = await projectFieldPortfolioListV1({
    pool: pool as any,
    tenant,
    nowMs: 20 * 60 * 1000,
    risk_levels: ["CRITICAL", "LOW"],
    has_open_alerts: true,
    sort_by: "pending_acceptance",
    sort_order: "desc",
  });

  assert.equal(output.total, 2);
  assert.equal(output.items[0]?.field_id, "f-1");
  assert.equal(output.items[0]?.risk_level, "CRITICAL");
  assert.deepEqual(output.items[0]?.risk_reasons, ["alert-critical", "report-medium"]);
  assert.equal(output.items[0]?.alert_summary.open_count, 1);
  assert.equal(output.items[0]?.pending_acceptance_summary.pending_acceptance_count, 1);

  assert.equal(output.summary.by_risk.critical, 1);
  assert.equal(output.summary.by_risk.low, 1);
  assert.equal(output.summary.total_open_alerts, 2);
  assert.equal(output.summary.total_pending_acceptance, 1);
  assert.equal(output.summary.total_invalid_execution, 1);
  assert.equal(output.summary.total_estimated_cost, 30.33);
  assert.equal(output.summary.total_actual_cost, 29.89);
});

test("field portfolio v1: supports filter by pending acceptance", async () => {
  const pool = new FakePool();
  const output = await projectFieldPortfolioListV1({
    pool: pool as any,
    tenant,
    nowMs: 20 * 60 * 1000,
    has_pending_acceptance: true,
  });

  assert.equal(output.total, 1);
  assert.equal(output.items[0]?.field_id, "f-1");
});
