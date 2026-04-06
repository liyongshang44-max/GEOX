import React from "react";
import { useQuery } from "@tanstack/react-query";
import { fetchOperationStates, fetchProgramPortfolio, fetchTaskTrajectory, type OperationStateItemV1 } from "../api";
import { buildOperationsViewModel, type OperationsVM } from "../viewmodels/operationsViewModel";
import { toUserErrorMessage } from "../shared/query/errors";
import { queryKeys } from "../shared/query/keys";

export function useOperations(): {
  loading: boolean;
  error: string | null;
  vm: OperationsVM;
  setSelectedOperationId: (id: string) => void;
  reload: () => Promise<void>;
} {
  const [selectedOperationId, setSelectedOperationId] = React.useState<string>("");

  const operationsQuery = useQuery<OperationStateItemV1[]>({
    queryKey: queryKeys.operations.list(),
    queryFn: async () => {
      const opsRes = await fetchOperationStates({ limit: 200 }).catch(() => ({ ok: false, count: 0, items: [] }));
      return Array.isArray(opsRes.items) ? opsRes.items : [];
    },
  });

  const portfolioQuery = useQuery<any[]>({
    queryKey: queryKeys.programs.list(),
    queryFn: async () => fetchProgramPortfolio({ limit: 200 }).catch(() => []),
  });

  const operations = operationsQuery.data ?? [];

  React.useEffect(() => {
    if (!operations.length) return;
    setSelectedOperationId((prev) => (prev && operations.some((x) => x.operation_id === prev) ? prev : (operations[0]?.operation_id ?? "")));
  }, [operations]);

  const trajectoriesQuery = useQuery<Map<string, any>>({
    queryKey: [queryKeys.operations.all(), "trajectories", operations.map((x) => x.task_id).join("|")],
    queryFn: async () => {
      const taskIds = Array.from(new Set(operations.map((x) => String(x.task_id ?? "").trim()).filter(Boolean))).slice(0, 40);
      const entries = await Promise.all(
        taskIds.map(async (taskId) => {
          const trajectory = await fetchTaskTrajectory(taskId).catch(() => null);
          return [taskId, trajectory] as const;
        }),
      );
      return new Map(entries);
    },
    enabled: operations.length > 0,
  });

  const loading = operationsQuery.isLoading || portfolioQuery.isLoading || trajectoriesQuery.isLoading;
  const error = operationsQuery.error || portfolioQuery.error || trajectoriesQuery.error;

  const vm = React.useMemo(
    () =>
      buildOperationsViewModel({
        operations,
        portfolio: portfolioQuery.data ?? [],
        trajectories: trajectoriesQuery.data ?? new Map(),
        selectedId: selectedOperationId,
      }),
    [operations, portfolioQuery.data, trajectoriesQuery.data, selectedOperationId],
  );

  const reload = async (): Promise<void> => {
    await Promise.all([operationsQuery.refetch(), portfolioQuery.refetch(), trajectoriesQuery.refetch()]);
  };

  return {
    loading,
    error: error ? toUserErrorMessage(error, "作业数据加载失败，请稍后重试。") : null,
    vm,
    setSelectedOperationId,
    reload,
  };
}
