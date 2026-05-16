import test from "node:test";
import assert from "node:assert/strict";

import { appendDerivedSensingStateV1 } from "./derived_sensing_state_service_v1.js";

type DerivedRow = {
  tenant_id: string;
  project_id: string | null;
  group_id: string | null;
  field_id: string;
  state_type: string;
  payload_json: Record<string, unknown>;
  confidence: number | null;
  explanation_codes_json: string[];
  source_observation_ids_json: string[];
  source_device_ids_json: string[];
  computed_at: string;
  computed_at_ts_ms: number;
  fact_id: string;
};

class FakeDb {
  public derivedRows = new Map<string, DerivedRow>();

  async query(sql: string, params: any[] = []): Promise<{ rows: any[]; rowCount: number }> {
    if (sql.includes("INSERT INTO derived_sensing_state_index_v1")) {
      const row: DerivedRow = {
        tenant_id: String(params[0]),
        project_id: params[1] == null ? null : String(params[1]),
        group_id: params[2] == null ? null : String(params[2]),
        field_id: String(params[3]),
        state_type: String(params[4]),
        payload_json: JSON.parse(String(params[5])),
        confidence: params[6] == null ? null : Number(params[6]),
        explanation_codes_json: JSON.parse(String(params[7])),
        source_observation_ids_json: JSON.parse(String(params[8])),
        source_device_ids_json: JSON.parse(String(params[9])),
        computed_at: String(params[10]),
        computed_at_ts_ms: Number(params[11]),
        fact_id: String(params[12]),
      };
      const key = `${row.tenant_id}|${row.field_id}|${row.state_type}|${row.computed_at_ts_ms}`;
      this.derivedRows.set(key, row);
    }
    return { rows: [], rowCount: 1 };
  }
}

test("appendDerivedSensingStateV1 upsert replaces partial unknown payload with complete payload", async () => {
  const db = new FakeDb();
  const base = {
    tenant_id: "tenant_a",
    project_id: "project_a",
    group_id: "group_a",
    field_id: "field_a",
    state_type: "irrigation_effectiveness_state" as const,
    computed_at_ts_ms: 1_716_000_000_000,
    source: "test",
  };

  await appendDerivedSensingStateV1(db as any, {
    ...base,
    payload: { inlet_flow_lpm: null, outlet_flow_lpm: null, pressure_drop_kpa: null, level: "UNKNOWN" },
    confidence: 0.3,
    explanation_codes: ["WATER_FLOW_PARTIAL"],
    source_observation_ids: ["obs-1"],
    source_device_ids: ["dev-1"],
  });

  await appendDerivedSensingStateV1(db as any, {
    ...base,
    payload: { inlet_flow_lpm: 36.11, outlet_flow_lpm: 20.11, pressure_drop_kpa: 38.11, level: "LOW" },
    confidence: 0.92,
    explanation_codes: ["WATER_FLOW_TRIAD_COMPLETE"],
    source_observation_ids: ["obs-1", "obs-2", "obs-3"],
    source_device_ids: ["dev-1"],
  });

  const key = `${base.tenant_id}|${base.field_id}|${base.state_type}|${base.computed_at_ts_ms}`;
  const stored = db.derivedRows.get(key);
  assert.ok(stored);
  assert.deepEqual(stored.payload_json, {
    inlet_flow_lpm: 36.11,
    outlet_flow_lpm: 20.11,
    pressure_drop_kpa: 38.11,
    level: "LOW",
  });
  assert.equal(stored.confidence, 0.92);
  assert.deepEqual(stored.explanation_codes_json, ["WATER_FLOW_TRIAD_COMPLETE"]);
  assert.deepEqual(stored.source_observation_ids_json, ["obs-1", "obs-2", "obs-3"]);
  assert.deepEqual(stored.source_device_ids_json, ["dev-1"]);
});
