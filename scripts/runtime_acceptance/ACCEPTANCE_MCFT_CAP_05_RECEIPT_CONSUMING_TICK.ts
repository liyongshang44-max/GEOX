// scripts/runtime_acceptance/ACCEPTANCE_MCFT_CAP_05_RECEIPT_CONSUMING_TICK.ts
// Purpose: prove one canonical H Action Feedback object is selected at the explicit cutoff, consumed by the unchanged CAP-04 A1 State Tick, and followed by one successful 72-hour Forecast and three Scenario trajectories.
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
  selectCap05ActionFeedbackForTickV1,
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
let fail = 0;
function check(value: unknown, label: string): void {
  if (value) {
    pass += 1;
    console.log(`PASS ${label}`);
  } else {
    fail += 1;
    console.error(`FAIL ${label}`);
  }
}

function memberV1(recordSet: Cap04ARecordSetV1, objectType: string): CanonicalObjectEnvelopeV1 {
  const matches = recordSet.members.filter((member) => member.object_type === objectType);
  if (matches.length !== 1) throw new Error(`CAP05_S7_MEMBER_CARDINALITY:${objectType}`);
  return matches[0];
}

function addMinutesV1(value: string, minutes: number): string {
  return new Date(Date.parse(value) + minutes * 60_000).toISOString();
}

function receiptConfigV1(source: CanonicalObjectEnvelopeV1): CanonicalObjectEnvelopeV1 {
  const config = structuredClone(source);
  config.object_id = deriveSemanticObjectIdV1("cap05_receipt_consuming_runtime_config", {
    parent: source.object_id,
    logical_time: source.logical_time,
  });
  config.idempotency_key = deriveSemanticObjectIdV1("cap05_receipt_consuming_runtime_config_key", {
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

function actionFeedbackV1(input: {
  config: CanonicalObjectEnvelopeV1;
  suffix?: string;
  execution_start?: string;
  execution_end?: string;
  ingested_at?: string;
  available_to_runtime_at?: string;
  event_id?: string;
}): Cap05ActionFeedbackEnvelopeV1 {
  const suffix = input.suffix ?? "standard";
  const executionStart = input.execution_start ?? addMinutesV1(CAP04_S6_LOGICAL_TIME_V1, -30);
  const executionEnd = input.execution_end ?? addMinutesV1(CAP04_S6_LOGICAL_TIME_V1, -10);
  const ingestedAt = input.ingested_at ?? addMinutesV1(CAP04_S6_LOGICAL_TIME_V1, -5);
  const availableAt = input.available_to_runtime_at ?? ingestedAt;
  return buildCap05ActionFeedbackV1({
    scope: {
      tenant_id: input.config.tenant_id,
      project_id: input.config.project_id,
      group_id: input.config.group_id,
      field_id: input.config.field_id,
      season_id: input.config.season_id,
      zone_id: input.config.zone_id,
    },
    decision_ref: "twin_decision_record_cap05_s7_fixture",
    decision_hash: "sha256:decision-cap05-s7-fixture",
    approved_plan_evidence_ref: "plan_cap05_s7_fixture",
    approved_plan_evidence_hash: "sha256:plan-cap05-s7-fixture",
    origin_kind: "EXTERNAL_EVIDENCE",
    receipt_ref: `receipt_cap05_s7_${suffix}`,
    dispatch_disposition: "NOT_OBSERVED",
    event_id: input.event_id ?? `irrigation_event_cap05_s7_${suffix}`,
    source_record_id: `receipt_source_cap05_s7_${suffix}`,
    binding_id: "irrigation_binding_cap05_s7",
    origin_source_id: "controlled_irrigation_executor_cap05_s7",
    execution_status: "PARTIALLY_EXECUTED",
    validation_status: "VALIDATED",
    source_quality: "PASS",
    eligible_for_state_input: true,
    actual_amount_mm: "13.600000",
    spatial_coverage_fraction: "0.910000",
    execution_start: executionStart,
    execution_end: executionEnd,
    ingested_at: ingestedAt,
    available_to_runtime_at: availableAt,
    runtime_config_ref: input.config.object_id,
    runtime_config_hash: input.config.determinism_hash,
    context_lineage_ref: "twin_runtime_lineage_object_cap05_s7",
    context_revision_ref: "revision_active",
    created_at: availableAt,
  });
}

class InMemoryActionFeedbackSourceV1 implements Cap05ActionFeedbackSourcePortV1 {
  loadCount = 0;
  constructor(private readonly values: readonly Cap05ActionFeedbackEnvelopeV1[]) {}
  async loadActionFeedbackCandidates(): Promise<readonly Cap05ActionFeedbackEnvelopeV1[]> {
    this.loadCount += 1;
    return structuredClone(this.values);
  }
}

async function main(): Promise<void> {
  const fixture = buildCap04S6SingleTickFixtureV1();
  const config = receiptConfigV1(fixture.runtime_config);
  await fixture.runtime.commitRuntimeConfig(config);
  const feedback = actionFeedbackV1({ config });
  const feedbackSource = new InMemoryActionFeedbackSourceV1([feedback]);
  const service = new Cap05ReceiptConsumingForecastScenarioTickServiceV1(
    new PrepareNextTickInputServiceV1(fixture.runtime),
    fixture.runtime,
    feedbackSource,
    fixture.runtime,
    fixture.runtime,
  );
  const input = {
    ...fixture.input,
    runtime_config_ref: config.object_id,
    runtime_config_hash: config.determinism_hash,
  };

  const inserted = await service.executeOneTick(input);
  const forecast = memberV1(inserted.a_record_set, "twin_forecast_run_v1");
  const evidence = memberV1(inserted.a_record_set, "twin_evidence_window_v1");
  const checkpoint = memberV1(inserted.a_record_set, "twin_runtime_checkpoint_v1");
  check(inserted.status === "INSERTED" && inserted.a_record_set.members.length === 8, "receipt-consuming tick commits one normal eight-member A1");
  check(
    inserted.action_feedback_selection?.selected_action_feedback_refs[0] === feedback.object_id
      && inserted.action_feedback_selection.evidence_cutoff_time === CAP04_S6_LOGICAL_TIME_V1,
    "selector freezes the explicit cutoff and selects the exact canonical H object",
  );
  check(
    inserted.evidence_window?.base_continuation_window.irrigation_execution_records[0]?.source_record_id === feedback.object_id
      && inserted.evidence_window.base_continuation_window.irrigation_execution_records[0]?.source_record_hash === feedback.determinism_hash
      && inserted.evidence_window.base_continuation_window.irrigation_execution_records[0]?.canonical_payload.evidence_cutoff_time === CAP04_S6_LOGICAL_TIME_V1,
    "frozen Evidence Window references Action Feedback and records evidence_cutoff_time",
  );
  check(
    inserted.dynamics?.irrigation_aggregation.effective_irrigation_mm === "12.376000"
      && inserted.dynamics.irrigation_aggregation.selected_events.length === 1,
    "existing Dynamics aggregator applies 13.600000 x 0.910000 exactly once",
  );
  check(
    forecast.payload.status === "COMPLETED"
      && Array.isArray(forecast.payload.points)
      && forecast.payload.points.length === 72
      && forecast.payload.scenario_eligible === true,
    "receipt-consuming A1 generates one successful 72-hour Forecast",
  );
  check(
    inserted.b_record?.scenario_set.payload.options.length === 3
      && inserted.b_record.scenario_set.payload.options.every((option) => option.trajectory_points.length === 72),
    "receipt-consuming tick generates exactly three ordered 72-point Scenario trajectories",
  );
  check(
    Array.isArray(evidence.payload.consumed_evidence_refs)
      && evidence.payload.consumed_evidence_refs.includes(feedback.object_id)
      && checkpoint.payload.tick_sequence === 49
      && inserted.next_handoff.previous_forecast_result_ref === forecast.object_id,
    "canonical Evidence member consumes H while checkpoint and T+1 handoff advance normally",
  );

  const loadsBeforeReplay = { base: fixture.runtime.evidenceLoadCount, feedback: feedbackSource.loadCount };
  const replay = await service.executeOneTick(input);
  check(
    replay.status === "EXISTING_IDEMPOTENT_SUCCESS"
      && replay.a_record_set.aggregate_determinism_hash === inserted.a_record_set.aggregate_determinism_hash
      && replay.b_record?.aggregate_determinism_hash === inserted.b_record?.aggregate_determinism_hash,
    "completed receipt-consuming replay returns the exact existing A1 and B",
  );
  check(
    fixture.runtime.evidenceLoadCount === loadsBeforeReplay.base
      && feedbackSource.loadCount === loadsBeforeReplay.feedback
      && replay.action_feedback_selection === null,
    "completed replay performs zero Replay Evidence or Action Feedback reselection",
  );

  const identical = selectCap05ActionFeedbackForTickV1({
    scope: input.scope,
    logical_time: input.logical_time,
    feedback_objects: [feedback, structuredClone(feedback)],
  });
  check(
    identical.candidate !== null
      && identical.trace.deduplicated_action_feedback_refs.includes(feedback.object_id)
      && identical.trace.selected_action_feedback_refs.length === 1,
    "identical Action Feedback duplicates collapse deterministically",
  );

  const conflict = structuredClone(feedback);
  conflict.payload.actual_amount_mm = "14.000000";
  conflict.payload.target_scope_equivalent_irrigation_mm = "12.740000";
  conflict.determinism_hash = "";
  conflict.determinism_hash = computeMemberDeterminismHashV1(conflict as unknown as Record<string, unknown>);
  assert.throws(() => selectCap05ActionFeedbackForTickV1({
    scope: input.scope,
    logical_time: input.logical_time,
    feedback_objects: [feedback, conflict],
  }), /CAP05_RECEIPT_TICK_CONFLICTING_DUPLICATE/);
  check(true, "conflicting duplicate Action Feedback fails closed");

  const secondEvent = actionFeedbackV1({
    config,
    suffix: "second_event",
    event_id: "irrigation_event_cap05_s7_second",
    execution_start: addMinutesV1(CAP04_S6_LOGICAL_TIME_V1, -25),
    execution_end: addMinutesV1(CAP04_S6_LOGICAL_TIME_V1, -15),
    ingested_at: addMinutesV1(CAP04_S6_LOGICAL_TIME_V1, -4),
    available_to_runtime_at: addMinutesV1(CAP04_S6_LOGICAL_TIME_V1, -4),
  });
  assert.throws(() => selectCap05ActionFeedbackForTickV1({
    scope: input.scope,
    logical_time: input.logical_time,
    feedback_objects: [feedback, secondEvent],
  }), /CAP05_MULTIPLE_ACTION_FEEDBACK_EVENTS_FOR_TICK/);
  check(true, "multiple distinct execution events in one scope-hour fail closed");

  const late = actionFeedbackV1({
    config,
    suffix: "late",
    available_to_runtime_at: addMinutesV1(CAP04_S6_LOGICAL_TIME_V1, 5),
    ingested_at: addMinutesV1(CAP04_S6_LOGICAL_TIME_V1, 5),
  });
  const lateSelection = selectCap05ActionFeedbackForTickV1({
    scope: input.scope,
    logical_time: input.logical_time,
    feedback_objects: [late],
  });
  check(
    lateSelection.candidate === null
      && lateSelection.trace.entries[0]?.disposition === "EXCLUDED_LATE"
      && late.logical_time === addMinutesV1(CAP04_S6_LOGICAL_TIME_V1, -10),
    "late Action Feedback is excluded without shifting its execution logical_time",
  );

  const future = actionFeedbackV1({
    config,
    suffix: "future",
    execution_start: addMinutesV1(CAP04_S6_LOGICAL_TIME_V1, 5),
    execution_end: addMinutesV1(CAP04_S6_LOGICAL_TIME_V1, 10),
    ingested_at: addMinutesV1(CAP04_S6_LOGICAL_TIME_V1, 15),
    available_to_runtime_at: addMinutesV1(CAP04_S6_LOGICAL_TIME_V1, 15),
  });
  const futureSelection = selectCap05ActionFeedbackForTickV1({
    scope: input.scope,
    logical_time: input.logical_time,
    feedback_objects: [future],
  });
  check(futureSelection.trace.entries[0]?.disposition === "EXCLUDED_FUTURE", "future Action Feedback is never consumed by the current tick");

  const missingPolicies = buildCap04S6SingleTickFixtureV1();
  const missingSource = new InMemoryActionFeedbackSourceV1([actionFeedbackV1({ config: missingPolicies.runtime_config, suffix: "missing_policy" })]);
  const missingService = new Cap05ReceiptConsumingForecastScenarioTickServiceV1(
    new PrepareNextTickInputServiceV1(missingPolicies.runtime),
    missingPolicies.runtime,
    missingSource,
    missingPolicies.runtime,
    missingPolicies.runtime,
  );
  await assert.rejects(missingService.executeOneTick(missingPolicies.input), /CAP05_RECEIPT_TICK_CONFIG_POLICY_MISMATCH/);
  check(true, "receipt-consuming tick fails closed when CAP-05 Runtime Config policies are not pinned");

  assert.equal(fail, 0);
  assert.equal(pass, 15);
  console.log(`MCFT-CAP-05 receipt-consuming tick: ${pass} PASS, ${fail} FAIL`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
