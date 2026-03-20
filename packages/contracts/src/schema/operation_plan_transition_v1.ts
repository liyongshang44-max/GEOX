import type { OperationPlanStatusV1 } from "./operation_plan_v1";

export type OperationPlanTransitionV1 = {
  type: "operation_plan_transition_v1";
  payload: {
    tenant_id: string;
    project_id: string;
    group_id: string;
    operation_plan_id: string;
    program_id?: string | null;
    field_id?: string | null;
    season_id?: string | null;
    from_status: Exclude<OperationPlanStatusV1, "CREATED"> | "CREATED";
    status: OperationPlanStatusV1;
    trigger: string;
    approval_request_id?: string | null;
    decision?: "APPROVE" | "REJECT" | null;
    decision_fact_id?: string | null;
    act_task_id?: string | null;
    receipt_fact_id?: string | null;
    terminal_reason?: string | null;
    created_ts: number;
  };
};
