import React from "react";
import {
  fetchProgramCost,
  fetchProgramDetail,
  fetchProgramEfficiency,
  fetchProgramSla,
  fetchProgramTrajectories,
  fetchSchedulingConflicts,
} from "../api";
import { resolveLocale, t, type Locale } from "../lib/i18n";
import { buildProgramDetailDashboardVM } from "../viewmodels/programDashboardViewModel";

function conflictLabel(kind: string, tf: (k: string) => string): string {
  const k = String(kind ?? "").toUpperCase();
  if (k === "DEVICE_CONFLICT") return tf("portfolio.deviceConflict");
  if (k === "FIELD_CONFLICT") return tf("portfolio.fieldConflict");
  if (k === "PROGRAM_INTENT_CONFLICT") return tf("portfolio.intentConflict");
  return tf("common.noRecord");
}

function resolveDisplayText(value: string, tf: (k: string) => string): string {
  if (value.startsWith("program.") || value.startsWith("portfolio.") || value.startsWith("common.")) return tf(value);
  return value;
}

export function useProgramDetail(programId: string): {
  vm: ReturnType<typeof buildProgramDetailDashboardVM>;
  label: (key: string) => string;
  displayText: (value: string) => string;
} {
  const [locale] = React.useState<Locale>(() => resolveLocale());
  const label = React.useCallback((key: string) => t(locale, key), [locale]);

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
        .map((c: any) => conflictLabel(String(c?.kind ?? ""), label));
      setConflicts(Array.from(new Set(kinds)));
    }).catch(() => {
      setItem(null);
      setTrajectories([]);
      setCost(null);
      setSla(null);
      setEfficiency(null);
      setConflicts([]);
    });
  }, [programId, label]);

  const vm = React.useMemo(() => buildProgramDetailDashboardVM({
    programId,
    item,
    trajectories,
    cost,
    sla,
    efficiency,
    conflicts,
    insufficientText: label("common.insufficientData"),
    noRecordText: label("common.noRecord"),
  }), [programId, item, trajectories, cost, sla, efficiency, conflicts, label]);

  const displayText = React.useCallback((value: string) => resolveDisplayText(value, label), [label]);

  return { vm, label, displayText };
}
