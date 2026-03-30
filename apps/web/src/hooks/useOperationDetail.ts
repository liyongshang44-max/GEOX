import React from "react";
import { fetchOperationDetail, type OperationDetailResponse } from "../api/operations";

export function useOperationDetail(operationPlanId: string): {
  loading: boolean;
  error: string | null;
  detail: OperationDetailResponse | null;
  reload: () => Promise<void>;
} {
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);
  const [detail, setDetail] = React.useState<OperationDetailResponse | null>(null);

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
      setDetail(item);
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
