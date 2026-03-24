import React from "react";
import { fetchOperationStates, fetchPrograms, fetchTaskTrajectory, type OperationStateItemV1 } from "../api";

export function useOperations(filters: { fieldFilter: string; deviceFilter: string; statusFilter: string; programFilter: string }): {
  items: OperationStateItemV1[];
  programIds: string[];
  loading: boolean;
  selectedId: string;
  setSelectedId: (id: string) => void;
  selected: OperationStateItemV1 | null;
  trajectory: any | null;
  refresh: () => Promise<void>;
} {
  const [items, setItems] = React.useState<OperationStateItemV1[]>([]);
  const [selectedId, setSelectedIdState] = React.useState<string>("");
  const [loading, setLoading] = React.useState(false);
  const [trajectory, setTrajectory] = React.useState<any | null>(null);
  const [programIds, setProgramIds] = React.useState<string[]>([]);

  const refresh = React.useCallback(async () => {
    setLoading(true);
    try {
      const [res, programs] = await Promise.all([
        fetchOperationStates({
          limit: 200,
          field_id: filters.fieldFilter || undefined,
          device_id: filters.deviceFilter || undefined,
          final_status: filters.statusFilter || undefined,
        }),
        fetchPrograms({ limit: 200 }),
      ]);
      let next = Array.isArray(res.items) ? res.items : [];
      if (filters.programFilter) next = next.filter((x) => String(x.program_id ?? "") === filters.programFilter);
      setProgramIds(Array.from(new Set((programs ?? []).map((p: any) => String(p.program_id ?? "")).filter(Boolean))));
      setItems(next);
      setSelectedIdState((prev) => (prev && next.some((x) => x.operation_id === prev) ? prev : (next[0]?.operation_id ?? "")));
    } finally {
      setLoading(false);
    }
  }, [filters]);

  React.useEffect(() => { void refresh(); }, [refresh]);

  const selected = React.useMemo(() => items.find((x) => x.operation_id === selectedId) ?? null, [items, selectedId]);
  React.useEffect(() => {
    const taskId = String(selected?.task_id ?? "").trim();
    if (!taskId) { setTrajectory(null); return; }
    fetchTaskTrajectory(taskId).then(setTrajectory).catch(() => setTrajectory(null));
  }, [selected?.task_id]);

  return {
    items,
    programIds,
    loading,
    selectedId,
    setSelectedId: setSelectedIdState,
    selected,
    trajectory,
    refresh,
  };
}
