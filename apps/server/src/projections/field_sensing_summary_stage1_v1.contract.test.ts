import test from "node:test";
import assert from "node:assert/strict";

import { refreshFieldSensingSummaryStage1V1 } from "./field_sensing_summary_stage1_v1.js";

class FakePool {
  async query(sql: string): Promise<{ rows: any[] }> {
    if (sql.includes("FROM device_observation_index_v1")) {
      return {
        rows: [
          {
            device_id: "dev-1",
            metric: "soil_moisture_pct",
            observed_at_ts_ms: 1_710_000_000_000,
            value_num: 37.5,
            confidence: 0.8,
          },
          {
            device_id: "dev-1",
            metric: "soil_moisture",
            observed_at_ts_ms: 1_710_000_000_100,
            value_num: 38,
            confidence: 0.82,
          },
          {
            device_id: "dev-1",
            metric: "ec_ds_m",
            observed_at_ts_ms: 1_710_000_000_200,
            value_num: 2.1,
            confidence: 0.75,
          },
          {
            device_id: "dev-1",
            metric: "nitrogen",
            observed_at_ts_ms: 1_710_000_000_300,
            value_num: 11,
            confidence: 0.7,
          },
        ],
      };
    }

    if (sql.includes("FROM derived_sensing_state_index_v1")) {
      return {
        rows: [
          {
            state_type: "irrigation_need_state",
            payload_json: { level: "HIGH", action_hint: "legacy-only" },
            computed_at_ts_ms: 1_710_000_000_400,
            confidence: 0.6,
            source_observation_ids_json: ["obs-legacy"],
          },
          {
            state_type: "sensor_quality_state",
            payload_json: { level: "GOOD", sensor_quality: "good" },
            computed_at_ts_ms: 1_710_000_000_500,
            confidence: 0.9,
            source_observation_ids_json: ["obs-quality"],
          },
        ],
      };
    }

    if (sql.includes("INSERT INTO field_sensing_overview_v1")) return { rows: [] };
    if (sql.includes("INSERT INTO field_sensing_summary_stage1_v1")) return { rows: [] };

    return { rows: [] };
  }
}

test("field sensing summary stage1 v1 excludes compatibility and internal-only fields", async () => {
  const now = 1_710_000_111_000;
  const pool = new FakePool();

  const output = await refreshFieldSensingSummaryStage1V1(pool as any, {
    tenant_id: "t-1",
    project_id: "p-1",
    group_id: "g-1",
    field_id: "f-1",
    now_ms: now,
  });

  assert.equal(output.sensor_quality_level, "GOOD");
  assert.equal((output as any).sensor_quality, undefined);
  assert.equal((output as any).irrigation_need_level, undefined);
  assert.equal((output as any).soil_indicators_json, undefined);

  assert.equal(output.official_soil_metrics_json.length, 6);
  const metrics = new Map(output.official_soil_metrics_json.map((x) => [x.metric, x]));
  assert.equal(metrics.get("soil_moisture_pct")?.value, 37.5);
  assert.equal(metrics.get("ec_ds_m")?.value, 2.1);
  assert.equal(metrics.get("n")?.value, null);
  assert.equal(metrics.get("p")?.value, null);
  assert.equal(metrics.get("k")?.value, null);
  assert.equal(metrics.get("fertility_index")?.value, null);
});
