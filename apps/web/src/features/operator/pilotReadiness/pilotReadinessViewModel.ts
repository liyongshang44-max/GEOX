// apps/web/src/features/operator/pilotReadiness/pilotReadinessViewModel.ts
// Purpose: build H63 Pilot Readiness local metadata from frozen P53/P54 gate results.
// Boundary: no fetch, no backend endpoint, no DB read, and no write surface.

export type PilotReadinessRow = {
  label: string;
  value: string;
};

export type PilotReadinessViewModel = {
  source: "field_pilot_readiness_product_v1";
  mode: "controlled_pilot_readiness_review";
  route: "/operator/pilot";
  p53Rows: PilotReadinessRow[];
  p54Rows: PilotReadinessRow[];
  readinessRows: PilotReadinessRow[];
  capabilityRows: PilotReadinessRow[];
  traceabilityRows: PilotReadinessRow[];
  boundaryRows: PilotReadinessRow[];
  nextRows: PilotReadinessRow[];
};

const p53Rows: PilotReadinessRow[] = [
  { label: "P53 result", value: "PLAN_READY_WITH_LIMITATIONS" },
  { label: "field_pilot_plan_allowed", value: "true" },
  { label: "field_pilot_execution_allowed", value: "false" },
  { label: "p54_readiness_review_allowed", value: "true" },
  { label: "P53 meaning", value: "planning gate only" },
];

const p54Rows: PilotReadinessRow[] = [
  { label: "P54 result", value: "READY_FOR_RUNTIME_HEALTH_SERVICE_GATE_WITH_LIMITATIONS" },
  { label: "p55_runtime_health_service_gate_allowed", value: "true" },
  { label: "field_pilot_execution_allowed", value: "false" },
  { label: "real_device_deployed", value: "false" },
  { label: "production_gateway_online", value: "false" },
];

const readinessRows: PilotReadinessRow[] = [
  { label: "R1 baseline_closure_health", value: "reviewed" },
  { label: "R2 p53_closure_integrity", value: "reviewed" },
  { label: "R3 p53_acceptance_health", value: "reviewed" },
  { label: "R4 p53_plan_gate_health", value: "reviewed" },
  { label: "R5 p53_execution_forbidden_health", value: "reviewed" },
  { label: "R6 candidate_site_scope_health", value: "reviewed" },
  { label: "R7 evidence_protocol_health", value: "reviewed" },
  { label: "R8 device_gateway_readiness_plan_health", value: "reviewed" },
  { label: "R9 human_role_and_responsibility_health", value: "reviewed" },
  { label: "R10 safety_stop_and_rollback_health", value: "reviewed" },
  { label: "R11 control_to_ao_act_boundary_health", value: "reviewed" },
  { label: "R12 p55_runtime_health_service_gate_readiness", value: "reviewed" },
];

const capabilityRows: PilotReadinessRow[] = [
  { label: "Planning Gate", value: "available" },
  { label: "Readiness Review Gate", value: "available" },
  { label: "Runtime Health Service Gate", value: "allowed next" },
  { label: "Field Pilot Execution", value: "not allowed" },
  { label: "AO-ACT Task Creation", value: "not allowed" },
  { label: "Dispatch", value: "not allowed" },
  { label: "ROI", value: "not allowed" },
  { label: "Field Memory", value: "not allowed" },
  { label: "Full Runtime v1 Freeze", value: "not allowed" },
];

const traceabilityRows: PilotReadinessRow[] = [
  { label: "baseline_tag", value: "p53_field_pilot_plan_v1_closure" },
  { label: "baseline_commit", value: "567d15359bfdc8008262fea402479be6a14d5312" },
  { label: "final_tag", value: "p54_field_pilot_readiness_review_gate_v1" },
  { label: "final_commit", value: "cba5573a9aa8a50317aa1c0fd36c195a7a9d8ae2" },
  { label: "acceptance", value: "P54_FIELD_PILOT_READINESS_ACCEPTANCE.cjs" },
  { label: "assertions", value: "42 passed / 0 failed" },
];

const boundaryRows: PilotReadinessRow[] = [
  { label: "field_pilot_started", value: "false" },
  { label: "real_device_deployed", value: "false" },
  { label: "production_gateway_online", value: "false" },
  { label: "live_runtime_monitoring_active", value: "false" },
  { label: "ao_act_task_created", value: "false" },
  { label: "dispatch_enabled", value: "false" },
  { label: "execution_happened", value: "false" },
  { label: "roi_computed", value: "false" },
  { label: "field_memory_learned", value: "false" },
  { label: "full_runtime_v1_frozen", value: "false" },
  { label: "backend_contract_changed", value: "false" },
];

const nextRows: PilotReadinessRow[] = [
  { label: "Next allowed gate", value: "P55 Runtime Health Service Gate" },
  { label: "Does not mean", value: "field pilot execution" },
];

export function buildPilotReadinessViewModel(): PilotReadinessViewModel {
  return {
    source: "field_pilot_readiness_product_v1",
    mode: "controlled_pilot_readiness_review",
    route: "/operator/pilot",
    p53Rows,
    p54Rows,
    readinessRows,
    capabilityRows,
    traceabilityRows,
    boundaryRows,
    nextRows,
  };
}
