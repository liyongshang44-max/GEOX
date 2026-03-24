import React from "react";
import { fetchOperationStates, fetchPrograms, fetchTaskTrajectory, type OperationStateItemV1 } from "../api";

type StatusKey = "SUCCESS" | "FAILED" | "RUNNING" | "PENDING";

function statusOf(item: OperationStateItemV1): StatusKey {
  const s = String(item.final_status ?? "").toUpperCase();
  if (s === "SUCCESS") return "SUCCESS";
  if (s === "FAILED") return "FAILED";
  if (s === "RUNNING") return "RUNNING";
  return "PENDING";
}

export function useOperations(filters: { fieldFilter: string; deviceFilter: string; statusFilter: string; programFilter: string }): {
  items: OperationStateItemV1[];
  programIds: string[];
  fieldOptions: string[];
  deviceOptions: string[];
  loading: boolean;
  selectedId: string;
  setSelectedId: (id: string) => void;
  selected: OperationStateItemV1 | null;
  trajectory: any | null;
  todayStats: {
    total: number;
    successRate: string;
    runningCount: number;
    failedCount: number;
    programCount: number;
  };
  selectedStats: {
    failedReason: string;
    durationSec: number;
    trajectoryPointCount: number;
    inFieldRatio: number;
  };
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

  const fieldOptions = React.useMemo(() => Array.from(new Set(items.map((x) => String(x.field_id ?? "")).filter(Boolean))), [items]);
  const deviceOptions = React.useMemo(() => Array.from(new Set(items.map((x) => String(x.device_id ?? "")).filter(Boolean))), [items]);

  const todayStats = React.useMemo(() => {
    const todayKey = new Date().toDateString();
    const todayItems = items.filter((x) => new Date(x.last_event_ts).toDateString() === todayKey);
    const successCount = todayItems.filter((x) => statusOf(x) === "SUCCESS").length;
    const failedCount = todayItems.filter((x) => statusOf(x) === "FAILED").length;
    const runningCount = todayItems.filter((x) => statusOf(x) === "RUNNING").length;
    const successRate = todayItems.length ? `${Math.round((successCount / todayItems.length) * 100)}%` : "0%";
    const programCount = new Set(items.map((x) => String(x.program_id ?? "")).filter(Boolean)).size;
    return { total: todayItems.length, successRate, runningCount, failedCount, programCount };
  }, [items]);

  const selectedStats = React.useMemo(() => {
    const startTs = selected?.timeline?.[0]?.ts ?? selected?.last_event_ts ?? 0;
    const endTs = selected?.timeline?.[selected.timeline.length - 1]?.ts ?? selected?.last_event_ts ?? 0;
    const failedReason = statusOf(selected ?? ({} as OperationStateItemV1)) === "FAILED" ? String(selected?.receipt_status ?? "") : "";
    const durationSec = Math.max(0, Math.round((endTs - startTs) / 1000));
    const trajectoryPointCount = Number(trajectory?.payload?.point_count ?? 0);
    const inFieldRatio = Number((selected as any)?.latest_acceptance_result?.metrics?.in_field_ratio ?? 0);
    return { failedReason, durationSec, trajectoryPointCount, inFieldRatio };
  }, [selected, trajectory]);

  return {
    items,
    programIds,
    fieldOptions,
    deviceOptions,
    loading,
    selectedId,
    setSelectedId: setSelectedIdState,
    selected,
    trajectory,
    todayStats,
    selectedStats,
    refresh,
  };
}
