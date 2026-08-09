// scripts/runtime_acceptance/ACCEPTANCE_MCFT_CAP_09_EA5B5C_EXTERNAL_CAP04_ORCHESTRATION.ts
// Purpose: prove the production persistence-free External CAP04 orchestration service owns the complete raw-input -> A1/A2 candidate path and fails closed before any persistence/provider boundary.
// Boundary: deterministic in-memory qualification only; no DB, provider request, scheduler, Scenario/Recommendation/Action write, or O00.

import assert from "node:assert/strict";
import {
  CAP04_A1_OPERATION_VARIANT_V1,
  CAP04_A2_OPERATION_VARIANT_V1,
} from "../../apps/server/src/domain/twin_runtime/forecast_scenario_contracts_v1.js";
import { validateCap04ARecordSetV1 } from "../../apps/server/src/domain/twin_runtime/forecast_scenario_record_set_validator_v1.js";
import {
  MCFT_CAP09_EXTERNAL_FORMAL_FUTURE_ET0_BINDING_ID_V1,
  MCFT_CAP09_EXTERNAL_FORMAL_RAINFALL_BINDING_ID_V1,
} from "../../apps/server/src/domain/twin_runtime/external_formal_evidence_binding_profile_v1.js";
import { executeExternalFormalCap04CandidateV1 } from "../../apps/server/src/runtime/twin_runtime/external_formal_cap04_candidate_execution_service_v1.js";
import type { CanonicalReplayEvidenceRecordV1 } from "../../apps/server/src/runtime/twin_runtime/ports.js";
import {
  EA5B5B_CREATED_AT_V1,
  EA5B5B_LOGICAL_TIME_V1,
  buildEa5b5bExternalFixtureV1,
} from "./mcft_cap09_ea5b5b_external_fixture_v1.js";

let pass = 0;
function ok(message: string): void { pass += 1; console.log(`PASS ${message}`); }

function rawInputV1(fixture: Awaited<ReturnType<typeof buildEa5b5bExternalFixtureV1>>) {
  return {
    scope: fixture.scope,
    logical_time: EA5B5B_LOGICAL_TIME_V1,
    created_at: EA5B5B_CREATED_AT_V1,
    handoff: fixture.handoff,
    runtime_config: fixture.hourly,
    candidate_records: fixture.candidates,
    crop_stage_context: fixture.crop,
  };
}

function recordByTypeV1(records: CanonicalReplayEvidenceRecordV1[], type: string): CanonicalReplayEvidenceRecordV1 {
  const record = records.find((candidate) => candidate.record_type === type);
  if (!record) throw new Error(`EA5B5C_RECORD_REQUIRED:${type}`);
  return record;
}

async function main(): Promise<void> {
  const fixture = await buildEa5b5bExternalFixtureV1();

  const a1 = executeExternalFormalCap04CandidateV1(rawInputV1(fixture));
  validateCap04ARecordSetV1(a1.record_set);
  assert.equal(a1.operation_variant, "A1");
  assert.equal(a1.record_set.operation_key.operation_variant, CAP04_A1_OPERATION_VARIANT_V1);
  assert.equal(a1.forcing_outcome.status, "SELECTED");
  assert.equal(a1.forecast_authority.forecast_candidate.status, "COMPLETED");
  assert.equal(a1.forecast_authority.forecast_candidate.points.length, 72);
  assert.equal(a1.record_set.members.length, 8);
  assert.equal(a1.canonical_persistence_authorized, false);
  assert.equal(a1.provider_request_count, 0);
  assert.equal(a1.database_write_count, 0);
  assert.equal(a1.scenario_write_count, 0);
  assert.equal(a1.recommendation_write_count, 0);
  assert.equal(a1.action_write_count, 0);
  ok("production External CAP04 service owns raw-input through completed A1 candidate with 72h Forecast and zero side effects");

  const a1Again = executeExternalFormalCap04CandidateV1({
    ...rawInputV1(fixture),
    created_at: new Date(Date.parse(EA5B5B_CREATED_AT_V1) + 30 * 60_000).toISOString(),
  });
  assert.equal(a1Again.record_set.record_set_id, a1.record_set.record_set_id);
  assert.equal(a1Again.record_set.aggregate_determinism_hash, a1.record_set.aggregate_determinism_hash);
  ok("production orchestration is deterministic across audit created_at changes");

  const blockedRecords = structuredClone(fixture.candidates) as CanonicalReplayEvidenceRecordV1[];
  const futureEt0 = recordByTypeV1(blockedRecords, "future_et0_assumption_v1");
  assert.equal(futureEt0.binding_id, MCFT_CAP09_EXTERNAL_FORMAL_FUTURE_ET0_BINDING_ID_V1);
  futureEt0.quality = { ...futureEt0.quality, status: "FAIL" };
  const a2 = executeExternalFormalCap04CandidateV1({ ...rawInputV1(fixture), candidate_records: blockedRecords });
  validateCap04ARecordSetV1(a2.record_set);
  assert.equal(a2.operation_variant, "A2");
  assert.equal(a2.record_set.operation_key.operation_variant, CAP04_A2_OPERATION_VARIANT_V1);
  assert.equal(a2.forcing_outcome.status, "BLOCKED");
  assert.equal(a2.forecast_authority.forecast_candidate.status, "BLOCKED");
  assert.equal(a2.forecast_authority.forecast_candidate.points.length, 0);
  assert.equal(a2.canonical_persistence_authorized, false);
  ok("production orchestration returns A2 for unavailable complete forcing without inventing a Forecast or writing state");

  const malformedRecords = structuredClone(fixture.candidates) as CanonicalReplayEvidenceRecordV1[];
  const malformedWeather = recordByTypeV1(malformedRecords, "future_weather_assumption_v1");
  malformedWeather.available_to_runtime_at = "not-an-iso-instant";
  assert.throws(() => executeExternalFormalCap04CandidateV1({ ...rawInputV1(fixture), candidate_records: malformedRecords }), /EXTERNAL_CAP04_SERVICE_FUTURE_FORCING_FAILED/);
  ok("malformed future-forcing authority fails closed instead of being downgraded into an invented blocked/success path");

  const badBindingRecords = structuredClone(fixture.candidates) as CanonicalReplayEvidenceRecordV1[];
  const rain = recordByTypeV1(badBindingRecords, "observed_rainfall_v1");
  assert.equal(rain.binding_id, MCFT_CAP09_EXTERNAL_FORMAL_RAINFALL_BINDING_ID_V1);
  rain.binding_id = "rainfall_c8_hourly_v1";
  assert.throws(() => executeExternalFormalCap04CandidateV1({ ...rawInputV1(fixture), candidate_records: badBindingRecords }), /EXTERNAL_CAP04_EVIDENCE_BINDING_MISMATCH:observed_rainfall_v1/);
  ok("five-source binding drift is rejected at the production input authority boundary before compatibility math");

  const operationEvidence = structuredClone(fixture.candidates[0]) as CanonicalReplayEvidenceRecordV1;
  operationEvidence.record_type = "irrigation_execution_evidence_v1";
  operationEvidence.source_record_id = "ea5b5c_forbidden_operation_evidence";
  assert.throws(() => executeExternalFormalCap04CandidateV1({ ...rawInputV1(fixture), candidate_records: [...fixture.candidates, operationEvidence] }), /EXTERNAL_CAP04_COMMERCIAL_OPERATION_EVIDENCE_FORBIDDEN/);
  ok("commercial irrigation plan/execution evidence cannot enter the production External Formal CAP04 service");

  const badRealityHandoff = structuredClone(fixture.handoff);
  badRealityHandoff.reality_binding_hash = "sha256:wrong-reality-binding";
  assert.throws(() => executeExternalFormalCap04CandidateV1({ ...rawInputV1(fixture), handoff: badRealityHandoff }), /EXTERNAL_CAP04_SERVICE_REALITY_BINDING_MISMATCH/);
  ok("handoff/runtime Reality authority drift fails closed before State or Forecast candidate construction");

  const badCrop = structuredClone(fixture.crop);
  badCrop.determinism_hash = "sha256:wrong-crop-context";
  assert.throws(() => executeExternalFormalCap04CandidateV1({ ...rawInputV1(fixture), crop_stage_context: badCrop }), /CROP_STAGE_CONTEXT_HASH_MISMATCH/);
  ok("External crop authority drift fails closed before compatibility execution");

  assert.equal(pass, 8);
  console.log(`MCFT-CAP-09 EA5B5C External CAP04 Orchestration: ${pass} PASS, 0 FAIL`);
}

main().catch((error) => { console.error(error); process.exitCode = 1; });
