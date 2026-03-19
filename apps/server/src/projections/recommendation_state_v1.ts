import type { OperationStateV1 } from "./operation_state_v1";

export type RecommendationStateV1 = {
  recommendation_id: string;
  status: string;
  approval_status: string;
  operation_plan_status: string;
  task_status: string;
  execution_status: "pending" | "executed" | "failed";
};

export function projectRecommendationStateV1(operations: OperationStateV1[]): RecommendationStateV1[] {
  const out: RecommendationStateV1[] = [];
  for (const op of operations) {
    if (!op.recommendation_id) continue;
    const execution_status = op.final_status === "SUCCESS" ? "executed" : op.final_status === "FAILED" ? "failed" : "pending";
    out.push({
      recommendation_id: op.recommendation_id,
      status: op.final_status,
      approval_status: op.approval_decision_id ? "approved" : op.approval_request_id ? "requested" : "none",
      operation_plan_status: op.dispatch_status,
      task_status: op.task_id ? "created" : "none",
      execution_status
    });
  }
  return out;
}
