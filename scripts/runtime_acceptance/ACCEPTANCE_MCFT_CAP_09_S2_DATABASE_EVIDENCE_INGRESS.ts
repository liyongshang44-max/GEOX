import assert from "node:assert/strict";

import {
  DATABASE_EVIDENCE_INGRESS_CONFIG_V1,
  PostgresEvidenceIngressAdapterV1,
} from "../../apps/server/src/runtime/twin_runtime/postgres_evidence_ingress_adapter_v1.js";
import type { ShadowOnlineBoundaryV1, TwinScopeKeyV1 } from "../../apps/server/src/runtime/twin_runtime/ports.js";

const scope: TwinScopeKeyV1 = {
  tenant_id: "tenantA",
  project_id: "projectA",
  group_id: "groupA",
  field_id: "fieldA",
  season_id: "seasonA",
  zone_id: "zoneA",
};
const boundary: ShadowOnlineBoundaryV1 = {
  scope,
  slot_id: "O10",
  logical_time: "2026-08-05T10:00:00.000Z",
  scheduler_wall_clock_observed_at: "2026-08-05T10:00:02.000Z",
  interval_seconds: 3600,
};
const record = (overrides: Record<string, unknown> = {}) => ({
  type: "telemetry_observation_v1",
  payload: {
    ...scope,
    device_id: "deviceA",
    metric: "soil_moisture",
    observed_at: "2026-08-05T09:00:00.000Z",
    available_to_runtime_at: "2026-08-05T09:05:00.000Z",
    quality: { status: "VALID" },
    ...overrides,
  },
});
const rows = [
  { fact_id: "f01", occurred_at: "2026-08-05T09:00:00.000Z", ingested_at: "2026-08-05T09:05:00.000Z", record_json: record() },
  { fact_id: "f02", occurred_at: "2026-08-05T09:00:00.000Z", ingested_at: "2026-08-05T09:10:00.000Z", record_json: record({ available_to_runtime_at: "2026-08-05T09:10:00.000Z" }) },
  { fact_id: "f03", occurred_at: "2026-08-05T09:30:00.000Z", ingested_at: "2026-08-05T09:31:00.000Z", record_json: record({ metric: "air_temperature", observed_at: "2026-08-05T09:30:00.000Z", available_to_runtime_at: "2026-08-05T09:31:00.000Z" }) },
  { fact_id: "f04", occurred_at: "2026-08-05T10:05:00.000Z", ingested_at: "2026-08-05T10:05:00.000Z", record_json: record({ metric: "after", observed_at: "2026-08-05T10:05:00.000Z", available_to_runtime_at: "2026-08-05T10:05:00.000Z" }) },
  { fact_id: "f05", occurred_at: "2026-08-05T09:40:00.000Z", ingested_at: "2026-08-05T10:02:00.000Z", record_json: record({ metric: "late_ingest", observed_at: "2026-08-05T09:40:00.000Z", available_to_runtime_at: "2026-08-05T10:02:00.000Z" }) },
  { fact_id: "f06", occurred_at: "2026-08-05T09:45:00.000Z", ingested_at: "2026-08-05T09:46:00.000Z", record_json: record({ metric: "late_available", observed_at: "2026-08-05T09:45:00.000Z", available_to_runtime_at: "2026-08-05T10:03:00.000Z" }) },
  { fact_id: "f07", occurred_at: "2026-08-05T09:20:00.000Z", ingested_at: "2026-08-05T09:21:00.000Z", record_json: record({ metric: "future", observed_at: "2026-08-05T09:20:00.000Z", available_to_runtime_at: "2026-08-05T09:21:00.000Z", epistemic_class: "FUTURE_ASSUMPTION" }) },
  { fact_id: "f08", occurred_at: "2026-08-05T09:25:00.000Z", ingested_at: "2026-08-05T09:26:00.000Z", record_json: record({ metric: "bad_quality", observed_at: "2026-08-05T09:25:00.000Z", available_to_runtime_at: "2026-08-05T09:26:00.000Z", quality: { status: "INVALID" } }) },
  { fact_id: "f09", occurred_at: "2026-08-05T09:15:00.000Z", ingested_at: "2026-08-05T09:16:00.000Z", record_json: record({ field_id: "fieldB", metric: "wrong_scope", observed_at: "2026-08-05T09:15:00.000Z", available_to_runtime_at: "2026-08-05T09:16:00.000Z" }) },
];
const calls: Array<{ sql: string; values: unknown[] }> = [];
const pool = {
  async query<T>(sql: string, values: unknown[]) {
    calls.push({ sql, values });
    return { rows: rows as T[] };
  },
};
async function main(): Promise<void> {
  const adapter = new PostgresEvidenceIngressAdapterV1(pool as never, DATABASE_EVIDENCE_INGRESS_CONFIG_V1);
  const first = await adapter.freezeEligibleEvidence({ boundary });
  const second = await adapter.freezeEligibleEvidence({ boundary });
  assert.deepEqual(second, first, "deterministic repeated freeze");
  assert.equal(calls.length, 2);
  for (const call of calls) {
    assert.match(call.sql, /FROM facts/);
    assert.match(call.sql, /ORDER BY occurred_at ASC, ingested_at ASC, fact_id ASC/);
    assert.doesNotMatch(call.sql, /\b(INSERT|UPDATE|DELETE|ALTER|CREATE|DROP)\b/i);
    assert.equal(call.values[0], scope.tenant_id);
    assert.equal(call.values[5], scope.zone_id);
    assert.equal(call.values[9], DATABASE_EVIDENCE_INGRESS_CONFIG_V1.max_candidate_records);
  }
  assert.deepEqual(first.selected.map((item) => item.evidence_ref), ["fact:f02", "fact:f03"]);
  assert.equal(first.coverage_ratio_decimal, "1.000000");
  assert.equal(first.maximum_gap_seconds, 1800);
  assert.equal(first.freshest_observed_at, "2026-08-05T09:30:00.000Z");
  assert.equal(first.freshness_status, "FRESH");
  assert.equal(first.future_evidence_leakage, false);
  const reasons = new Map(first.excluded.map((item) => [item.evidence_ref, item.reason]));
  assert.equal(reasons.get("fact:f01"), "DUPLICATE_SUPERSEDED");
  assert.equal(reasons.get("fact:f04"), "OBSERVED_AFTER_BOUNDARY");
  assert.equal(reasons.get("fact:f05"), "INGESTED_AFTER_BOUNDARY");
  assert.equal(reasons.get("fact:f06"), "AVAILABLE_AFTER_BOUNDARY");
  assert.equal(reasons.get("fact:f07"), "FUTURE_EVIDENCE");
  assert.equal(reasons.get("fact:f08"), "QUALITY_INELIGIBLE");
  assert.equal(reasons.get("fact:f09"), "SCOPE_MISMATCH");
  assert(first.selected.every((item) => Date.parse(item.observed_at) <= Date.parse(boundary.logical_time)));
  console.log(JSON.stringify({
    status: "PASS",
    selected: first.selected.length,
    excluded: first.excluded.length,
    future_evidence_leakage: first.future_evidence_leakage,
    database_write_performed: false,
    scheduler_loop_executed: false,
    canonical_write_performed: false,
  }, null, 2));
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
