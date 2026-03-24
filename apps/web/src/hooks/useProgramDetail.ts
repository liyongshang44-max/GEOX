import React from "react";
import {
  fetchProgramCost,
  fetchProgramDetail,
  fetchProgramEfficiency,
  fetchProgramSla,
  fetchProgramTrajectories,
  fetchSchedulingConflicts,
} from "../api";

export function useProgramDetail(programId: string, conflictLabel: (kind: string) => string): {
  item: any;
  trajectories: any[];
  cost: any;
  sla: any;
  efficiency: any;
  conflicts: string[];
} {
  const [item, setItem] = React.useState<any>(null);
  const [trajectories, setTrajectories] = React.useState<any[]>([]);
  const [cost, setCost] = React.useState<any>(null);
  const [sla, setSla] = React.useState<any>(null);
  const [efficiency, setEfficiency] = React.useState<any>(null);
  const [conflicts, setConflicts] = React.useState<string[]>([]);

  React.useEffect(() => {
    const id = decodeURIComponent(programId);
    if (!id) return;
    Promise.all([
      fetchProgramDetail(id).catch(() => null),
      fetchProgramTrajectories(id).catch(() => []),
      fetchProgramCost(id).catch(() => null),
      fetchProgramSla(id).catch(() => null),
      fetchProgramEfficiency(id).catch(() => null),
      fetchSchedulingConflicts().catch(() => []),
    ]).then(([detail, traj, costData, slaData, efficiencyData, conflictList]) => {
      setItem(detail);
      setTrajectories(traj);
      setCost(costData);
      setSla(slaData);
      setEfficiency(efficiencyData);
      const kinds = (Array.isArray(conflictList) ? conflictList : [])
        .filter((c: any) => Array.isArray(c?.related_program_ids) && c.related_program_ids.some((pid: unknown) => String(pid) === id))
        .map((c: any) => conflictLabel(String(c?.kind ?? "")));
      setConflicts(Array.from(new Set(kinds)));
    }).catch(() => {
      setItem(null);
      setTrajectories([]);
      setCost(null);
      setSla(null);
      setEfficiency(null);
      setConflicts([]);
    });
  }, [programId, conflictLabel]);

  return { item, trajectories, cost, sla, efficiency, conflicts };
}
