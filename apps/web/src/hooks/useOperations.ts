import React from "react";
import { fetchOperationStates, fetchProgramPortfolio, fetchTaskTrajectory, type OperationStateItemV1 } from "../api";
import { buildOperationsViewModel, type OperationsVM } from "../viewmodels/operationsViewModel";

export function useOperations(): {
  loading: boolean;
  error: string | null;
  vm: OperationsVM;
  setSelectedOperationId: (id: string) => void;
  reload: () => Promise<void>;
} {
  const [loading, setLoading] = React.useState<boolean>(true);
  const [error, setError] = React.useState<string | null>(null);
  const [operations, setOperations] = React.useState<OperationStateItemV1[]>([]);
  const [portfolio, setPortfolio] = React.useState<any[]>([]);
  const [trajectories, setTrajectories] = React.useState<Map<string, any>>(new Map());
  const [selectedOperationId, setSelectedOperationId] = React.useState<string>("");

  const reload = React.useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [opsRes, portfolioRes] = await Promise.all([
        fetchOperationStates({ limit: 200 }).catch(() => ({ ok: false, count: 0, items: [] })),
        fetchProgramPortfolio({ limit: 200 }).catch(() => []),
      ]);

      const items = Array.isArray(opsRes.items) ? opsRes.items : [];
      setOperations(items);
      setPortfolio(Array.isArray(portfolioRes) ? portfolioRes : []);
      setSelectedOperationId((prev) => (prev && items.some((x) => x.operation_id === prev) ? prev : (items[0]?.operation_id ?? "")));

      const taskIds = Array.from(new Set(items.map((x) => String(x.task_id ?? "").trim()).filter(Boolean))).slice(0, 40);
      const entries = await Promise.all(
        taskIds.map(async (taskId) => {
          const trajectory = await fetchTaskTrajectory(taskId).catch(() => null);
          return [taskId, trajectory] as const;
        }),
      );
      setTrajectories(new Map(entries));
    } catch (e: any) {
      setError(String(e?.message || e || "未知错误"));
      setOperations([]);
      setPortfolio([]);
      setTrajectories(new Map());
    } finally {
      setLoading(false);
    }
  }, []);

  React.useEffect(() => {
    void reload();
  }, [reload]);

  const vm = React.useMemo(
    () =>
      buildOperationsViewModel({
        operations,
        portfolio,
        trajectories,
        selectedId: selectedOperationId,
      }),
    [operations, portfolio, trajectories, selectedOperationId],
  );

  return {
    loading,
    error,
    vm,
    setSelectedOperationId,
    reload,
  };
}
