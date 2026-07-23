// apps/server/src/runtime/twin_runtime/cap08_s2_formal_provider_qualification_service_v1.ts
// Purpose: qualify the completed S1 canonical Tick outputs as the strict MCFT-CAP-08.S2 formal Forcing/Evidence/State/Forecast provider chain.
// Boundary: read-only validation and qualification result only; no canonical writes, late correction application, Residual, Decision, Action Feedback, scheduler, route, or production Runtime authority.

import type { CanonicalObjectEnvelopeV1 } from "../../domain/twin_runtime/canonical_object_contracts_v1.js";
import { validateCap04ForecastForcingWindowV1 } from "../../domain/twin_runtime/future_forcing_contracts_v1.js";
import {
  CAP08_S2_FORMAL_PROVIDER_CONTRACT_DIGEST_V1,
  CAP08_S2_FORMAL_PROVIDER_PROFILE_ID_V1,
  CAP08_S2_SELECTED_STATE_TICK_INDEXES_V1,
  buildCap08S2FormalDueObligationV1,
  type Cap08S2FormalProviderQualificationV1,
  type Cap08S2TickProviderQualificationV1,
} from "../../domain/twin_runtime/cap08_s2_formal_provider_contracts_v1.js";
import {
  CAP08_PHASE_ORDER_V1,
  CAP08_S1_PHASE_ENGINE_CONTRACT_DIGEST_V1,
  CAP08_S1_SCENARIO_OPTIONS_V1,
  CAP08_S1_TICK_COUNT_V1,
} from "../../domain/twin_runtime/cap08_phase_engine_contracts_v1.js";
import type { RunCap08S1BaseRangeResultV1 } from "./cap08_s1_base_range_service_v1.js";
import { Cap08S2QualifiedEvidenceSourceV1 } from "./cap08_s2_qualified_evidence_source_v1.js";
import type { TwinScopeKeyV1 } from "./ports.js";

function memberV1(recordSet: { members: CanonicalObjectEnvelopeV1[] }, objectType: string): CanonicalObjectEnvelopeV1 {
  const matches = recordSet.members.filter((member) => member.object_type === objectType);
  if (matches.length !== 1) throw new Error(`CAP08_S2_PROVIDER_MEMBER_CARDINALITY:${objectType}`);
  return matches[0];
}

function sortedV1(values: readonly string[]): string[] {
  return [...new Set(values)].sort((left, right) => left.localeCompare(right));
}

function exactV1(actual: readonly string[], expected: readonly string[], code: string): void {
  if (JSON.stringify(sortedV1(actual)) !== JSON.stringify(sortedV1(expected))) throw new Error(code);
}

function exactScopeV1(actual: TwinScopeKeyV1, expected: TwinScopeKeyV1): void {
  for (const field of ["tenant_id", "project_id", "group_id", "field_id", "season_id", "zone_id"] as const) {
    if (actual[field] !== expected[field]) throw new Error(`CAP08_S2_PROVIDER_SCOPE_MISMATCH:${field}`);
  }
}

export class Cap08S2FormalProviderQualificationServiceV1 {
  constructor(private readonly evidenceSource: Cap08S2QualifiedEvidenceSourceV1) {}

  qualifyRange(input: {
    formal_run_id: string;
    scope: TwinScopeKeyV1;
    range: RunCap08S1BaseRangeResultV1;
  }): Cap08S2FormalProviderQualificationV1 {
    if (!input.formal_run_id.trim()) throw new Error("CAP08_S2_FORMAL_RUN_ID_REQUIRED");
    if (input.range.status !== "COMPLETED") throw new Error("CAP08_S2_FRESH_COMPLETED_RANGE_REQUIRED");
    if (input.range.formal_run_id !== input.formal_run_id) throw new Error("CAP08_S2_FORMAL_RUN_ID_MISMATCH");
    if (input.range.tick_results.length !== CAP08_S1_TICK_COUNT_V1) throw new Error("CAP08_S2_TICK_CARDINALITY_MISMATCH");
    if (input.range.phase_engine_contract_digest !== CAP08_S1_PHASE_ENGINE_CONTRACT_DIGEST_V1) {
      throw new Error("CAP08_S2_PHASE_ENGINE_CONTRACT_DRIFT");
    }

    const tickQualifications: Cap08S2TickProviderQualificationV1[] = [];
    let selectedStateObservationCount = 0;
    let quarantinedResidualOnlyCount = 0;
    let quarantinedLateStateCorrectionCount = 0;
    let observedNotAvailableWitnessCount = 0;

    for (const result of input.range.tick_results) {
      exactScopeV1(result.phase_plan.scope, input.scope);
      if (JSON.stringify(result.phase_trace.map((phase) => phase.phase)) !== JSON.stringify(CAP08_PHASE_ORDER_V1)) {
        throw new Error(`CAP08_S2_PHASE_ORDER_DRIFT:${result.phase_plan.tick_id}`);
      }
      const due = buildCap08S2FormalDueObligationV1(result.phase_plan.logical_time);
      if (result.phase_plan.tick_id !== due.tick_id) throw new Error("CAP08_S2_TICK_IDENTITY_MISMATCH");
      const trace = this.evidenceSource.readTrace({ scope: input.scope, logical_time: due.logical_time });
      exactV1(trace.received_due_fvo_ids, due.due_fvo_ids, "CAP08_S2_RECEIVED_DUE_FVO_MISMATCH");
      exactV1(trace.forwarded_state_observation_ids, due.selected_state_observation_ids, "CAP08_S2_FORWARDED_STATE_OBSERVATION_MISMATCH");
      exactV1(trace.quarantined_residual_only_ids, due.residual_only_observation_ids, "CAP08_S2_RESIDUAL_QUARANTINE_MISMATCH");
      exactV1(trace.quarantined_late_state_correction_ids, due.late_state_correction_observation_ids, "CAP08_S2_LATE_QUARANTINE_MISMATCH");
      exactV1(
        trace.observed_but_not_available_ids_confirmed_absent,
        due.observed_but_not_available_ids,
        "CAP08_S2_UNAVAILABLE_ABSENCE_WITNESS_MISMATCH",
      );

      const evidenceWindow = result.a_provider_result.evidence_window;
      const forcingWindow = result.a_provider_result.forcing_window;
      if (!evidenceWindow) throw new Error(`CAP08_S2_EVIDENCE_WINDOW_REQUIRED:${due.tick_id}`);
      if (!forcingWindow) throw new Error(`CAP08_S2_FORCING_WINDOW_REQUIRED:${due.tick_id}`);
      validateCap04ForecastForcingWindowV1(forcingWindow);
      if (forcingWindow.logical_time !== due.logical_time || forcingWindow.points.length !== 72) {
        throw new Error(`CAP08_S2_FORCING_WINDOW_CARDINALITY:${due.tick_id}`);
      }
      exactV1(forcingWindow.evidence_refs, trace.forcing_evidence_ids, "CAP08_S2_FORCING_EVIDENCE_REF_MISMATCH");

      const expectedSelected = due.selected_state_observation_ids[0] ?? null;
      if (evidenceWindow.observation_selection.selected_observation_ref !== expectedSelected) {
        throw new Error(`CAP08_S2_SELECTED_OBSERVATION_MISMATCH:${due.tick_id}`);
      }
      exactV1(
        evidenceWindow.assimilation_applied_evidence_refs,
        due.selected_state_observation_ids,
        `CAP08_S2_APPLIED_OBSERVATION_MISMATCH:${due.tick_id}`,
      );
      if (due.late_state_correction_observation_ids.some((id) => evidenceWindow.assimilation_applied_evidence_refs.includes(id))) {
        throw new Error(`CAP08_S2_LATE_CORRECTION_APPLIED_BEFORE_S4:${due.tick_id}`);
      }

      const state = memberV1(result.a_record_set, "twin_state_estimate_v1");
      const forecast = memberV1(result.a_record_set, "twin_forecast_run_v1");
      if (state.logical_time !== due.logical_time || forecast.logical_time !== due.logical_time) {
        throw new Error(`CAP08_S2_STATE_FORECAST_TIME_MISMATCH:${due.tick_id}`);
      }
      const forecastPayload = forecast.payload as Record<string, unknown>;
      if (forecastPayload.status !== "COMPLETED") throw new Error(`CAP08_S2_SUCCESSFUL_FORECAST_REQUIRED:${due.tick_id}`);
      if (!Array.isArray(forecastPayload.points) || forecastPayload.points.length !== 72) {
        throw new Error(`CAP08_S2_FORECAST_POINT_CARDINALITY:${due.tick_id}`);
      }
      if (forecastPayload.source_posterior_ref !== state.object_id || forecastPayload.source_posterior_hash !== state.determinism_hash) {
        throw new Error(`CAP08_S2_FORECAST_STATE_AUTHORITY_MISMATCH:${due.tick_id}`);
      }
      const scenarioOptions = result.b_record.scenario_set.payload.options.map((option) => option.option_id);
      if (JSON.stringify(scenarioOptions) !== JSON.stringify(CAP08_S1_SCENARIO_OPTIONS_V1)) {
        throw new Error(`CAP08_S2_S1_SCENARIO_REGRESSION:${due.tick_id}`);
      }
      if (result.barrier.residual_count !== 0 || result.barrier.decision_count !== 0 || result.barrier.action_feedback_count !== 0) {
        throw new Error(`CAP08_S2_LATER_SLICE_WRITE_FORBIDDEN:${due.tick_id}`);
      }

      tickQualifications.push({
        schema_version: "geox_mcft_cap08_s2_tick_provider_qualification_v1",
        provider_profile_id: CAP08_S2_FORMAL_PROVIDER_PROFILE_ID_V1,
        provider_contract_digest: CAP08_S2_FORMAL_PROVIDER_CONTRACT_DIGEST_V1,
        formal_run_id: input.formal_run_id,
        scope: structuredClone(input.scope),
        tick_id: due.tick_id,
        logical_time: due.logical_time,
        evidence_trace_digest: trace.trace_digest,
        selected_state_observation_ref: expectedSelected,
        applied_state_observation_refs: [...evidenceWindow.assimilation_applied_evidence_refs],
        weather_snapshot_ref: forcingWindow.weather_snapshot_ref,
        et0_snapshot_ref: forcingWindow.et0_snapshot_ref,
        forcing_window_hash: forcingWindow.forcing_window_hash,
        state_ref: state.object_id,
        state_hash: state.determinism_hash,
        forecast_ref: forecast.object_id,
        forecast_hash: forecast.determinism_hash,
        forecast_point_count: 72,
        scenario_options: CAP08_S1_SCENARIO_OPTIONS_V1,
        late_state_correction_applied: false,
        residual_persisted: false,
        decision_persisted: false,
        action_feedback_persisted: false,
      });

      selectedStateObservationCount += due.selected_state_observation_ids.length;
      quarantinedResidualOnlyCount += due.residual_only_observation_ids.length;
      quarantinedLateStateCorrectionCount += due.late_state_correction_observation_ids.length;
      observedNotAvailableWitnessCount += due.observed_but_not_available_ids.length;
    }

    if (this.evidenceSource.getTraceCount() !== CAP08_S1_TICK_COUNT_V1) throw new Error("CAP08_S2_EVIDENCE_TRACE_CARDINALITY");
    if (selectedStateObservationCount !== CAP08_S2_SELECTED_STATE_TICK_INDEXES_V1.length) {
      throw new Error("CAP08_S2_SELECTED_OBSERVATION_TOTAL_MISMATCH");
    }
    if (quarantinedResidualOnlyCount !== 17) throw new Error("CAP08_S2_RESIDUAL_QUARANTINE_TOTAL_MISMATCH");
    if (quarantinedLateStateCorrectionCount !== 1) throw new Error("CAP08_S2_LATE_QUARANTINE_TOTAL_MISMATCH");
    if (observedNotAvailableWitnessCount !== 15) throw new Error("CAP08_S2_UNAVAILABLE_WITNESS_TOTAL_MISMATCH");

    return {
      schema_version: "geox_mcft_cap08_s2_formal_provider_qualification_v1",
      provider_profile_id: CAP08_S2_FORMAL_PROVIDER_PROFILE_ID_V1,
      provider_contract_digest: CAP08_S2_FORMAL_PROVIDER_CONTRACT_DIGEST_V1,
      formal_run_id: input.formal_run_id,
      scope: structuredClone(input.scope),
      successful_tick_count: 24,
      forcing_window_count: 24,
      state_count: 24,
      forecast_count: 24,
      forecast_point_count: 1728,
      selected_state_observation_count: 5,
      quarantined_residual_only_count: 17,
      quarantined_late_state_correction_count: 1,
      observed_but_not_available_absence_witness_count: 15,
      tick_qualifications: tickQualifications,
      phase_engine_contract_preserved: true,
      late_state_correction_deferred_to_s4: true,
      residual_persistence_deferred_to_s5: true,
      decision_action_feedback_deferred_to_s3: true,
      production_runtime_source_authorized: false,
    };
  }
}
