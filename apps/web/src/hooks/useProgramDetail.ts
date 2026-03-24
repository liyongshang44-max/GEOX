import React from "react";
import {
  fetchProgramCost,
  fetchProgramDetail,
  fetchProgramEfficiency,
  fetchProgramSla,
  fetchProgramTrajectories,
  fetchSchedulingConflicts,
} from "../api";
import {
  buildProgramDetailViewModel,
  missingDataExplanation,
  type ProgramDetailViewModel,
} from "../viewmodels/programDetailViewModel";

function conflictLabel(kind: string): string {
  const normalized = String(kind ?? "").toUpperCase();
  if (normalized === "DEVICE_CONFLICT") return "设备冲突";
  if (normalized === "FIELD_CONFLICT") return "地块冲突";
  if (normalized === "PROGRAM_INTENT_CONFLICT") return "策略冲突";
  return "未知冲突";
}

export function useProgramDetail(programId: string): {
  loading: boolean;
  error: string | null;
  viewModel: ProgramDetailViewModel | null;
} {
  const [loading, setLoading] = React.useState<boolean>(true);
  const [error, setError] = React.useState<string | null>(null);

  const [item, setItem] = React.useState<any>(null);
  const [trajectories, setTrajectories] = React.useState<any[]>([]);
  const [cost, setCost] = React.useState<any>(null);
  const [sla, setSla] = React.useState<any>(null);
  const [efficiency, setEfficiency] = React.useState<any>(null);
  const [conflicts, setConflicts] = React.useState<string[]>([]);

  React.useEffect(() => {
    let active = true;
    const id = decodeURIComponent(programId || "").trim();
    if (!id) {
      setLoading(false);
      setError("缺少 Program ID");
      return;
    }

    setLoading(true);
    setError(null);

    Promise.all([
      fetchProgramDetail(id).catch(() => null),
      fetchProgramTrajectories(id).catch(() => []),
      fetchProgramCost(id).catch(() => null),
      fetchProgramSla(id).catch(() => null),
      fetchProgramEfficiency(id).catch(() => null),
      fetchSchedulingConflicts().catch(() => []),
    ])
      .then(([detail, traj, costData, slaData, efficiencyData, conflictList]) => {
        if (!active) return;

        setItem(detail);
        setTrajectories(Array.isArray(traj) ? traj : []);
        setCost(costData);
        setSla(slaData);
        setEfficiency(efficiencyData);

        const kinds = (Array.isArray(conflictList) ? conflictList : [])
          .filter((entry: any) =>
            Array.isArray(entry?.related_program_ids) &&
            entry.related_program_ids.some((pid: unknown) => String(pid) === id),
          )
          .map((entry: any) => conflictLabel(String(entry?.kind ?? "")));
        setConflicts(Array.from(new Set(kinds)));

        setLoading(false);
        if (!detail) setError(missingDataExplanation("最近执行结果", "当前作业完成后重新计算建议"));
      })
      .catch(() => {
        if (!active) return;
        setItem(null);
        setTrajectories([]);
        setCost(null);
        setSla(null);
        setEfficiency(null);
        setConflicts([]);
        setError(missingDataExplanation("最近执行结果", "当前作业完成后重新计算建议"));
        setLoading(false);
      });

    return () => {
      active = false;
    };
  }, [programId]);

  const viewModel = React.useMemo(() => {
    if (!item) return null;
    return buildProgramDetailViewModel({
      programId,
      item,
      trajectories,
      cost,
      sla,
      efficiency,
      conflicts,
    });
  }, [programId, item, trajectories, cost, sla, efficiency, conflicts]);

  return { loading, error, viewModel };
}
