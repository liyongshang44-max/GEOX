// scripts/runtime_acceptance/ACCEPTANCE_MCFT_CAP_05_NOT_YET_VALIDATED_RECEIPT_CONSUMING_TICK.ts
// Purpose: prove one trustworthy NOT_YET_VALIDATED canonical H object is consumed by the full S7 receipt-consuming A1, Forecast and Scenario path without changing its validation status.
// Boundary: in-memory acceptance only; no production database, route, scheduler, range, restart/backfill, approval, dispatch, Recommendation, AO-ACT, calibration, model activation or CAP-06 authority.

import assert from "node:assert/strict";
import {
  computeMemberDeterminismHashV1,
  deriveSemanticObjectIdV1,
} from "../../apps/server/src/domain/twin_runtime/canonical_identity_v1.js";
import type { CanonicalObjectEnvelopeV1 } from "../../apps/server/src/domain/twin_runtime/canonical_object_contracts_v1.js";
import {
  buildCap05ActionFeedbackV1,
  CAP05_ACTION_FEEDBACK_ELIGIBILITY_POLICY_V1,
  CAP05_ACTION_FEEDBACK_QUALITY_MAPPING_POLICY_V1,
  CAP05_TARGET_EQUIVALENT_IRRIGATION_POLICY_V1,
  type Cap05ActionFeedbackEnvelopeV1,
} from "../../apps/server/src/domain/twin_runtime/feedback_canonical_contracts_v1.js";
import type { Cap04ARecordSetV1 } from "../../apps/server/src/domain/twin_runtime/forecast_scenario_record_set_identity_v1.js";
import {
  CAP05_ACTION_FEEDBACK_ADAPTER_POLICY_ID_V1,
  CAP05_ACTION_FEEDBACK_AMOUNT_SEMANTICS_POLICY_ID_V1,
  CAP05_ACTION_FEEDBACK_EVIDENCE_CUTOFF_POLICY_ID_V1,
  CAP05_ACTION_FEEDBACK_INTERVAL_POLICY_ID_V1,
  CAP05_ACTION_FEEDBACK_LATE_POLICY_ID_V1,
  CAP05_ACTION_FEEDBACK_MULTIPLE_EVENT_POLICY_ID_V1,
  CAP05_ACTION_FEEDBACK_SPATIAL_OVERLAP_POLICY_ID_V1,
  CAP05_ACTION_FEEDBACK_VOLUME_TO_DEPTH_POLICY_ID_V1,
} from "../../apps/server/src/runtime/twin_runtime/action_feedback_tick_selector_v1.js";
import { PrepareNextTickInputServiceV1 } from "../../apps/server/src/runtime/twin_runtime/next_tick_input_service_v1.js";
import {
  Cap05ReceiptConsumingForecastScenarioTickServiceV1,
  type Cap05ActionFeedbackSourcePortV1,
} from "../../apps/server/src/runtime/twin_runtime/receipt_consuming_forecast_scenario_tick_service_v1.js";
import {
  CAP04_S6_LOGICAL_TIME_V1,
  buildCap04S6SingleTickFixtureV1,
} from "./mcft_cap_04_single_tick_fixture_v1.js";

let pass = 0;
function ok(label: string): void {
  pass += 1;
  console.log(`PASS ${label}`);
}

function memberV1(recordSet: Cap04ARecordSetV1, objectType: string): CanonicalObjectEnvelopeV1 {
  const matches = recordSet.members.filter((member) => member.object_type === objectType);
  if (matches.length !== 1) throw new Error(`CAP05_NOT_YET_VALIDATED_MEMBER_CARDINALITY:${objectType}`);
  return matches[0];
}

function addMinutesV1(value: string, minutes: number): string {
  return new Date(Date.parse(value) + minutes * 60_000).toISOString();
}

function runtimeConfigV1(source: CanonicalObjectEnvelopeV1): CanonicalObjectEnvelopeV1 {
  const config = structuredClone(source);
  config.object_id = deriveSemanticObjectIdV1("cap05_not_yet_validated_runtime_config", {
    parent: source.object_id,
    logical_time: source.logical_time,
  });
  config.idempotency_key = deriveSemanticObjectIdV1("cap05_not_yet_validated_runtime_config_key", {
    object_id: config.object_id,
  });
  config.payload = {
    ...config.payload,
    action_feedback_state_input_policy_id: CAP05_ACTION_FEEDBACK_ELIGIBILITY_POLICY_V1,
    action_feedback_quality_mapping_policy_id: CAP05_ACTION_FEEDBACK_QUALITY_MAPPING_POLICY_V1,
    evidence_cutoff_policy_id: CAP05_ACTION_FEEDBACK_EVIDENCE_CUTOFF_POLICY_ID_V1,
    late_receipt_policy_id: CAP05_ACTION_FEEDBACK_LATE_POLICY_ID_V1,
    execution_interval_policy_id: CAP05_ACTION_FEEDBACK_INTERVAL_POLICY_ID_V1,
    multiple_execution_event_policy_id: CAP05_ACTION_FEEDBACK_MULTIPLE_EVENT_POLICY_ID_V1,
    spatial_overlap_policy_id: CAP05_ACTION_FEEDBACK_SPATIAL_OVERLAP_POLICY_ID_V1,
    actual_amount_semantics_policy_id: CAP05_ACTION_FEEDBACK_AMOUNT_SEMANTICS_POLICY_ID_V1,
    effective_irrigation_policy_id: CAP05_TARGET_EQUIVALENT_IRRIGATION_POLICY_V1,
    volume_to_depth_policy_id: CAP05_ACTION_FEEDBACK_VOLUME_TO_DEPTH_POLICY_ID_V1,
    action_feedback_adapter_policy_id: CAP05_ACTION_FEEDBACK_ADAPTER_POLICY_ID_V1,
  };
  config.determinism_hash = "";
  config.determinism_hash = computeMemberDeterminismHashV1(config as unknown as Record<string, unknown>);
  return config;
}

function feedbackV1(config: CanonicalObjectEnvelopeV1): Cap05ActionFeedbackEnvelopeV1 {
  const executionStart = addMinutesV1(CAP04_S6_LOGICAL_TIME_V1, -30);
  const executionEnd = addMinutesV1(CAP04_S6_LOGICAL_TIME_V1, -10);
  const availableAt = addMinutesV1(CAP04_S6_LOGICAL_TIME_V1, -5);
  return buildCap05ActionFeedbackV1({
    scope: {
      tenant_id: config.tenant_id,
      project_id: config.project_id,
      group_id: config.group_id,
      field_id: config.field_id,
      season_id: config.season_id,
      zone_id: config.zone_id,
    },
    decision_ref: "twin_decision_record_cap05_not_yet_validated_fixture",
    decision_hash: "sha256:decision-cap05-not-yet-validated-fixture",
    approved_plan_evidence_ref: "plan_cap05_not_yet_validated_fixture",
    approved_plan_evidence_hash: "sha256:plan-cap05-not-yet-validated-fixture",
    origin_kind: "EXTERNAL_EVIDENCE",
    receipt_ref: "receipt_cap05_not_yet_validated_fixture",
    dispatch_disposition: "NOT_OBSERVED",
    event_id: "irrigation_event_cap05_not_yet_validated_fixture",
    source_record_id: "receipt_source_cap05_not_yet_validated_fixture",
    binding_id: "irrigation_binding_cap05_not_yet_validated_fixture",
    origin_source_id: "controlled_irrigation_executor_cap05_not_yet_validated_fixture",
    execution_status: "EXECUTED",
    validation_status: "NOT_YET_VALIDATED",
    source_quality: "PASS",
    eligible_for_state_input: true,
    actual_amount_mm: "13.600000",
    spatial_coverage_fraction: "0.910000",
    execution_start: executionStart,
    execution_end: executionEnd,
    ingested_at: availableAt,
    available_to_runtime_at: availableAt,
    runtime_config_ref: config.object_id,
    runtime_config_hash: config.determinism_hash,
    context_lineage_ref: "twin_runtime_lineage_object_cap05_not_yet_validated_fixture",
    context_revision_ref: "revision_active",
    created_at: availableAt,
  });
}

class InMemoryActionFeedbackSourceV1 implements Cap05ActionFeedbackSourcePortV1 {
  constructor(private readonly feedback: Cap05ActionFeedbackEnvelopeV1) {}
  async loadActionFeedbackCandidates(): Promise<readonly Cap05ActionFeedbackEnvelopeV1[]> {
    return [structuredClone(this.feedback)];
  }
}

async function main(): Promise<void> {
  const fixture = buildCap04S6SingleTickFixtureV1();
  const config = runtimeConfigV1(fixture.runtime_config);
  await fixture.runtime.commitRuntimeConfig(config);
  const feedback = feedbackV1(config);
  const service = new Cap05ReceiptConsumingForecastScenarioTickServiceV1(
    new PrepareNextTickInputServiceV1(fixture.runtime),
    fixture.runtime,
    new InMemoryActionFeedbackSourceV1(feedback),
    fixture.runtime,
    fixture.runtime,
  );
  const result = await service.executeOneTick({
    ...fixture.input,
    runtime_config_ref: config.object_id,
    runtime_config_hash: config.determinism_hash,
  });

  assert.equal(result.status, "INSERTED");
  assert.equal(result.a_record_set.members.length, 8);
  ok("trustworthy NOT_YET_VALIDATED H commits one normal eight-member A1");

  assert.deepEqual(result.action_feedback_selection?.selected_action_feedback_refs, [feedback.object_id]);
  assert.equal(result.action_feedback_selection?.evidence_cutoff_time, CAP04_S6_LOGICAL_TIME_V1);
  ok("S7 selector consumes the exact NOT_YET_VALIDATED H at the explicit cutoff");

  const record = result.evidence_window?.base_continuation_window.irrigation_execution_records[0];
  assert.equal(record?.source_record_id, feedback.object_id);
  assert.equal(record?.source_record_hash, feedback.determinism_hash);
  assert.equal(record?.canonical_payload.validation_status, "NOT_YET_VALIDATED");
  assert.equal(record?.canonical_payload.eligible_for_state_input, true);
  ok("frozen Evidence Window retains NOT_YET_VALIDATED and canonical eligibility independently");

  assert.equal(result.dynamics?.irrigation_aggregation.effective_irrigation_mm, "12.376000");
  assert.equal(result.dynamics?.irrigation_aggregation.selected_events.length, 1);
  ok("Dynamics applies 13.600000 x 0.910000 exactly once for NOT_YET_VALIDATED H");

  const forecast = memberV1(result.a_record_set, "twin_forecast_run_v1");
  assert.equal(forecast.payload.status, "COMPLETED");
  assert.equal((forecast.payload.points as unknown[]).length, 72);
  ok("NOT_YET_VALIDATED receipt-consuming A1 produces one successful 72-hour Forecast");

  assert.equal(result.b_record?.scenario_set.payload.options.length, 3);
  assert.ok(result.b_record?.scenario_set.payload.options.every((option) => option.trajectory_points.length === 72));
  ok("NOT_YET_VALIDATED receipt-consuming A1 produces three ordered 72-point Scenario trajectories");

  const evidence = memberV1(result.a_record_set, "twin_evidence_window_v1");
  assert.ok((evidence.payload.consumed_evidence_refs as string[]).includes(feedback.object_id));
  ok("canonical Evidence member records the consumed NOT_YET_VALIDATED H reference");

  assert.equal(pass, 7);
  console.log(`MCFT-CAP-05 NOT_YET_VALIDATED receipt-consuming tick: ${pass} PASS / 0 FAIL`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
