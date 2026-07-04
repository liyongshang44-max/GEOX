// apps/web/src/features/operator/pilotReadiness/pilotReadinessViewModel.ts
// Purpose: build the H63 Pilot Readiness product ViewModel from frozen P53/P54 metadata.
// Boundary: local metadata only; no backend, database, telemetry, control, dispatch, ROI, Field Memory, or model writes.

export type PilotKeyValue = { label: string; value: string };
export type PilotReadinessProductViewModel = {
  source: "field_pilot_readiness_product_v1";
  mode: "controlled_pilot_readiness_review";
  route: "/operator/pilot";
  p53Rows: PilotKeyValue[];
  p54Rows: PilotKeyValue[];
  gateRows: PilotKeyValue[];
  planSections: PilotKeyValue[];
  readinessDimensions: PilotKeyValue[];
  capabilityRows: PilotKeyValue[];
  traceabilityRows: PilotKeyValue[];
  nextGateRows: PilotKeyValue[];
  nonclaims: PilotKeyValue[];
  boundaryLines: string[];
};

const p53Rows: PilotKeyValue[] = [
  { label: "phase", value: "P53 Field Pilot Plan Gate" },
  { label: "field_pilot_plan_result", value: "PLAN_READY_WITH_LIMITATIONS" },
  { label: "field_pilot_plan_allowed", value: "true" },
  { label: "field_pilot_execution_allowed", value: "false" },
  { label: "p54_readiness_review_allowed", value: "true" },
];

const p54Rows: PilotKeyValue[] = [
  { label: "phase", value: "P54 Field Pilot Readiness Review Gate" },
  { label: "readiness_review_result", value: "READY_FOR_RUNTIME_HEALTH_SERVICE_GATE_WITH_LIMITATIONS" },
  { label: "p55_runtime_health_service_gate_allowed", value: "true" },
  { label: "field_pilot_execution_allowed", value: "false" },
];

const gateRows: PilotKeyValue[] = [
  { label: "p55_runtime_health_service_gate_allowed", value: "true" },
  { label: "field_pilot_execution_allowed", value: "false" },
  { label: "ao_act_task_creation_allowed", value: "false" },
  { label: "dispatch_allowed", value: "false" },
  { label: "roi_allowed", value: "false" },
  { label: "field_memory_allowed", value: "false" },
  { label: "full_runtime_v1_freeze_allowed", value: "false" },
];

const planSectionLabels = ["Plan Identity", "Source Evidence Chain", "Candidate Site Scope", "Evidence Collection Protocol", "Device / Gateway Readiness Checklist", "Human Role Matrix", "Safety / Stop Rules", "Rollback Plan", "Entry Gate", "Exit Gate", "Go / No-Go Gate", "Limitation Register", "Traceability Packet", "Nonclaims Register"];
const planSections = planSectionLabels.map((label): PilotKeyValue => ({ label, value: "present" }));

const readinessDimensions = ["R1 baseline_closure_health", "R2 p53_closure_integrity", "R3 p53_acceptance_health", "R4 p53_plan_gate_health", "R5 p53_execution_forbidden_health", "R6 candidate_site_scope_health", "R7 evidence_protocol_health", "R8 device_gateway_readiness_plan_health", "R9 human_role_and_responsibility_health", "R10 safety_stop_and_rollback_health", "R11 control_to_ao_act_boundary_health", "R12 p55_runtime_health_service_gate_readiness"].map((label): PilotKeyValue => ({ label, value: "reviewed" }));

const capabilityRows: PilotKeyValue[] = [
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

const traceabilityRows: PilotKeyValue[] = [
  { label: "baseline_tag", value: "p53_field_pilot_plan_v1_closure" },
  { label: "baseline_commit", value: "567d15359bfdc8008262fea402479be6a14d5312" },
  { label: "final_tag", value: "p54_field_pilot_readiness_review_gate_v1" },
  { label: "final_commit", value: "cba5573a9aa8a50317aa1c0fd36c195a7a9d8ae2" },
  { label: "acceptance script", value: "scripts/field_pilot_readiness/P54_FIELD_PILOT_READINESS_ACCEPTANCE.cjs" },
  { label: "assertion_count", value: "42" },
  { label: "failed_assertion_count", value: "0" },
];

const nextGateRows: PilotKeyValue[] = [
  { label: "P55 Runtime Health Service Gate", value: "allowed=true" },
  { label: "doesNotMean", value: "field pilot execution" },
];

const nonclaims: PilotKeyValue[] = ["field_pilot_started=false", "real_device_deployed=false", "production_gateway_online=false", "live_runtime_monitoring_active=false", "ao_act_task_created=false", "dispatch_enabled=false", "execution_happened=false", "roi_computed=false", "field_memory_learned=false", "full_runtime_v1_frozen=false"].map((label): PilotKeyValue => ({ label, value: "false" }));
const no = "No ";
const boundaryLines = [no + "field pilot start", no + "real device deployment", no + "production gateway online claim", no + "live runtime monitoring", no + "AO-ACT task creation", no + "dispatch", no + "execution record", no + "ROI computation", no + "Field Memory write", no + "Full Runtime v1 freeze", no + "backend contract change"];

export function buildPilotReadinessViewModel(): PilotReadinessProductViewModel {
  return { source: "field_pilot_readiness_product_v1", mode: "controlled_pilot_readiness_review", route: "/operator/pilot", p53Rows, p54Rows, gateRows, planSections, readinessDimensions, capabilityRows, traceabilityRows, nextGateRows, nonclaims, boundaryLines };
}
