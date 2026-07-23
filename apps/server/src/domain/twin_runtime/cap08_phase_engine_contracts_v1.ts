// apps/server/src/domain/twin_runtime/cap08_phase_engine_contracts_v1.ts
// Purpose: freeze the MCFT-CAP-08 stable Tick phase plan, S1 due-obligation shape, and barrier contract.
// Boundary: pure contract construction and validation only; no persistence, Runtime clock, Evidence loading, routes, scheduler, or model mathematics.

export const CAP08_PHASE_ORDER_V1 = ["resolve", "E", "H", "A", "B", "G", "C", "barrier"] as const;
export type Cap08PhaseIdV1 = (typeof CAP08_PHASE_ORDER_V1)[number];

export const CAP08_S1_RUN_CONTRACT_ID_V1 = "GEOX-MCFT-CAP-08-24-TICK-RUN-CONTRACT-V1" as const;
export const CAP08_S1_PHASE_ENGINE_CONTRACT_DIGEST_V1 = "sha256:41428596e893112483a8695ccd7bc28dc19dee35c2c3bf29e78395a86133d466" as const;
export const CAP08_S1_RUNTIME_START_V1 = "2026-06-01T00:00:00.000Z" as const;
export const CAP08_S1_TICK_COUNT_V1 = 24 as const;
export const CAP08_S1_SCENARIO_OPTIONS_V1 = ["NO_ACTION", "IRRIGATE_NOW_15MM", "IRRIGATE_NOW_25MM"] as const;

export type Cap08ScopeV1 = {
  tenant_id: string;
  project_id: string;
  group_id: string;
  field_id: string;
  season_id: string;
  zone_id: string;
};

export type Cap08TickPhasePlanV1 = {
  schema_version: "geox_mcft_cap08_tick_phase_plan_v1";
  run_contract_id: typeof CAP08_S1_RUN_CONTRACT_ID_V1;
  formal_run_id: string;
  scope: Cap08ScopeV1;
  tick_id: string;
  tick_index: number;
  logical_time: string;
  phase_order: readonly Cap08PhaseIdV1[];
  frozen_visibility_cutoff: string;
  a_update_profile: "S1_BASE_ORDINARY_STATE_FORECAST";
};

export type Cap08DueObligationSetV1 = {
  schema_version: "geox_mcft_cap08_due_obligation_set_v1";
  tick_id: string;
  logical_time: string;
  E: readonly ["BASE_REPLAY_EVIDENCE"];
  H: readonly [];
  A: readonly ["STATE_FORECAST_A1"];
  B: readonly ["THREE_OPTION_SCENARIO_SET"];
  G: readonly [];
  C: readonly [];
};

export type Cap08TickBarrierV1 = {
  schema_version: "geox_mcft_cap08_tick_barrier_v1";
  tick_id: string;
  logical_time: string;
  status: "COMPLETE";
  completed_phases: readonly Cap08PhaseIdV1[];
  a_record_set_count: 1;
  posterior_state_count: 1;
  successful_forecast_count: 1;
  forecast_point_count: 72;
  scenario_set_count: 1;
  scenario_option_count: 3;
  scenario_point_count: 216;
  action_feedback_count: 0;
  decision_count: 0;
  residual_count: 0;
  next_tick_legal: true;
};

function requiredStringV1(value: unknown, code: string): string {
  if (typeof value !== "string" || !value.trim()) throw new Error(code);
  return value;
}

function canonicalHourV1(value: unknown, code: string): string {
  const text = requiredStringV1(value, code);
  const parsed = Date.parse(text);
  if (!Number.isFinite(parsed) || new Date(parsed).toISOString() !== text || !text.endsWith(":00:00.000Z")) {
    throw new Error(code);
  }
  return text;
}

function exactScopeV1(scope: Cap08ScopeV1): Cap08ScopeV1 {
  const copy = structuredClone(scope);
  for (const field of ["tenant_id", "project_id", "group_id", "field_id", "season_id", "zone_id"] as const) {
    requiredStringV1(copy[field], `CAP08_SCOPE_${field.toUpperCase()}_REQUIRED`);
  }
  return copy;
}

export function cap08TickIdV1(index: number): string {
  if (!Number.isInteger(index) || index < 0 || index >= CAP08_S1_TICK_COUNT_V1) throw new Error("CAP08_TICK_INDEX_INVALID");
  return `T${String(index).padStart(2, "0")}`;
}

export function cap08TickLogicalTimeV1(index: number): string {
  cap08TickIdV1(index);
  return new Date(Date.parse(CAP08_S1_RUNTIME_START_V1) + index * 3_600_000).toISOString();
}

export function cap08TickIndexFromLogicalTimeV1(logicalTime: string): number {
  const canonical = canonicalHourV1(logicalTime, "CAP08_TICK_LOGICAL_TIME_INVALID");
  const index = (Date.parse(canonical) - Date.parse(CAP08_S1_RUNTIME_START_V1)) / 3_600_000;
  if (!Number.isInteger(index) || index < 0 || index >= CAP08_S1_TICK_COUNT_V1) throw new Error("CAP08_TICK_LOGICAL_TIME_OUT_OF_RANGE");
  return index;
}

export function buildCap08S1TickPhasePlanV1(input: {
  formal_run_id: string;
  scope: Cap08ScopeV1;
  logical_time: string;
}): Cap08TickPhasePlanV1 {
  const formalRunId = requiredStringV1(input.formal_run_id, "CAP08_FORMAL_RUN_ID_REQUIRED");
  const index = cap08TickIndexFromLogicalTimeV1(input.logical_time);
  return {
    schema_version: "geox_mcft_cap08_tick_phase_plan_v1",
    run_contract_id: CAP08_S1_RUN_CONTRACT_ID_V1,
    formal_run_id: formalRunId,
    scope: exactScopeV1(input.scope),
    tick_id: cap08TickIdV1(index),
    tick_index: index,
    logical_time: cap08TickLogicalTimeV1(index),
    phase_order: [...CAP08_PHASE_ORDER_V1],
    frozen_visibility_cutoff: cap08TickLogicalTimeV1(index),
    a_update_profile: "S1_BASE_ORDINARY_STATE_FORECAST",
  };
}

export function buildCap08S1DueObligationSetV1(plan: Cap08TickPhasePlanV1): Cap08DueObligationSetV1 {
  validateCap08S1TickPhasePlanV1(plan);
  return {
    schema_version: "geox_mcft_cap08_due_obligation_set_v1",
    tick_id: plan.tick_id,
    logical_time: plan.logical_time,
    E: ["BASE_REPLAY_EVIDENCE"],
    H: [],
    A: ["STATE_FORECAST_A1"],
    B: ["THREE_OPTION_SCENARIO_SET"],
    G: [],
    C: [],
  };
}

export function validateCap08S1TickPhasePlanV1(plan: Cap08TickPhasePlanV1): void {
  if (plan.schema_version !== "geox_mcft_cap08_tick_phase_plan_v1") throw new Error("CAP08_PHASE_PLAN_SCHEMA_INVALID");
  if (plan.run_contract_id !== CAP08_S1_RUN_CONTRACT_ID_V1) throw new Error("CAP08_RUN_CONTRACT_ID_MISMATCH");
  requiredStringV1(plan.formal_run_id, "CAP08_FORMAL_RUN_ID_REQUIRED");
  exactScopeV1(plan.scope);
  const index = cap08TickIndexFromLogicalTimeV1(plan.logical_time);
  if (plan.tick_index !== index || plan.tick_id !== cap08TickIdV1(index)) throw new Error("CAP08_TICK_IDENTITY_MISMATCH");
  if (plan.frozen_visibility_cutoff !== plan.logical_time) throw new Error("CAP08_VISIBILITY_CUTOFF_MISMATCH");
  if (plan.a_update_profile !== "S1_BASE_ORDINARY_STATE_FORECAST") throw new Error("CAP08_S1_A_PROFILE_INVALID");
  if (JSON.stringify(plan.phase_order) !== JSON.stringify(CAP08_PHASE_ORDER_V1)) throw new Error("CAP08_PHASE_ORDER_MISMATCH");
}

export function buildCap08S1TickBarrierV1(input: {
  plan: Cap08TickPhasePlanV1;
  completed_phases: readonly Cap08PhaseIdV1[];
  a_record_set_count: number;
  posterior_state_count: number;
  successful_forecast_count: number;
  forecast_point_count: number;
  scenario_set_count: number;
  scenario_option_count: number;
  scenario_point_count: number;
  action_feedback_count: number;
  decision_count: number;
  residual_count: number;
}): Cap08TickBarrierV1 {
  validateCap08S1TickPhasePlanV1(input.plan);
  if (JSON.stringify(input.completed_phases) !== JSON.stringify(CAP08_PHASE_ORDER_V1)) throw new Error("CAP08_BARRIER_PHASE_ORDER_INCOMPLETE");
  const exact: Record<string, number> = {
    a_record_set_count: 1,
    posterior_state_count: 1,
    successful_forecast_count: 1,
    forecast_point_count: 72,
    scenario_set_count: 1,
    scenario_option_count: 3,
    scenario_point_count: 216,
    action_feedback_count: 0,
    decision_count: 0,
    residual_count: 0,
  };
  for (const [field, expected] of Object.entries(exact)) {
    if (input[field as keyof typeof input] !== expected) throw new Error(`CAP08_BARRIER_CARDINALITY_MISMATCH:${field}`);
  }
  return {
    schema_version: "geox_mcft_cap08_tick_barrier_v1",
    tick_id: input.plan.tick_id,
    logical_time: input.plan.logical_time,
    status: "COMPLETE",
    completed_phases: [...CAP08_PHASE_ORDER_V1],
    a_record_set_count: 1,
    posterior_state_count: 1,
    successful_forecast_count: 1,
    forecast_point_count: 72,
    scenario_set_count: 1,
    scenario_option_count: 3,
    scenario_point_count: 216,
    action_feedback_count: 0,
    decision_count: 0,
    residual_count: 0,
    next_tick_legal: true,
  };
}
