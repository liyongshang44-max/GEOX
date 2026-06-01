import type { FormalOperationSpatialScopeV1 } from "./formal_operation_spatial_scope_v1.js";
import type { OperationPlanStatusV1 } from "./operation_plan_v1.js";

export type OperationPlanTransitionV1 = {
  type: "operation_plan_transition_v1";
  payload: {
    tenant_id: string;
    project_id: string;
    group_id: string;
    operation_plan_id: string;
    program_id?: string | null;
    field_id?: string | null;
    spatial_scope?: FormalOperationSpatialScopeV1 | null;
    season_id?: string | null;
    from_status: OperationPlanStatusV1 | null;
    status: OperationPlanStatusV1;
    trigger: string;
    approval_request_id?: string | null;
    decision?: "APPROVE" | "REJECT" | null; // API decision input uses APPROVE/REJECT; do not rename persisted APPROVED-like internal statuses.
    decision_fact_id?: string | null;
    act_task_id?: string | null;
    receipt_fact_id?: string | null;
    terminal_reason?: string | null;
    created_ts: number;
  };
};
