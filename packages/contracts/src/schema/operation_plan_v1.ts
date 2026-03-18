export type OperationPlanStatusV1 =
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
    recommendation_id?: string | null;
    recommendation_fact_id?: string | null;
    approval_request_id?: string | null;
    approval_decision?: "APPROVE" | "REJECT" | null;
    approval_decision_fact_id?: string | null;
    act_task_id?: string | null;
    receipt_fact_id?: string | null;
    status: OperationPlanStatusV1;
    created_ts: number;
    updated_ts: number;
  };
};
