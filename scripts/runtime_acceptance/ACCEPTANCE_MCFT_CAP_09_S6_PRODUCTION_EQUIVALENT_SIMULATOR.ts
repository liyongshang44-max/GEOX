import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

import { semanticHashV1 } from "../../apps/server/src/domain/twin_runtime/canonical_identity_v1.js";
import {
  DATABASE_EVIDENCE_INGRESS_CONFIG_V1,
  PRODUCTION_EQUIVALENT_SIMULATION_EVIDENCE_INGRESS_CONFIG_V1,
  PostgresEvidenceIngressAdapterV1,
} from "../../apps/server/src/runtime/twin_runtime/postgres_evidence_ingress_adapter_v1.js";
import type { TwinScopeKeyV1 } from "../../apps/server/src/runtime/twin_runtime/ports.js";
import {
  buildSimulationWindowV1,
  simulationLeaseOwnerV1,
  SIMULATION_SOURCE_LANE_V1,
} from "./mcft_cap09_s6_production_equivalent_simulator_v1.js";

const OUT = path.resolve("acceptance-output/MCFT_CAP_09_S6_PRODUCTION_EQUIVALENT_SIMULATOR_ACCEPTANCE.json");
const scope: TwinScopeKeyV1 = {
  tenant_id: "tenant_mcft", project_id: "project_mcft", group_id: "group_mcft",
  field_id: "field_mcft", season_id: "season_2026", zone_id: "zone_root",
};
const input = {
  scope,
  run_id: "acceptance_run_001",
  seed: 904_2026,
  window_start_utc: "2026-08-08T00:00:00.000Z",
};

async function main(): Promise<void> {
  const subjectSha = "d86448c816eb5af5c0809f4af6d8eec4ca20eb20";
  const acceleratedLeaseOwner = simulationLeaseOwnerV1({ operation: "accelerated", subject_sha: subjectSha });
  assert.equal(
    simulationLeaseOwnerV1({ operation: "accelerated", subject_sha: subjectSha }),
    acceleratedLeaseOwner,
    "SIMULATION_LEASE_OWNER_MUST_BE_STABLE_WITHIN_OPERATION",
  );
  assert.notEqual(
    simulationLeaseOwnerV1({ operation: "hourly", subject_sha: subjectSha }),
    acceleratedLeaseOwner,
    "SIMULATION_LEASE_OWNER_MUST_ISOLATE_OPERATIONS",
  );
  assert.notEqual(
    simulationLeaseOwnerV1({ operation: "accelerated", subject_sha: `a${subjectSha.slice(1)}` }),
    acceleratedLeaseOwner,
    "SIMULATION_LEASE_OWNER_MUST_BIND_SUBJECT_SHA",
  );
  assert.throws(
    () => simulationLeaseOwnerV1({ operation: "accelerated", subject_sha: "not-a-sha" }),
    /SIMULATION_LEASE_SUBJECT_SHA_INVALID/,
  );
  const first = buildSimulationWindowV1(input);
  const second = buildSimulationWindowV1(input);
  assert.deepEqual(second, first, "SIMULATION_SAME_SEED_REPLAY_MUST_BE_BYTE_DETERMINISTIC");
  assert.equal(first.length, 24, "SIMULATION_EXACT_24_HOURS_REQUIRED");
  assert.deepEqual(first.map((hour) => hour.slot_id), Array.from({ length: 24 }, (_, index) => `O${String(index).padStart(2, "0")}`));
  assert.equal(first.flatMap((hour) => hour.records).length, 119, "SIMULATION_EXPECTED_EVIDENCE_CARDINALITY_REQUIRED");
  assert.equal(first[9].records.filter((record) => !record.record_type.startsWith("future_")).length, 3, "O09_DELAYED_ACTUAL_OBSERVATION_SET_REQUIRED");
  assert(first[9].injected_conditions.includes("ACTUAL_OBSERVATION_DELAYED_INGRESS_PROBE"));
  assert.equal(first[10].records.filter((record) => record.record_type.startsWith("future_")).length, 0, "O10_FUTURE_FORCING_OUTAGE_REQUIRED");
  assert(first[10].injected_conditions.includes("FUTURE_FORCING_OUTAGE"));
  assert(first[15].injected_conditions.includes("LATE_OUT_OF_ORDER_APPEND_FORWARD"));
  assert.equal(first[15].records.filter((record) => record.record_type === "soil_moisture_observation_v1").length, 2);
  assert(first[16].injected_conditions.includes("CONTROLLED_SENSOR_DRIFT"));
  for (const hour of first) {
    assert.match(hour.determinism_hash, /^sha256:[0-9a-f]{64}$/);
    assert.equal(hour.state.layer_theta.length, 5);
    for (const theta of hour.state.layer_theta) assert(theta >= 0.12 && theta <= 0.46);
    for (const record of hour.records) {
      assert.equal(record.formal_eligible, false);
      assert.equal(record.is_simulated, true);
      assert.equal(record.evidence_level, "SIMULATION");
      assert.equal(record.source_lane, SIMULATION_SOURCE_LANE_V1);
      assert(record.limitations.includes("SIMULATION_ONLY"));
      assert(record.limitations.includes("NOT_FIELD_EVIDENCE"));
      const expectedHash = semanticHashV1({
        record_type: record.record_type,
        source_record_id: record.source_record_id,
        binding_id: record.binding_id,
        origin_source_id: record.origin_source_id,
        role_time: record.role_time,
        canonical_payload: record.canonical_payload,
      });
      assert.equal(record.source_record_hash, expectedHash, `SIMULATION_RECORD_HASH_MISMATCH:${record.source_record_id}`);
      if (record.record_type.startsWith("future_")) {
        assert.equal((record.canonical_payload.points as unknown[]).length, 72, "SIMULATION_72_POINT_FORCING_REQUIRED");
      }
    }
  }
  const different = buildSimulationWindowV1({ ...input, seed: input.seed + 1 });
  assert.notEqual(
    semanticHashV1(first.map((hour) => hour.determinism_hash)),
    semanticHashV1(different.map((hour) => hour.determinism_hash)),
    "SIMULATION_DIFFERENT_SEED_MUST_CHANGE_WINDOW_DIGEST",
  );
  assert.equal(DATABASE_EVIDENCE_INGRESS_CONFIG_V1.trust_mode, "GOVERNED_NON_SIMULATED");
  assert.equal(PRODUCTION_EQUIVALENT_SIMULATION_EVIDENCE_INGRESS_CONFIG_V1.trust_mode, "PRODUCTION_EQUIVALENT_SIMULATION_ONLY");
  assert.equal(DATABASE_EVIDENCE_INGRESS_CONFIG_V1.production_wiring_allowed, false);
  const rows = first[0].records.map((record, index) => ({
    fact_id: `sim_acceptance_${index}`,
    occurred_at: record.available_to_runtime_at,
    record_json: { type: record.record_type, payload: record },
  }));
  const readOnlyPool = {
    async connect() {
      return {
        async query(text: string) {
          return /SELECT fact_id/i.test(text) ? { rows, rowCount: rows.length } : { rows: [], rowCount: 0 };
        },
        release() {},
      };
    },
  };
  const boundary = {
    scope,
    slot_id: "O00",
    logical_time: first[0].logical_time,
    scheduler_wall_clock_observed_at: first[0].logical_time,
    interval_seconds: 3600,
  } as const;
  const productionFrozen = await new PostgresEvidenceIngressAdapterV1(
    readOnlyPool as never,
    DATABASE_EVIDENCE_INGRESS_CONFIG_V1,
  ).freezeEligibleEvidence({ boundary });
  const simulationFrozen = await new PostgresEvidenceIngressAdapterV1(
    readOnlyPool as never,
    PRODUCTION_EQUIVALENT_SIMULATION_EVIDENCE_INGRESS_CONFIG_V1,
  ).freezeEligibleEvidence({ boundary });
  assert.equal(productionFrozen.selected.length, 0, "PRODUCTION_TRUST_PROFILE_MUST_REJECT_SIMULATION");
  assert.equal(simulationFrozen.selected.length, 5, "SIMULATION_TRUST_PROFILE_MUST_ACCEPT_EXACT_SIMULATION_LANE");
  const result = {
    schema_version: "geox_mcft_cap09_s6_production_equivalent_simulator_acceptance_v1",
    status: "PASS",
    slot_count: first.length,
    evidence_record_count: first.flatMap((hour) => hour.records).length,
    five_layer_state: true,
    future_forcing_points_per_type: 72,
    same_seed_deterministic: true,
    different_seed_discriminated: true,
    stale_detection_probe_slot: "O09",
    missing_forcing_degradation_slot: "O10",
    missed_backfill_slot: "O11",
    late_out_of_order_slot: "O15",
    drift_start_slot: "O16",
    default_production_trust_mode_unchanged: true,
    simulation_trust_mode_explicit: true,
    production_profile_rejects_simulation: true,
    simulation_profile_accepts_exact_lane: true,
    lease_owner_stable_per_operation: true,
    lease_owner_isolates_operations: true,
    lease_owner_subject_sha_bound: true,
    formal_eligible: false,
    formal_window_started: false,
    field_validity_proven: false,
  };
  fs.mkdirSync(path.dirname(OUT), { recursive: true });
  fs.writeFileSync(OUT, `${JSON.stringify(result, null, 2)}\n`);
  console.log(JSON.stringify(result, null, 2));
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
