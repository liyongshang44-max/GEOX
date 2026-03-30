import React from "react";
import { fetchOperationDetail, type OperationDetailResponse } from "../api/operations";
import { fetchWorkAssignmentAudit, fetchWorkAssignments, type WorkAssignmentAuditItem, type WorkAssignmentItem } from "../api/humanAssignments";

type OperationDetailWithHuman = OperationDetailResponse & {
  human_execution?: {
    mode: "device" | "human" | "hybrid";
    assignment: WorkAssignmentItem | null;
    audit: WorkAssignmentAuditItem[];
  };
};

function detectExecutionMode(detail: OperationDetailResponse | null, assignment: WorkAssignmentItem | null): "device" | "human" | "hybrid" {
  const hasDevice = Boolean(detail?.dispatch?.device_id || detail?.task?.device_id || detail?.plan?.device_id);
  const hasHuman = Boolean(assignment);
  if (hasDevice && hasHuman) return "hybrid";
  if (hasHuman) return "human";
  return "device";
}

export function useOperationDetail(operationPlanId: string): {
  loading: boolean;
  error: string | null;
  detail: OperationDetailWithHuman | null;
  reload: () => Promise<void>;
} {
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);
  const [detail, setDetail] = React.useState<OperationDetailWithHuman | null>(null);

  const load = React.useCallback(async () => {
    const id = decodeURIComponent(operationPlanId || "").trim();
    if (!id) {
      setError("缺少 operation_plan_id");
      setDetail(null);
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);
    try {
      const item = await fetchOperationDetail(id);
      if (!item) {
        setDetail(null);
        setError("未找到该作业详情");
        return;
      }

      const actTaskId = String(item?.act_task_id || item?.task?.task_id || "");
      let assignment: WorkAssignmentItem | null = null;
      let audit: WorkAssignmentAuditItem[] = [];
      if (actTaskId) {
        const assignmentRes = await fetchWorkAssignments({ act_task_id: actTaskId, limit: 1 });
        assignment = Array.isArray(assignmentRes.items) ? assignmentRes.items[0] ?? null : null;
        if (assignment?.assignment_id) {
          audit = await fetchWorkAssignmentAudit(assignment.assignment_id);
        }
      }

      setDetail({
        ...item,
        human_execution: {
          mode: detectExecutionMode(item, assignment),
          assignment,
          audit,
        },
      });
    } catch {
      setDetail(null);
      setError("作业详情加载失败，请稍后重试");
    } finally {
      setLoading(false);
    }
  }, [operationPlanId]);

  React.useEffect(() => {
    void load();
  }, [load]);

  return { loading, error, detail, reload: load };
}
