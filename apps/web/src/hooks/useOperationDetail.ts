import React from "react";
import { useQuery } from "@tanstack/react-query";
import { fetchOperationDetail, type OperationDetailResponse } from "../api/operations";

export function useOperationDetail(operationPlanId: string): {
  loading: boolean;
  error: string | null;
  detail: OperationDetailResponse | null;
  reload: () => Promise<void>;
} {
  const id = decodeURIComponent(operationPlanId || "").trim();
  const query = useQuery({
    queryKey: ["operations", "detail", id],
    queryFn: async () => {
      if (!id) {
        throw new Error("缺少 operation_plan_id");
      }
      const item = await fetchOperationDetail(id);
      if (!item) {
        throw new Error("未找到该作业详情");
      }
      return item;
    },
  });

  const reload = React.useCallback(async () => {
    await query.refetch();
  }, [query]);

  return {
    loading: query.isLoading,
    error: query.error ? String((query.error as Error).message || "作业详情加载失败，请稍后重试") : null,
    detail: query.data ?? null,
    reload,
  };
}
