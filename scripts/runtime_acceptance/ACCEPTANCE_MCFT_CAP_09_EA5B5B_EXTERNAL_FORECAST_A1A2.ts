// scripts/runtime_acceptance/ACCEPTANCE_MCFT_CAP_09_EA5B5B_EXTERNAL_FORECAST_A1A2.ts
// Purpose: prove External Forecast authority plus A1/A2 canonical record-set candidates preserve frozen CAP04 numerics while eliminating Replay crop/runtime provenance.
// Boundary: deterministic in-memory qualification only; no persistence, provider request, scheduler, Scenario creation, Recommendation, Action, or O00.

import assert from "node:assert/strict";
import {
  validateCap04CanonicalForecastRunPayloadV1,
} from "../../apps/server/src/domain/twin_runtime/forecast_canonical_authority_v1.js";
import {
  CAP04_A1_OPERATION_VARIANT_V1,
  CAP04_A2_OPERATION_VARIANT_V1,
} from "../../apps/server/src/domain/twin_runtime/forecast_scenario_contracts_v1.js";
import {
  validateCap04ARecordSetV1,
} from "../../apps/server/src/domain/twin_runtime/forecast_scenario_record_set_validator_v1.js";
import {
  MCFT_CAP09_EXTERNAL_FORMAL_MODEL_PARAMETER_AUTHORITY_V1,
  MCFT_CAP09_EXTERNAL_FORMAL_RUNTIME_MODE_V1,
} from "../../apps/server/src/domain/twin_runtime/external_formal_runtime_config_v1.js";
import type { CanonicalObjectEnvelopeV1 } from "../../apps/server/src/domain/twin_runtime/canonical_object_contracts_v1.js";
import {
  buildExternalFormalCap04BlockedA2RecordSetV1,
  buildExternalFormalCap04CompletedA1RecordSetV1,
} from "../../apps/server/src/runtime/twin_runtime/external_formal_cap04_a_record_set_builder_v1.js";
import {
  EA5B5B_CREATED_AT_V1,
  EA5B5B_CROP_CONTEXT_HASH_V1,
  EA5B5B_CROP_CONTEXT_REF_V1,
  EA5B5B_LOGICAL_TIME_V1,
  buildEa5b5bExternalFixtureV1,
} from "./mcft_cap09_ea5b5b_external_fixture_v1.js";

let pass = 0;
function ok(message: string): void {
  pass += 1;
  console.log(`PASS ${message}`);
}

function memberV1(recordSet: { members: CanonicalObjectEnvelopeV1[] }, type: string): CanonicalObjectEnvelopeV1 {
  const matches = recordSet.members.filter((member) => member.object_type === type);
  if (matches.length !== 1) throw new Error(`EA5B5B_MEMBER_CARDINALITY:${type}`);
  return matches[0];
}

function commonInputV1(fixture: Awaited<ReturnType<typeof buildEa5b5bExternalFixtureV1>>) {
  return {
    scope: fixture.scope,
    lineage_id: fixture.handoff.lineage_id,
    revision_id: fixture.handoff.revision_id,
    logical_time: EA5B5B_LOGICAL_TIME_V1,
    created_at: EA5B5B_CREATED_AT_V1,
    active_lineage_ref: fixture.handoff.active_lineage_ref,
    previous_posterior_ref: fixture.handoff.previous_posterior_ref,
    previous_posterior_hash: fixture.handoff.previous_posterior_hash,
    previous_checkpoint_ref: fixture.handoff.previous_checkpoint_ref,
    previous_checkpoint_hash: fixture.handoff.previous_checkpoint_hash,
    previous_forecast_result_ref: fixture.handoff.previous_forecast_result_ref,
    previous_forecast_result_hash: fixture.handoff.previous_forecast_result_hash ?? "sha256:ea5b5b-previous-forecast",
    previous_successful_forecast_ref: fixture.handoff.latest_successful_forecast_ref,
    previous_tick_sequence: fixture.handoff.previous_tick_sequence,
    runtime_config: fixture.hourly,
    source_members: fixture.sourceMembers,
  };
}

async function main(): Promise<void> {
  const fixture = await buildEa5b5bExternalFixtureV1();
  const completedAuthority = fixture.externalCompletedForecast;
  const completedForecast = completedAuthority.forecast_candidate;
  validateCap04CanonicalForecastRunPayloadV1(completedForecast);
  assert.equal(completedForecast.status, "COMPLETED");
  assert.equal(completedForecast.points.length, 72);
  assert.equal(completedForecast.crop_stage_context_ref, EA5B5B_CROP_CONTEXT_REF_V1);
  assert.equal(completedForecast.crop_stage_context_hash, EA5B5B_CROP_CONTEXT_HASH_V1);
  assert.equal(completedAuthority.numerical_identity_preserved, true);
  assert.equal(completedAuthority.compatibility_numeric_digest, completedAuthority.external_candidate_numeric_digest);
  const completedText = JSON.stringify(completedAuthority);
  assert.ok(!completedText.includes("CONTROLLED_REPLAY"));
  assert.ok(!completedText.includes('"runtime_mode":"REPLAY"'));
  assert.ok(!completedText.includes("field_c8_demo"));
  ok("completed 72h Forecast rebinds External crop authority while preserving the frozen compatibility numerical trace exactly");

  const a1 = buildExternalFormalCap04CompletedA1RecordSetV1({
    ...commonInputV1(fixture),
    forecast_payload: completedForecast,
  });
  validateCap04ARecordSetV1(a1.record_set);
  assert.equal(a1.record_set.operation_key.operation_variant, CAP04_A1_OPERATION_VARIANT_V1);
  assert.equal(a1.canonical_persistence_authorized, false);
  assert.equal(a1.runtime_mode, MCFT_CAP09_EXTERNAL_FORMAL_RUNTIME_MODE_V1);
  assert.equal(a1.model_parameter_authority, MCFT_CAP09_EXTERNAL_FORMAL_MODEL_PARAMETER_AUTHORITY_V1);
  assert.equal(a1.record_set.members.length, 8);
  const a1Text = JSON.stringify(a1.record_set);
  assert.ok(!a1Text.includes("CONTROLLED_REPLAY"));
  assert.ok(!a1Text.includes('"runtime_mode":"REPLAY"'));
  assert.ok(!a1Text.includes("field_c8_demo"));
  ok("External A1 candidate validates as the standard eight-member CAP04 graph with no Replay truth leakage and no persistence authority");

  const a1State = memberV1(a1.record_set, "twin_state_estimate_v1");
  const a1Forecast = memberV1(a1.record_set, "twin_forecast_run_v1");
  const a1Tick = memberV1(a1.record_set, "twin_runtime_tick_v1");
  const a1Checkpoint = memberV1(a1.record_set, "twin_runtime_checkpoint_v1");
  const a1Health = memberV1(a1.record_set, "twin_runtime_health_v1");
  assert.equal(a1Forecast.payload.source_posterior_ref, a1State.object_id);
  assert.equal(a1Forecast.payload.source_posterior_hash, a1State.determinism_hash);
  assert.equal(a1Tick.payload.runtime_mode, MCFT_CAP09_EXTERNAL_FORMAL_RUNTIME_MODE_V1);
  assert.equal(a1Checkpoint.payload.runtime_mode, MCFT_CAP09_EXTERNAL_FORMAL_RUNTIME_MODE_V1);
  assert.equal(a1Health.payload.runtime_mode, MCFT_CAP09_EXTERNAL_FORMAL_RUNTIME_MODE_V1);
  assert.equal(a1Checkpoint.payload.successful_forecast_ref, a1Forecast.object_id);
  assert.equal(a1Health.payload.successful_forecast_ref, a1Forecast.object_id);
  assert.equal(a1Tick.payload.operation_variant, CAP04_A1_OPERATION_VARIANT_V1);
  ok("A1 remaps Forecast to the final canonical State and freezes External Tick/Checkpoint/Health recovery authority");

  const a1Again = buildExternalFormalCap04CompletedA1RecordSetV1({
    ...commonInputV1(fixture),
    created_at: new Date(Date.parse(EA5B5B_CREATED_AT_V1) + 30 * 60_000).toISOString(),
    forecast_payload: completedForecast,
  });
  assert.equal(a1Again.record_set.record_set_id, a1.record_set.record_set_id);
  assert.equal(a1Again.record_set.aggregate_determinism_hash, a1.record_set.aggregate_determinism_hash);
  for (const member of a1.record_set.members) {
    const again = memberV1(a1Again.record_set, member.object_type);
    assert.equal(again.object_id, member.object_id);
    assert.equal(again.determinism_hash, member.determinism_hash);
  }
  ok("External A1 aggregate/member identity is deterministic across audit created_at changes");

  const blockedAuthority = fixture.externalBlockedForecast;
  const blockedForecast = blockedAuthority.forecast_candidate;
  validateCap04CanonicalForecastRunPayloadV1(blockedForecast);
  assert.equal(blockedForecast.status, "BLOCKED");
  assert.equal(blockedForecast.points.length, 0);
  assert.equal(blockedForecast.crop_stage_context_ref, EA5B5B_CROP_CONTEXT_REF_V1);
  assert.equal(blockedForecast.crop_stage_context_hash, EA5B5B_CROP_CONTEXT_HASH_V1);
  assert.equal(blockedAuthority.canonical_persistence_authorized, false);
  ok("blocked Forecast path rebinds External crop authority without inventing forcing points or a successful Forecast");

  const a2 = buildExternalFormalCap04BlockedA2RecordSetV1({
    ...commonInputV1(fixture),
    forecast_payload: blockedForecast,
  });
  validateCap04ARecordSetV1(a2.record_set);
  assert.equal(a2.record_set.operation_key.operation_variant, CAP04_A2_OPERATION_VARIANT_V1);
  const a2Forecast = memberV1(a2.record_set, "twin_forecast_run_v1");
  const a2Tick = memberV1(a2.record_set, "twin_runtime_tick_v1");
  const a2Checkpoint = memberV1(a2.record_set, "twin_runtime_checkpoint_v1");
  const a2Health = memberV1(a2.record_set, "twin_runtime_health_v1");
  assert.equal(a2Tick.payload.status, "COMPLETED_WITH_LIMITATIONS");
  assert.equal(a2Tick.payload.stop_after_blocked_forecast, true);
  assert.equal(a2Checkpoint.payload.successful_forecast_ref, fixture.handoff.latest_successful_forecast_ref);
  assert.equal(a2Health.payload.successful_forecast_ref, fixture.handoff.latest_successful_forecast_ref);
  assert.notEqual(a2Forecast.object_id, a1Forecast.object_id);
  assert.equal(a2.canonical_persistence_authorized, false);
  ok("External A2 candidate validates blocked-Forecast recovery semantics and carries forward only the previous successful Forecast pointer");

  assert.equal(a1.record_set.terminal_tick_uniqueness_key_hash, a2.record_set.terminal_tick_uniqueness_key_hash);
  assert.notEqual(a1.record_set.operation_key_hash, a2.record_set.operation_key_hash);
  assert.notEqual(a1.record_set.record_set_id, a2.record_set.record_set_id);
  ok("A1 and A2 preserve the same terminal-tick uniqueness domain while remaining distinct mutually-exclusive operation variants");

  const cropDrift = structuredClone(completedForecast);
  cropDrift.crop_stage_context_hash = "sha256:wrong-external-crop";
  assert.throws(() => buildExternalFormalCap04CompletedA1RecordSetV1({
    ...commonInputV1(fixture),
    forecast_payload: cropDrift,
  }), /EXTERNAL_CAP04_A_FORECAST_AUTHORITY_MISMATCH/);

  const replayLeak = structuredClone(completedForecast);
  replayLeak.limitations = [...replayLeak.limitations, "CONTROLLED_REPLAY"];
  assert.throws(() => buildExternalFormalCap04CompletedA1RecordSetV1({
    ...commonInputV1(fixture),
    forecast_payload: replayLeak,
  }), /EXTERNAL_CAP04_A_FORECAST_REPLAY_LEAKAGE/);

  const wrongScope = structuredClone(commonInputV1(fixture));
  wrongScope.scope = { ...wrongScope.scope, zone_id: "wrong_zone" };
  assert.throws(() => buildExternalFormalCap04CompletedA1RecordSetV1({
    ...wrongScope,
    forecast_payload: completedForecast,
  }), /EXTERNAL_CAP04_A_SCOPE_MISMATCH/);
  ok("crop authority drift, Replay Forecast provenance leakage, and six-key scope substitution all fail closed before External A1/A2 qualification");

  assert.equal(pass, 8);
  console.log(`MCFT-CAP-09 EA5B5B External Forecast/A1A2: ${pass} PASS, 0 FAIL`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
