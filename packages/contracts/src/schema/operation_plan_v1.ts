import type { FormalOperationSpatialScopeV1 } from "./formal_operation_spatial_scope_v1.js";

export type OperationPlanStatusV1 =
  | "DRAFT"
  | "UNBOUND"
  | "NEEDS_FIELD_BINDING"
  | "AGGREGATE_ONLY"
  | "INSUFFICIENT_CONTEXT"
  | "READ_ONLY"
  | "CREATED"
  | "APPROVED"
  | "READY"
  | "DISPATCHED"
  | "ACKED"
  | "SUCCEEDED"
  | "FAILED";

export type OperationPlanV1 = {
  type: "operation_plan_v1";
  payload: {
    tenant_id: string;
    project_id: string;
    group_id: string;
    operation_plan_id: string;
    program_id?: string | null;
    field_id?: string | null;
    spatial_scope?: FormalOperationSpatialScopeV1 | null;
    season_id?: string | null;
    recommendation_id?: string | null;
    recommendation_fact_id?: string | null;
    approval_request_id?: string | null;
    approval_decision?: "APPROVE" | "REJECT" | null; // API decision input enum; plan.status persists internal states such as APPROVED.
    approval_decision_fact_id?: string | null;
    act_task_id?: string | null;
    receipt_fact_id?: string | null;
    status: OperationPlanStatusV1;
    created_ts: number;
    updated_ts: number;
  };
};
