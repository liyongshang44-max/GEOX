// apps/web/src/api/operatorTwinClosure.ts
// Purpose: fetch the read-only H31-H45 Operator Twin demo closure projection.
// Boundary: this client only reads closure state; it must not approve, dispatch, create AO-ACT tasks, write ROI, or write Field Memory.
import { apiRequestWithPolicy } from "./client";
import { buildOperatorTwinScopeQuery, type OperatorTwinBoundaryRule, type OperatorTwinRequestScope } from "./operatorTwin";

export type OperatorTwinClosureInventoryRow = {
  source_kind: "fact" | "index" | string;
  name: string;
  available: boolean;
};

export type OperatorTwinClosureStageGroup = {
  code: string;
  label: string;
  status: "AVAILABLE" | "MISSING" | string;
  evidence_refs: string[];
  summary_text: string;
};

export type OperatorTwinClosureExecutionTail = {
  task_id?: string | null;
  receipt_id?: string | null;
  as_executed_id?: string | null;
  acceptance_result_id?: string | null;
  water_response_verification_id?: string | null;
};

export type OperatorTwinClosureResponseSummary = {
  status: string;
  before_value?: number | string | null;
  after_value?: number | string | null;
  delta_value?: number | string | null;
  write_ready: false;
  roi_write_ready: false;
  field_memory_write_ready: false;
};

export type OperatorTwinH31H45ClosureV1 = {
  version: "v1";
  surface: "OPERATOR";
  report_kind: "OPERATOR_TWIN_H31_H45_DEMO_CLOSURE";
  request_scope: OperatorTwinRequestScope & { fieldId?: string | null; field_id?: string | null };
  field_context: { field_id: string };
  source_inventory: OperatorTwinClosureInventoryRow[];
  stage_groups: OperatorTwinClosureStageGroup[];
  execution_tail: OperatorTwinClosureExecutionTail;
  response_summary: OperatorTwinClosureResponseSummary;
  boundary_rules: OperatorTwinBoundaryRule[];
};

export type OperatorTwinH31H45ClosureResponse = {
  ok: boolean;
  source: "operator_twin_h31_h45_closure_api";
  dataScope: "OFFICIAL_OPERATOR_TWIN_API";
  generated_at: string;
  writeReady: false;
  dispatchReady: false;
  approvalReady: false;
  taskCreationReady: false;
  memoryWriteReady: false;
  roiWriteReady: false;
  operator_twin_h31_h45_closure_v1: OperatorTwinH31H45ClosureV1;
};

export function normalizeOperatorTwinDemoFieldId(value: string | null | undefined): string {
  const raw = String(value ?? "").trim();
  if (!raw || raw === ":fieldId" || raw === "fieldId" || raw.startsWith(":")) return "field_c8_demo";
  return raw;
}

export async function fetchOperatorTwinH31H45Closure(
  fieldId: string,
  scope?: OperatorTwinRequestScope | null,
): Promise<OperatorTwinH31H45ClosureResponse> {
  const safeFieldId = encodeURIComponent(normalizeOperatorTwinDemoFieldId(fieldId));
  const response = await apiRequestWithPolicy<OperatorTwinH31H45ClosureResponse>(
    "/api/v1/operator/twin/fields/" + safeFieldId + "/h31-h45-closure" + buildOperatorTwinScopeQuery(scope),
    undefined,
    { dedupe: true, silent: true, timeoutMs: 10000 },
  );

  if (!response.ok || !response.data) {
    throw new Error("OPERATOR_TWIN_H31_H45_CLOSURE_API_FAILED");
  }

  return response.data;
}
