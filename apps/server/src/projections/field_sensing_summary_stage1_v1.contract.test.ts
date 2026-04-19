import test from "node:test";
import assert from "node:assert/strict";

import {
  STAGE1_CUSTOMER_FACING_SUMMARY_CONTRACT_SHAPE,
  STAGE1_OFFICIAL_SUMMARY_SOIL_METRICS,
  STAGE1_SUMMARY_CUSTOMER_FORBIDDEN_FIELDS,
} from "../domain/sensing/stage1_sensing_contract_v1.js";
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

  assert.deepEqual(
    Object.keys(output).sort(),
    [...STAGE1_CUSTOMER_FACING_SUMMARY_CONTRACT_SHAPE.required_top_level_fields].sort(),
    "projection output fields must exactly match Stage-1 customer-facing summary contract required_top_level_fields"
  );

  for (const forbidden of STAGE1_SUMMARY_CUSTOMER_FORBIDDEN_FIELDS) {
    assert.equal((output as Record<string, unknown>)[forbidden], undefined, `forbidden field leaked into summary projection: ${forbidden}`);
  }
  for (const compatibilityOnlyField of ["irrigation_need_level", "sensor_quality", "sensing_overview", "fertility_state"] as const) {
    assert.equal((output as Record<string, unknown>)[compatibilityOnlyField], undefined, `compatibility-only field leaked into summary projection: ${compatibilityOnlyField}`);
  }

  assert.equal(output.sensor_quality_level, "GOOD");
  assert.equal((output as any).sensor_quality, undefined);
  assert.equal((output as any).irrigation_need_level, undefined);
  assert.equal((output as any).soil_indicators_json, undefined);

  assert.equal(output.official_soil_metrics_json.length, STAGE1_OFFICIAL_SUMMARY_SOIL_METRICS.length);
  const metrics = new Map(output.official_soil_metrics_json.map((x) => [x.metric, x]));
  assert.deepEqual(
    output.official_soil_metrics_json.map((x) => x.metric),
    [...STAGE1_OFFICIAL_SUMMARY_SOIL_METRICS],
    "official_soil_metrics_json must preserve Stage-1 summary soil metric contract ordering with no extra metrics"
  );
  assert.deepEqual(
    [...metrics.keys()].sort(),
    [...STAGE1_OFFICIAL_SUMMARY_SOIL_METRICS].sort(),
    "official_soil_metrics_json must contain only Stage-1 contract soil metrics with no additions"
  );
  assert.equal(metrics.get("soil_moisture_pct")?.value, 38);
  assert.equal(metrics.get("soil_moisture_pct")?.freshness, "fresh");
  assert.equal(metrics.get("ec_ds_m")?.value, 2.1);
  assert.equal(metrics.get("ec_ds_m")?.freshness, "fresh");
  assert.equal(metrics.get("n")?.value, 11);
  assert.equal(metrics.get("n")?.freshness, "fresh");
  assert.equal(metrics.get("p")?.value, null);
  assert.equal(metrics.get("p")?.freshness, "unknown");
  assert.equal(metrics.get("k")?.value, null);
  assert.equal(metrics.get("k")?.freshness, "unknown");
  assert.equal(metrics.get("fertility_index")?.value, null);
  assert.equal(metrics.get("fertility_index")?.freshness, "unknown");

  // Formal summary semantics: explicit freshness/confidence/null behavior.
  assert.equal(output.freshness, "fresh");
  assert.equal(output.confidence, 0.9);
  assert.equal(output.computed_at_ts_ms, 1_710_000_000_500);
});
