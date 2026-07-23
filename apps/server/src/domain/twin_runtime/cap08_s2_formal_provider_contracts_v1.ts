// apps/server/src/domain/twin_runtime/cap08_s2_formal_provider_contracts_v1.ts
// Purpose: freeze the MCFT-CAP-08.S2 formal Forcing/Evidence/State/Forecast provider profile and exact T00-T23 due-obligation classification.
// Boundary: pure deterministic contracts only; no filesystem, database, canonical writes, routes, scheduler, Decision, late correction application, Residual, Calibration, or production Runtime authority.

import { semanticHashV1 } from "./canonical_identity_v1.js";
import {
  CAP08_S1_RUN_CONTRACT_ID_V1,
  CAP08_S1_SCENARIO_OPTIONS_V1,
  CAP08_S1_TICK_COUNT_V1,
  cap08TickIdV1,
  cap08TickIndexFromLogicalTimeV1,
  cap08TickLogicalTimeV1,
  type Cap08ScopeV1,
} from "./cap08_phase_engine_contracts_v1.js";

export const CAP08_S2_FORMAL_DATASET_ID_V1 = "mcft_cap08_stage1a_replay_v1" as const;
export const CAP08_S2_FORMAL_PROVIDER_PROFILE_ID_V1 =
  "MCFT-CAP-08.S2-FORMAL-FORCING-EVIDENCE-STATE-FORECAST-V1" as const;
export const CAP08_S2_FORMAL_FORCING_BINDING_IDS_V1 = ["binding_weather", "binding_et0"] as const;
export const CAP08_S2_STATE_OBSERVATION_BINDING_ID_V1 = "soil_obs_c8_20cm_v1" as const;
export const CAP08_S2_SELECTED_STATE_TICK_INDEXES_V1 = [2, 3, 4, 10, 22] as const;

export type Cap08S2FormalDueObligationV1 = {
  schema_version: "geox_mcft_cap08_s2_formal_due_obligation_v1";
  run_contract_id: typeof CAP08_S1_RUN_CONTRACT_ID_V1;
  provider_profile_id: typeof CAP08_S2_FORMAL_PROVIDER_PROFILE_ID_V1;
  tick_id: string;
  tick_index: number;
  logical_time: string;
  due_fvo_ids: string[];
  due_residual_ids: string[];
  selected_state_observation_ids: string[];
  late_state_correction_observation_ids: string[];
  residual_only_observation_ids: string[];
  observed_but_not_available_ids: string[];
};

export type Cap08S2EvidenceQualificationTraceV1 = {
  schema_version: "geox_mcft_cap08_s2_evidence_qualification_trace_v1";
  provider_profile_id: typeof CAP08_S2_FORMAL_PROVIDER_PROFILE_ID_V1;
  scope: Cap08ScopeV1;
  tick_id: string;
  logical_time: string;
  received_record_ids: string[];
  dynamics_evidence_ids: string[];
  forcing_evidence_ids: string[];
  received_due_fvo_ids: string[];
  forwarded_state_observation_ids: string[];
  quarantined_residual_only_ids: string[];
  quarantined_late_state_correction_ids: string[];
  observed_but_not_available_ids_confirmed_absent: string[];
  forwarded_record_ids: string[];
  trace_digest: string;
};

export type Cap08S2TickProviderQualificationV1 = {
  schema_version: "geox_mcft_cap08_s2_tick_provider_qualification_v1";
  provider_profile_id: typeof CAP08_S2_FORMAL_PROVIDER_PROFILE_ID_V1;
  provider_contract_digest: string;
  formal_run_id: string;
  scope: Cap08ScopeV1;
  tick_id: string;
  logical_time: string;
  evidence_trace_digest: string;
  selected_state_observation_ref: string | null;
  applied_state_observation_refs: string[];
  weather_snapshot_ref: string;
  et0_snapshot_ref: string;
  forcing_window_hash: string;
  state_ref: string;
  state_hash: string;
  forecast_ref: string;
  forecast_hash: string;
  forecast_point_count: 72;
  scenario_options: readonly ["NO_ACTION", "IRRIGATE_NOW_15MM", "IRRIGATE_NOW_25MM"];
  late_state_correction_applied: false;
  residual_persisted: false;
  decision_persisted: false;
  action_feedback_persisted: false;
};

export type Cap08S2FormalProviderQualificationV1 = {
  schema_version: "geox_mcft_cap08_s2_formal_provider_qualification_v1";
  provider_profile_id: typeof CAP08_S2_FORMAL_PROVIDER_PROFILE_ID_V1;
  provider_contract_digest: string;
  formal_run_id: string;
  scope: Cap08ScopeV1;
  successful_tick_count: 24;
  forcing_window_count: 24;
  state_count: 24;
  forecast_count: 24;
  forecast_point_count: 1728;
  selected_state_observation_count: 5;
  quarantined_residual_only_count: 17;
  quarantined_late_state_correction_count: 1;
  observed_but_not_available_absence_witness_count: 15;
  tick_qualifications: Cap08S2TickProviderQualificationV1[];
  phase_engine_contract_preserved: true;
  late_state_correction_deferred_to_s4: true;
  residual_persistence_deferred_to_s5: true;
  decision_action_feedback_deferred_to_s3: true;
  production_runtime_source_authorized: false;
};

function fvoIdV1(index: number): string {
  if (!Number.isInteger(index) || index < 1 || index > 24) throw new Error("CAP08_S2_FVO_INDEX_INVALID");
  return `FVO-${String(index).padStart(2, "0")}`;
}

function residualIdV1(index: number): string {
  if (!Number.isInteger(index) || index < 1 || index > 24) throw new Error("CAP08_S2_RESIDUAL_INDEX_INVALID");
  return `R-${String(index).padStart(2, "0")}`;
}

function selectedStateIndexV1(index: number): boolean {
  return (CAP08_S2_SELECTED_STATE_TICK_INDEXES_V1 as readonly number[]).includes(index);
}

function canonicalSortedV1(values: readonly string[]): string[] {
  return [...new Set(values)].sort((left, right) => left.localeCompare(right));
}

export function buildCap08S2FormalDueObligationV1(logicalTime: string): Cap08S2FormalDueObligationV1 {
  const index = cap08TickIndexFromLogicalTimeV1(logicalTime);
  const dueFvoIds: string[] = [];
  const dueResidualIds: string[] = [];
  const selectedStateObservationIds: string[] = [];
  const lateStateCorrectionObservationIds: string[] = [];
  const residualOnlyObservationIds: string[] = [];
  const observedButNotAvailableIds: string[] = [];

  if (index >= 1 && index <= 15) observedButNotAvailableIds.push(fvoIdV1(1));

  if (index >= 2) {
    if (index === 16) {
      dueFvoIds.push(fvoIdV1(1), fvoIdV1(16));
      dueResidualIds.push(residualIdV1(1), residualIdV1(16));
      lateStateCorrectionObservationIds.push(fvoIdV1(1));
      residualOnlyObservationIds.push(fvoIdV1(16));
    } else {
      const fvo = fvoIdV1(index);
      dueFvoIds.push(fvo);
      dueResidualIds.push(residualIdV1(index));
      if (selectedStateIndexV1(index)) selectedStateObservationIds.push(fvo);
      else residualOnlyObservationIds.push(fvo);
    }
  }

  return {
    schema_version: "geox_mcft_cap08_s2_formal_due_obligation_v1",
    run_contract_id: CAP08_S1_RUN_CONTRACT_ID_V1,
    provider_profile_id: CAP08_S2_FORMAL_PROVIDER_PROFILE_ID_V1,
    tick_id: cap08TickIdV1(index),
    tick_index: index,
    logical_time: cap08TickLogicalTimeV1(index),
    due_fvo_ids: canonicalSortedV1(dueFvoIds),
    due_residual_ids: canonicalSortedV1(dueResidualIds),
    selected_state_observation_ids: canonicalSortedV1(selectedStateObservationIds),
    late_state_correction_observation_ids: canonicalSortedV1(lateStateCorrectionObservationIds),
    residual_only_observation_ids: canonicalSortedV1(residualOnlyObservationIds),
    observed_but_not_available_ids: canonicalSortedV1(observedButNotAvailableIds),
  };
}

export function validateCap08S2FormalDueObligationV1(value: Cap08S2FormalDueObligationV1): void {
  const expected = buildCap08S2FormalDueObligationV1(value.logical_time);
  if (JSON.stringify(value) !== JSON.stringify(expected)) throw new Error("CAP08_S2_DUE_OBLIGATION_MISMATCH");
}

export const CAP08_S2_FORMAL_PROVIDER_CONTRACT_V1 = {
  schema_version: "geox_mcft_cap08_s2_formal_provider_contract_v1",
  provider_profile_id: CAP08_S2_FORMAL_PROVIDER_PROFILE_ID_V1,
  run_contract_id: CAP08_S1_RUN_CONTRACT_ID_V1,
  dataset_id: CAP08_S2_FORMAL_DATASET_ID_V1,
  successful_tick_count: CAP08_S1_TICK_COUNT_V1,
  forcing_binding_ids: [...CAP08_S2_FORMAL_FORCING_BINDING_IDS_V1],
  state_observation_binding_id: CAP08_S2_STATE_OBSERVATION_BINDING_ID_V1,
  selected_state_tick_indexes: [...CAP08_S2_SELECTED_STATE_TICK_INDEXES_V1],
  forecast_point_count_per_tick: 72,
  scenario_options: [...CAP08_S1_SCENARIO_OPTIONS_V1],
  residual_persistence_owner: "MCFT-CAP-08.S5",
  late_state_correction_owner: "MCFT-CAP-08.S4",
  decision_action_feedback_owner: "MCFT-CAP-08.S3",
  production_runtime_source_authorized: false,
} as const;

export const CAP08_S2_FORMAL_PROVIDER_CONTRACT_DIGEST_V1 =
  semanticHashV1(CAP08_S2_FORMAL_PROVIDER_CONTRACT_V1);
