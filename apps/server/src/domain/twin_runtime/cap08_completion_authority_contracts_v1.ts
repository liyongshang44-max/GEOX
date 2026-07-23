// apps/server/src/domain/twin_runtime/cap08_completion_authority_contracts_v1.ts
// Purpose: define the persisted MCFT-CAP-08 S1 completion-authority tuple and exact terminal-graph inspection contract.
// Boundary: pure contracts and deterministic identity only; no SQL, canonical writes, routes, scheduler, wall clock, or production Runtime authority.

import { deriveSemanticObjectIdV1, semanticHashV1 } from "./canonical_identity_v1.js";

export const CAP08_COMPLETION_AUTHORITY_KIND_V1 = "REALITY_BINDING" as const;
export const CAP08_COMPLETION_AUTHORITY_SCHEMA_VERSION_V1 = "geox_mcft_cap08_completion_authority_v1" as const;

export const CAP08_COMPLETION_ERROR_CODES_V1 = [
  "CAP08_COMPLETION_FORMAL_RUN_MISMATCH",
  "CAP08_COMPLETION_SCOPE_MISMATCH",
  "CAP08_COMPLETION_LINEAGE_MISMATCH",
  "CAP08_COMPLETION_REVISION_MISMATCH",
  "CAP08_COMPLETION_TERMINAL_GRAPH_INCOMPLETE",
  "CAP08_COMPLETION_CARDINALITY_MISMATCH",
  "CAP08_COMPLETION_CONTRACT_DIGEST_MISMATCH",
  "CAP08_COMPLETION_SOURCE_DIGEST_MISMATCH",
  "CAP08_COMPLETION_FOREIGN_RUN",
] as const;

export type Cap08CompletionErrorCodeV1 = (typeof CAP08_COMPLETION_ERROR_CODES_V1)[number];

export type Cap08CompletionScopeV1 = {
  tenant_id: string;
  project_id: string;
  group_id: string;
  field_id: string;
  season_id: string;
  zone_id: string;
};

export type InspectCap08CompletionAuthorityInputV1 = {
  run_contract_id: string;
  formal_run_id: string;
  scope: Cap08CompletionScopeV1;
  initial_logical_time: string;
  terminal_logical_time: string;
  expected_next_logical_time: string;
  phase_engine_contract_digest: string;
  phase_engine_source_digest: string;
  expected_tick_count: number;
  expected_state_count: number;
  expected_forecast_count: number;
  expected_scenario_set_count: number;
};

export type Cap08CompletionAuthorityV1 = {
  schema_version: typeof CAP08_COMPLETION_AUTHORITY_SCHEMA_VERSION_V1;
  authority_kind: typeof CAP08_COMPLETION_AUTHORITY_KIND_V1;
  authority_ref: string;
  run_contract_id: string;
  formal_run_id: string;
  scope: Cap08CompletionScopeV1;
  lineage_id: string;
  revision_id: string;
  initial_logical_time: string;
  terminal_logical_time: string;
  expected_next_logical_time: string;
  terminal_tick_ref: string;
  terminal_tick_hash: string;
  terminal_checkpoint_ref: string;
  terminal_checkpoint_hash: string;
  phase_engine_contract_digest: string;
  phase_engine_source_digest: string;
  expected_tick_count: number;
  expected_state_count: number;
  expected_forecast_count: number;
  expected_scenario_set_count: number;
  determinism_hash: string;
};

export type Cap08CompletionGraphV1 = {
  scope: Cap08CompletionScopeV1;
  present: boolean;
  active_lineage_ref: string | null;
  active_lineage_id: string | null;
  active_revision_id: string | null;
  lineage_fact_count: number;
  checkpoint_pointer_count: number;
  checkpoint_pointer_lineage_id: string | null;
  checkpoint_pointer_revision_id: string | null;
  checkpoint_pointer_hash: string | null;
  state_pointer_count: number;
  state_pointer_ref: string | null;
  state_pointer_lineage_id: string | null;
  state_pointer_revision_id: string | null;
  forecast_pointer_count: number;
  forecast_pointer_ref: string | null;
  forecast_pointer_hash: string | null;
  terminal_checkpoint_ref: string | null;
  terminal_checkpoint_hash: string | null;
  terminal_checkpoint_lineage_id: string | null;
  terminal_checkpoint_revision_id: string | null;
  terminal_checkpoint_logical_time: string | null;
  terminal_tick_sequence: number | null;
  expected_next_logical_time: string | null;
  terminal_tick_ref: string | null;
  terminal_tick_hash: string | null;
  terminal_tick_lineage_id: string | null;
  terminal_tick_revision_id: string | null;
  terminal_tick_logical_time: string | null;
  terminal_state_ref: string | null;
  terminal_state_hash: string | null;
  terminal_state_lineage_id: string | null;
  terminal_state_revision_id: string | null;
  terminal_forecast_ref: string | null;
  terminal_forecast_hash: string | null;
  terminal_forecast_lineage_id: string | null;
  terminal_forecast_revision_id: string | null;
  terminal_forecast_status: string | null;
  tick_count: number;
  state_count: number;
  forecast_count: number;
  scenario_set_count: number;
  scenario_projection_count: number;
};

export type Cap08CompletionDispositionV1 =
  | "NOT_STARTED"
  | "RESUMABLE"
  | "ALREADY_COMPLETE_EXACT"
  | "COMPLETED_BY_DIFFERENT_RUN"
  | "STALE_OR_INCONSISTENT_COMPLETION"
  | "LINEAGE_OR_REVISION_MISMATCH";

export type InspectCap08CompletionAuthorityResultV1 = {
  disposition: Cap08CompletionDispositionV1;
  authority: Cap08CompletionAuthorityV1 | null;
  graph: Cap08CompletionGraphV1 | null;
};

export type EstablishCap08CompletionAuthorityResultV1 = InspectCap08CompletionAuthorityResultV1 & {
  write_status: "INSERTED" | "EXISTING_IDEMPOTENT_SUCCESS";
};

export interface Cap08CompletionAuthorityRepositoryPortV1 {
  readAuthority(authorityRef: string): Promise<Cap08CompletionAuthorityV1 | null>;
  readAuthoritiesForScope(input: {
    run_contract_id: string;
    scope: Cap08CompletionScopeV1;
  }): Promise<Cap08CompletionAuthorityV1[]>;
  commitAuthority(authority: Cap08CompletionAuthorityV1): Promise<{
    status: "INSERTED" | "EXISTING_IDEMPOTENT_SUCCESS";
    authority: Cap08CompletionAuthorityV1;
  }>;
  inspectCompletionGraph(input: InspectCap08CompletionAuthorityInputV1): Promise<Cap08CompletionGraphV1>;
}

function requiredStringV1(value: unknown, code: string): string {
  if (typeof value !== "string" || !value.trim()) throw new Error(code);
  return value;
}

function canonicalIsoV1(value: unknown, code: string): string {
  const text = requiredStringV1(value, code);
  const parsed = Date.parse(text);
  if (!Number.isFinite(parsed) || new Date(parsed).toISOString() !== text) throw new Error(code);
  return text;
}

export function exactCap08CompletionScopeV1(scope: Cap08CompletionScopeV1): Cap08CompletionScopeV1 {
  const copy = structuredClone(scope);
  for (const field of ["tenant_id", "project_id", "group_id", "field_id", "season_id", "zone_id"] as const) {
    requiredStringV1(copy[field], `CAP08_COMPLETION_SCOPE_${field.toUpperCase()}_REQUIRED`);
  }
  return copy;
}

function positiveIntegerV1(value: unknown, code: string): number {
  if (!Number.isInteger(value) || Number(value) <= 0) throw new Error(code);
  return Number(value);
}

export function validateInspectCap08CompletionAuthorityInputV1(
  input: InspectCap08CompletionAuthorityInputV1,
): InspectCap08CompletionAuthorityInputV1 {
  const copy = structuredClone(input);
  requiredStringV1(copy.run_contract_id, "CAP08_COMPLETION_RUN_CONTRACT_ID_REQUIRED");
  requiredStringV1(copy.formal_run_id, "CAP08_COMPLETION_FORMAL_RUN_ID_REQUIRED");
  copy.scope = exactCap08CompletionScopeV1(copy.scope);
  copy.initial_logical_time = canonicalIsoV1(copy.initial_logical_time, "CAP08_COMPLETION_INITIAL_TIME_INVALID");
  copy.terminal_logical_time = canonicalIsoV1(copy.terminal_logical_time, "CAP08_COMPLETION_TERMINAL_TIME_INVALID");
  copy.expected_next_logical_time = canonicalIsoV1(copy.expected_next_logical_time, "CAP08_COMPLETION_NEXT_TIME_INVALID");
  if (Date.parse(copy.terminal_logical_time) < Date.parse(copy.initial_logical_time)) throw new Error("CAP08_COMPLETION_TIME_RANGE_INVALID");
  if (Date.parse(copy.expected_next_logical_time) <= Date.parse(copy.terminal_logical_time)) throw new Error("CAP08_COMPLETION_NEXT_TIME_INVALID");
  for (const [field, value] of [
    ["phase_engine_contract_digest", copy.phase_engine_contract_digest],
    ["phase_engine_source_digest", copy.phase_engine_source_digest],
  ] as const) {
    if (!/^sha256:[0-9a-f]{64}$/.test(requiredStringV1(value, `CAP08_COMPLETION_${field.toUpperCase()}_INVALID`))) {
      throw new Error(`CAP08_COMPLETION_${field.toUpperCase()}_INVALID`);
    }
  }
  copy.expected_tick_count = positiveIntegerV1(copy.expected_tick_count, "CAP08_COMPLETION_EXPECTED_TICK_COUNT_INVALID");
  copy.expected_state_count = positiveIntegerV1(copy.expected_state_count, "CAP08_COMPLETION_EXPECTED_STATE_COUNT_INVALID");
  copy.expected_forecast_count = positiveIntegerV1(copy.expected_forecast_count, "CAP08_COMPLETION_EXPECTED_FORECAST_COUNT_INVALID");
  copy.expected_scenario_set_count = positiveIntegerV1(copy.expected_scenario_set_count, "CAP08_COMPLETION_EXPECTED_SCENARIO_COUNT_INVALID");
  return copy;
}

export function cap08CompletionAuthorityStorageRefV1(input: {
  run_contract_id: string;
  scope: Cap08CompletionScopeV1;
}): string {
  const runContractId = requiredStringV1(input.run_contract_id, "CAP08_COMPLETION_RUN_CONTRACT_ID_REQUIRED");
  const scope = exactCap08CompletionScopeV1(input.scope);
  return deriveSemanticObjectIdV1("cap08_completion_authority", { run_contract_id: runContractId, scope });
}

export function buildCap08CompletionAuthorityV1(input: {
  inspection: InspectCap08CompletionAuthorityInputV1;
  graph: Cap08CompletionGraphV1;
}): Cap08CompletionAuthorityV1 {
  const inspection = validateInspectCap08CompletionAuthorityInputV1(input.inspection);
  const graph = structuredClone(input.graph);
  const authorityRef = cap08CompletionAuthorityStorageRefV1(inspection);
  const requiredGraphStrings: Array<[unknown, string]> = [
    [graph.active_lineage_id, "CAP08_COMPLETION_GRAPH_LINEAGE_ID_REQUIRED"],
    [graph.active_revision_id, "CAP08_COMPLETION_GRAPH_REVISION_ID_REQUIRED"],
    [graph.terminal_tick_ref, "CAP08_COMPLETION_GRAPH_TERMINAL_TICK_REF_REQUIRED"],
    [graph.terminal_tick_hash, "CAP08_COMPLETION_GRAPH_TERMINAL_TICK_HASH_REQUIRED"],
    [graph.terminal_checkpoint_ref, "CAP08_COMPLETION_GRAPH_TERMINAL_CHECKPOINT_REF_REQUIRED"],
    [graph.terminal_checkpoint_hash, "CAP08_COMPLETION_GRAPH_TERMINAL_CHECKPOINT_HASH_REQUIRED"],
  ];
  for (const [value, code] of requiredGraphStrings) requiredStringV1(value, code);
  const semantic = {
    schema_version: CAP08_COMPLETION_AUTHORITY_SCHEMA_VERSION_V1,
    authority_kind: CAP08_COMPLETION_AUTHORITY_KIND_V1,
    authority_ref: authorityRef,
    run_contract_id: inspection.run_contract_id,
    formal_run_id: inspection.formal_run_id,
    scope: inspection.scope,
    lineage_id: graph.active_lineage_id as string,
    revision_id: graph.active_revision_id as string,
    initial_logical_time: inspection.initial_logical_time,
    terminal_logical_time: inspection.terminal_logical_time,
    expected_next_logical_time: inspection.expected_next_logical_time,
    terminal_tick_ref: graph.terminal_tick_ref as string,
    terminal_tick_hash: graph.terminal_tick_hash as string,
    terminal_checkpoint_ref: graph.terminal_checkpoint_ref as string,
    terminal_checkpoint_hash: graph.terminal_checkpoint_hash as string,
    phase_engine_contract_digest: inspection.phase_engine_contract_digest,
    phase_engine_source_digest: inspection.phase_engine_source_digest,
    expected_tick_count: inspection.expected_tick_count,
    expected_state_count: inspection.expected_state_count,
    expected_forecast_count: inspection.expected_forecast_count,
    expected_scenario_set_count: inspection.expected_scenario_set_count,
  };
  return { ...semantic, determinism_hash: semanticHashV1(semantic) };
}

export function sameCap08CompletionScopeV1(
  left: Cap08CompletionScopeV1,
  right: Cap08CompletionScopeV1,
): boolean {
  return ["tenant_id", "project_id", "group_id", "field_id", "season_id", "zone_id"]
    .every((field) => left[field as keyof Cap08CompletionScopeV1] === right[field as keyof Cap08CompletionScopeV1]);
}
