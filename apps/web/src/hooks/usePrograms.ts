import React from "react";
import { fetchProgramPortfolio, fetchSchedulingConflicts, fetchSchedulingHints } from "../api";
import type { Locale } from "../lib/i18n";
import { buildProgramListPageVM, conflictLabel, defaultProgramListLocale, resolveDisplayText } from "../viewmodels/programListViewModel";

export function usePrograms(): {
  locale: Locale;
  setLocale: (next: Locale) => void;
  seasonFilter: string;
  setSeasonFilter: (next: string) => void;
  riskFilter: string;
  setRiskFilter: (next: string) => void;
  sortBy: string;
  setSortBy: (next: string) => void;
  loading: boolean;
  refresh: () => Promise<void>;
  tf: (key: string) => string;
  seasons: string[];
  grouped: Array<[string, any[]]>;
  summary: { activePrograms: number; atRiskPrograms: number; pendingActions: number; lowEfficiencyOrInsufficient: number };
  resolveText: (value: string) => string;
  conflictText: (kind: string) => string;
} {
  const [locale, setLocale] = React.useState<Locale>(() => defaultProgramListLocale());
  const [items, setItems] = React.useState<any[]>([]);
  const [conflictsByProgram, setConflictsByProgram] = React.useState<Map<string, string[]>>(new Map());
  const [priorityByProgram, setPriorityByProgram] = React.useState<Map<string, string>>(new Map());
  const [loading, setLoading] = React.useState(false);
  const [seasonFilter, setSeasonFilter] = React.useState<string>("ALL");
  const [riskFilter, setRiskFilter] = React.useState<string>("ALL");
  const [sortBy, setSortBy] = React.useState<string>("risk");

  const refresh = React.useCallback(async () => {
    setLoading(true);
    try {
      const [portfolio, conflicts, hints] = await Promise.all([
        fetchProgramPortfolio({ limit: 300 }),
        fetchSchedulingConflicts().catch(() => []),
        fetchSchedulingHints().catch(() => []),
      ]);
      setItems(portfolio);

      const nextConflicts = new Map<string, string[]>();
      for (const c of conflicts) {
        const related = Array.isArray(c?.related_program_ids) ? c.related_program_ids : [];
        for (const pid of related) {
          const key = String(pid ?? "");
          if (!key) continue;
          const list = nextConflicts.get(key) ?? [];
          list.push(String(c.kind ?? ""));
          nextConflicts.set(key, Array.from(new Set(list)));
        }
      }
      setConflictsByProgram(nextConflicts);

      const nextPriority = new Map<string, string>();
      for (const h of hints) {
        const pid = String(h?.program_id ?? "");
        if (!pid) continue;
        nextPriority.set(pid, String(h?.priority ?? "LOW").toUpperCase());
      }
      setPriorityByProgram(nextPriority);
    } finally {
      setLoading(false);
    }
  }, []);

  React.useEffect(() => { void refresh(); }, [refresh]);

  const vm = React.useMemo(() => buildProgramListPageVM({
    items,
    conflictsByProgram,
    priorityByProgram,
    seasonFilter,
    riskFilter,
    sortBy,
    locale,
  }), [items, conflictsByProgram, priorityByProgram, seasonFilter, riskFilter, sortBy, locale]);

  const resolveText = React.useCallback((value: string) => resolveDisplayText(value, vm.tf), [vm.tf]);
  const conflictText = React.useCallback((kind: string) => conflictLabel(kind, vm.tf), [vm.tf]);

  return {
    locale,
    setLocale,
    seasonFilter,
    setSeasonFilter,
    riskFilter,
    setRiskFilter,
    sortBy,
    setSortBy,
    loading,
    refresh,
    tf: vm.tf,
    seasons: vm.seasons,
    grouped: vm.grouped,
    summary: vm.summary,
    resolveText,
    conflictText,
  };
}
