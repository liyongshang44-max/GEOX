import test from "node:test";
import assert from "node:assert/strict";

import { refreshFieldReadModelsWithObservabilityV1 } from "./field_read_model_refresh_v1.js";

class FakePool {
  async query(sql: string): Promise<{ rows: any[] }> {
    if (sql.includes("FROM device_observation_index_v1")) {
      return { rows: [] };
    }

    if (sql.includes("FROM derived_sensing_state_index_v1")) {
      if (sql.includes("DISTINCT ON (state_type)")) {
        // fertility projection query: return no official fertility rows.
        return { rows: [] };
      }
      // sensing overview derived-state query:
      // only compatibility-only irrigation_need_state exists.
      return {
        rows: [
          {
            state_type: "irrigation_need_state",
            payload_json: {
              level: "HIGH",
              irrigation_need_level: "HIGH",
              action_hint: "legacy-only-hint",
            },
            computed_at_ts_ms: 1_710_000_000_000,
            confidence: 0.6,
            source_observation_ids_json: ["obs-legacy-only"],
          },
        ],
      };
    }

    if (sql.includes("INSERT INTO field_sensing_overview_v1")) {
      return { rows: [] };
    }

    if (sql.includes("INSERT INTO field_fertility_state_v1")) {
      return { rows: [] };
    }

    return { rows: [] };
  }
}

test("refresh read models: compatibility-only irrigation_need_level does not satisfy sensing hasData", async () => {
  const pool = new FakePool();

  const output = await refreshFieldReadModelsWithObservabilityV1(pool as any, {
    tenant_id: "t-1",
    project_id: "p-1",
    group_id: "g-1",
    field_id: "f-1",
  });

  assert.equal(output.sensing_overview.status, "no_data");
  assert.equal(output.sensing_overview.freshness, "unknown");

  const sensingPayload = output.sensing_overview.payload;
  assert.ok(sensingPayload);
  assert.equal(sensingPayload?.irrigation_need_level, "HIGH");

  // official stage-1 sensing summary fields remain empty.
  assert.deepEqual(sensingPayload?.soil_indicators_json, []);
  assert.equal(sensingPayload?.canopy_temp_status, null);
  assert.equal(sensingPayload?.evapotranspiration_risk, null);
  assert.equal(sensingPayload?.sensor_quality_level, null);
  assert.equal(sensingPayload?.sensor_quality, null);
  assert.equal(sensingPayload?.irrigation_effectiveness, null);
  assert.equal(sensingPayload?.leak_risk, null);
  assert.equal(sensingPayload?.computed_at_ts_ms, null);
  assert.equal(sensingPayload?.source_observed_at_ts_ms, null);
});
