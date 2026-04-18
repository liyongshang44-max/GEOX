import test from "node:test";
import assert from "node:assert/strict";

import { refreshFieldSensingOverviewV1 } from "./field_sensing_overview_v1.js";

class FakePool {
  constructor(private readonly derivedRows: any[]) {}

  async query(sql: string): Promise<{ rows: any[] }> {
    if (sql.includes("FROM device_observation_index_v1")) {
      return { rows: [] };
    }
    if (sql.includes("FROM derived_sensing_state_index_v1")) {
      return { rows: this.derivedRows };
    }
    if (sql.includes("INSERT INTO field_sensing_overview_v1")) {
      return { rows: [] };
    }
    return { rows: [] };
  }
}

test("field sensing overview v1 maps official derived state names to summary fields", async () => {
  const now = 1_710_000_000_000;
  const pool = new FakePool([
    {
      state_type: "canopy_temperature_state",
      payload_json: { level: "ELEVATED" },
      computed_at_ts_ms: now - 10,
      confidence: 0.8,
      source_observation_ids_json: ["obs-canopy"],
    },
    {
      state_type: "evapotranspiration_risk_state",
      payload_json: { level: "HIGH" },
      computed_at_ts_ms: now - 9,
      confidence: 0.82,
      source_observation_ids_json: ["obs-et"],
    },
    {
      state_type: "sensor_quality_state",
      payload_json: { level: "DEGRADED" },
      computed_at_ts_ms: now - 8,
      confidence: 0.7,
      source_observation_ids_json: ["obs-quality"],
    },
    {
      state_type: "irrigation_effectiveness_state",
      payload_json: { level: "MEDIUM", action_hint: "reduce duration" },
      computed_at_ts_ms: now - 7,
      confidence: 0.66,
      source_observation_ids_json: ["obs-irrigation"],
    },
    {
      state_type: "leak_risk_state",
      payload_json: { level: "LOW" },
      computed_at_ts_ms: now - 6,
      confidence: 0.68,
      source_observation_ids_json: ["obs-leak"],
    },
  ]);

  const output = await refreshFieldSensingOverviewV1(pool as any, {
    tenant_id: "t-1",
    project_id: "p-1",
    group_id: "g-1",
    field_id: "f-1",
    now_ms: now,
  });

  assert.equal(output.canopy_temp_status, "elevated");
  assert.equal(output.evapotranspiration_risk, "high");
  assert.equal(output.irrigation_effectiveness, "medium");
  assert.equal(output.leak_risk, "low");
  assert.equal(output.sensor_quality_level, "FAIR");
  assert.equal(output.sensor_quality, "fair");
  assert.equal(output.irrigation_action_hint, "reduce duration");
});

test("field sensing overview v1 uses legacy states only as fallback", async () => {
  const now = 1_710_000_000_000;
  const pool = new FakePool([
    {
      state_type: "canopy_state",
      payload_json: { canopy_temp_status: "critical", evapotranspiration_risk: "high" },
      computed_at_ts_ms: now - 10,
      confidence: 0.5,
      source_observation_ids_json: ["obs-canopy-legacy"],
    },
    {
      state_type: "water_flow_state",
      payload_json: { irrigation_effectiveness: "low", leak_risk: "high" },
      computed_at_ts_ms: now - 9,
      confidence: 0.4,
      source_observation_ids_json: ["obs-water-legacy"],
    },
    {
      state_type: "irrigation_need_state",
      payload_json: { level: "HIGH", action_hint: "compat-hint" },
      computed_at_ts_ms: now - 8,
      confidence: 0.45,
      source_observation_ids_json: ["obs-need-legacy"],
    },
  ]);

  const output = await refreshFieldSensingOverviewV1(pool as any, {
    tenant_id: "t-1",
    project_id: "p-1",
    group_id: "g-1",
    field_id: "f-1",
    now_ms: now,
  });

  assert.equal(output.canopy_temp_status, "critical");
  assert.equal(output.evapotranspiration_risk, "high");
  assert.equal(output.irrigation_effectiveness, "low");
  assert.equal(output.leak_risk, "high");
  assert.equal(output.irrigation_need_level, "HIGH");
  assert.equal(output.irrigation_action_hint, "compat-hint");
  assert.equal(output.sensor_quality_level, null);
  assert.equal(output.sensor_quality, null);
});
