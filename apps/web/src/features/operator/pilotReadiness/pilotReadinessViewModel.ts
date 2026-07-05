// apps/web/src/features/operator/pilotReadiness/pilotReadinessViewModel.ts
// Purpose: build Pilot Readiness local metadata from frozen planning and readiness gate results.
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
  { label: "Planning result", value: "PLAN_READY_WITH_LIMITATIONS" },
  { label: "Pilot plan allowed", value: "true" },
  { label: "Pilot field run allowed", value: "false" },
  { label: "Readiness review allowed", value: "true" },
  { label: "Meaning", value: "planning gate only" },
];

const p54Rows: PilotReadinessRow[] = [
  { label: "Readiness result", value: "READY_FOR_RUNTIME_HEALTH_SERVICE_GATE_WITH_LIMITATIONS" },
  { label: "Runtime health service gate allowed", value: "true" },
  { label: "Pilot field run allowed", value: "false" },
  { label: "Real device deployed", value: "false" },
  { label: "Production gateway online", value: "false" },
];

const readinessRows: PilotReadinessRow[] = [
  { label: "Baseline closure health", value: "reviewed" },
  { label: "Plan closure integrity", value: "reviewed" },
  { label: "Acceptance health", value: "reviewed" },
  { label: "Plan gate health", value: "reviewed" },
  { label: "Field run forbidden health", value: "reviewed" },
  { label: "Candidate site scope health", value: "reviewed" },
  { label: "Evidence protocol health", value: "reviewed" },
  { label: "Device gateway readiness plan health", value: "reviewed" },
  { label: "Human role and responsibility health", value: "reviewed" },
  { label: "Safety stop and rollback health", value: "reviewed" },
  { label: "Control boundary health", value: "reviewed" },
  { label: "Runtime health service gate readiness", value: "reviewed" },
];

const capabilityRows: PilotReadinessRow[] = [
  { label: "Planning Gate", value: "available" },
  { label: "Readiness Review Gate", value: "available" },
  { label: "Runtime Health Service Gate", value: "allowed next" },
  { label: "Field Pilot Execution", value: "not allowed" },
  { label: "Field Operation Task Creation", value: "not allowed" },
  { label: "Dispatch", value: "not allowed" },
  { label: "ROI", value: "not allowed" },
  { label: "Field Memory", value: "not allowed" },
  { label: "Full Runtime Freeze", value: "not allowed" },
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
  { label: "field_operation_task_created", value: "false" },
  { label: "dispatch_enabled", value: "false" },
  { label: "execution_happened", value: "false" },
  { label: "roi_computed", value: "false" },
  { label: "field_memory_learned", value: "false" },
  { label: "full_runtime_frozen", value: "false" },
  { label: "backend_contract_changed", value: "false" },
];

const nextRows: PilotReadinessRow[] = [
  { label: "Next allowed gate", value: "Runtime Health Service Gate" },
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
