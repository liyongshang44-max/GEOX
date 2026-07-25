// Purpose: freeze the MCFT-CAP-08.S3 formal Decision + Action Feedback provider profile, T05-T10 event obligations, exact replay values, and nonclaims.
// Boundary: pure deterministic contracts only; no filesystem, database, canonical write, route, scheduler, approval exercise, dispatch creation, Residual, Calibration, or production Runtime authority.

import { semanticHashV1 } from "./canonical_identity_v1.js";
import {
  CAP08_S1_RUN_CONTRACT_ID_V1,
  cap08TickIdV1,
  cap08TickIndexFromLogicalTimeV1,
  cap08TickLogicalTimeV1,
  type Cap08ScopeV1,
} from "./cap08_phase_engine_contracts_v1.js";

export const CAP08_S3_FORMAL_PROVIDER_PROFILE_ID_V1 =
  "MCFT-CAP-08.S3-DECISION-ACTION-FEEDBACK-V1" as const;
export const CAP08_S3_FORMAL_DATASET_ID_V1 = "mcft_cap08_stage1a_replay_v1" as const;
export const CAP08_S3_SELECTED_OPTION_ID_V1 = "IRRIGATE_NOW_15MM" as const;
export const CAP08_S3_APPROVED_AMOUNT_MM_V1 = "15.000000" as const;
export const CAP08_S3_EXECUTED_AMOUNT_MM_V1 = "13.600000" as const;
export const CAP08_S3_COVERAGE_FRACTION_V1 = "0.910000" as const;
export const CAP08_S3_TARGET_SCOPE_EQUIVALENT_AMOUNT_MM_V1 = "12.376000" as const;
export const CAP08_S3_OUTCOME_FVO_ID_V1 = "FVO-10" as const;
export const CAP08_S3_OUTCOME_VALUE_V1 = "0.304500" as const;

export type Cap08S3TickObligationV1 = {
  schema_version: "geox_mcft_cap08_s3_tick_obligation_v1";
  provider_profile_id: typeof CAP08_S3_FORMAL_PROVIDER_PROFILE_ID_V1;
  run_contract_id: typeof CAP08_S1_RUN_CONTRACT_ID_V1;
  tick_id: string;
  tick_index: number;
  logical_time: string;
  resolve_decision_source_and_commit_at_g: boolean;
  commit_approval_plan_binding_at_e: boolean;
  materialize_receipt_at_e: boolean;
  commit_action_feedback_at_h: boolean;
  require_action_feedback_readback_at_h: boolean;
  require_action_feedback_consumption_at_a: boolean;
  require_outcome_absence: boolean;
  require_outcome_fvo10_identity: boolean;
};

export type Cap08S3ProviderTickTraceV1 = {
  schema_version: "geox_mcft_cap08_s3_provider_tick_trace_v1";
  provider_profile_id: typeof CAP08_S3_FORMAL_PROVIDER_PROFILE_ID_V1;
  provider_contract_digest: string;
  formal_run_id: string;
  scope: Cap08ScopeV1;
  tick_id: string;
  logical_time: string;
  decision_ref: string | null;
  decision_hash: string | null;
  approval_assertion_ref: string | null;
  approval_assertion_hash: string | null;
  approved_plan_ref: string | null;
  approved_plan_hash: string | null;
  receipt_ref: string | null;
  receipt_hash: string | null;
  action_feedback_ref: string | null;
  action_feedback_hash: string | null;
  action_feedback_consumed_by_a: boolean;
  outcome_fvo10_ref: string | null;
  outcome_fvo10_value: string | null;
  recommendation_count: 0;
  ao_act_count: 0;
  dispatch_count: 0;
  residual_count: 0;
  model_activation_count: 0;
  trace_digest: string;
};

export type Cap08S3FormalProviderQualificationV1 = {
  schema_version: "geox_mcft_cap08_s3_formal_provider_qualification_v1";
  provider_profile_id: typeof CAP08_S3_FORMAL_PROVIDER_PROFILE_ID_V1;
  provider_contract_digest: string;
  formal_run_id: string;
  scope: Cap08ScopeV1;
  successful_tick_count: 24;
  decision_count: 1;
  approval_assertion_count: 1;
  approved_plan_count: 1;
  execution_receipt_count: 1;
  action_feedback_count: 1;
  outcome_fvo10_identity_count: 1;
  outcome_fvo_duplicate_count: 0;
  t08_h_before_a: true;
  t09_outcome_absence: true;
  t10_ordinary_assimilation: true;
  phase_engine_contract_preserved: true;
  completed_rerun_write_delta: 0;
  recommendation_count: 0;
  ao_act_count: 0;
  dispatch_count: 0;
  residual_count: 0;
  calibration_candidate_count: 0;
  shadow_evaluation_count: 0;
  model_activation_count: 0;
  production_runtime_source_authorized: false;
  tick_traces: Cap08S3ProviderTickTraceV1[];
};

export function buildCap08S3TickObligationV1(logicalTime: string): Cap08S3TickObligationV1 {
  const index = cap08TickIndexFromLogicalTimeV1(logicalTime);
  return {
    schema_version: "geox_mcft_cap08_s3_tick_obligation_v1",
    provider_profile_id: CAP08_S3_FORMAL_PROVIDER_PROFILE_ID_V1,
    run_contract_id: CAP08_S1_RUN_CONTRACT_ID_V1,
    tick_id: cap08TickIdV1(index),
    tick_index: index,
    logical_time: cap08TickLogicalTimeV1(index),
    resolve_decision_source_and_commit_at_g: index === 5,
    commit_approval_plan_binding_at_e: index === 6,
    materialize_receipt_at_e: index === 8,
    commit_action_feedback_at_h: index === 8,
    require_action_feedback_readback_at_h: index === 9 || index === 10,
    require_action_feedback_consumption_at_a: index === 8,
    require_outcome_absence: index === 9,
    require_outcome_fvo10_identity: index === 10,
  };
}

export function validateCap08S3TickObligationV1(value: Cap08S3TickObligationV1): void {
  const expected = buildCap08S3TickObligationV1(value.logical_time);
  if (JSON.stringify(value) !== JSON.stringify(expected)) throw new Error("CAP08_S3_TICK_OBLIGATION_MISMATCH");
}

export function buildCap08S3ProviderTickTraceV1(
  value: Omit<Cap08S3ProviderTickTraceV1, "schema_version" | "provider_profile_id" | "provider_contract_digest" | "trace_digest">,
): Cap08S3ProviderTickTraceV1 {
  const base = {
    schema_version: "geox_mcft_cap08_s3_provider_tick_trace_v1" as const,
    provider_profile_id: CAP08_S3_FORMAL_PROVIDER_PROFILE_ID_V1,
    provider_contract_digest: CAP08_S3_FORMAL_PROVIDER_CONTRACT_DIGEST_V1,
    ...value,
  };
  return { ...base, trace_digest: semanticHashV1(base) };
}

export const CAP08_S3_NEGATIVE_CASE_IDS_V1 = Array.from(
  { length: 22 },
  (_, index) => `S3-N${String(index + 1).padStart(2, "0")}`,
) as readonly string[];

export const CAP08_S3_POINTER_CASE_IDS_V1 = Array.from(
  { length: 6 },
  (_, index) => `S3-P${String(index + 1).padStart(2, "0")}`,
) as readonly string[];

export const CAP08_S3_FORMAL_PROVIDER_CONTRACT_V1 = {
  schema_version: "geox_mcft_cap08_s3_formal_provider_contract_v1",
  provider_profile_id: CAP08_S3_FORMAL_PROVIDER_PROFILE_ID_V1,
  run_contract_id: CAP08_S1_RUN_CONTRACT_ID_V1,
  dataset_id: CAP08_S3_FORMAL_DATASET_ID_V1,
  selected_option_id: CAP08_S3_SELECTED_OPTION_ID_V1,
  event_ticks: {
    human_decision: "T05",
    approval_and_plan: "T06",
    physical_execution_receipt_absent: "T07",
    receipt_visible_and_h_before_a: "T08",
    outcome_absent: "T09",
    outcome_fvo10: "T10",
  },
  replay_values: {
    approved_amount_mm: CAP08_S3_APPROVED_AMOUNT_MM_V1,
    executed_amount_mm: CAP08_S3_EXECUTED_AMOUNT_MM_V1,
    coverage_fraction: CAP08_S3_COVERAGE_FRACTION_V1,
    target_scope_equivalent_amount_mm: CAP08_S3_TARGET_SCOPE_EQUIVALENT_AMOUNT_MM_V1,
    outcome_fvo_id: CAP08_S3_OUTCOME_FVO_ID_V1,
    outcome_value: CAP08_S3_OUTCOME_VALUE_V1,
  },
  exact_cardinality: {
    human_decision: 1,
    approval_assertion: 1,
    approved_plan: 1,
    execution_receipt: 1,
    action_feedback: 1,
    outcome_fvo10_identity: 1,
    outcome_fvo_duplicate: 0,
    recommendation: 0,
    ao_act: 0,
    dispatch: 0,
    residual: 0,
    calibration_candidate: 0,
    shadow_evaluation: 0,
    model_activation: 0,
  },
  negative_case_ids: [...CAP08_S3_NEGATIVE_CASE_IDS_V1],
  pointer_case_ids: [...CAP08_S3_POINTER_CASE_IDS_V1],
  phase_engine_contract_preserved: true,
  late_append_forward_owner: "MCFT-CAP-08.S4",
  residual_calibration_shadow_owner: "MCFT-CAP-08.S5",
  production_runtime_source_authorized: false,
} as const;

export const CAP08_S3_FORMAL_PROVIDER_CONTRACT_DIGEST_V1 =
  semanticHashV1(CAP08_S3_FORMAL_PROVIDER_CONTRACT_V1);
