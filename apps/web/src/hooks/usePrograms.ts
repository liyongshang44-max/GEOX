import React from "react";
import { useQuery } from "@tanstack/react-query";
import { fetchProgramPortfolio, fetchSchedulingConflicts, fetchSchedulingHints } from "../api";
import type { Locale } from "../lib/i18n";
import { buildProgramListPageVM, conflictLabel, defaultProgramListLocale, resolveDisplayText } from "../viewmodels/programListViewModel";
import { queryKeys } from "../shared/query/keys";

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
  const [seasonFilter, setSeasonFilter] = React.useState<string>("ALL");
  const [riskFilter, setRiskFilter] = React.useState<string>("ALL");
  const [sortBy, setSortBy] = React.useState<string>("risk");

  const portfolioQuery = useQuery({
    queryKey: queryKeys.programs.list(),
    queryFn: () => fetchProgramPortfolio({ limit: 300 }),
  });

  const conflictsQuery = useQuery({
    queryKey: queryKeys.programs.scheduling.conflicts(),
    queryFn: async () => fetchSchedulingConflicts().catch(() => []),
  });

  const hintsQuery = useQuery({
    queryKey: queryKeys.programs.scheduling.hints(),
    queryFn: async () => fetchSchedulingHints().catch(() => []),
  });

  const loading = portfolioQuery.isLoading || conflictsQuery.isLoading || hintsQuery.isLoading;

  const conflictsByProgram = React.useMemo(() => {
    const nextConflicts = new Map<string, string[]>();
    for (const c of conflictsQuery.data ?? []) {
      const related = Array.isArray(c?.related_program_ids) ? c.related_program_ids : [];
      for (const pid of related) {
        const key = String(pid ?? "");
        if (!key) continue;
        const list = nextConflicts.get(key) ?? [];
        list.push(String(c.kind ?? ""));
        nextConflicts.set(key, Array.from(new Set(list)));
      }
    }
    return nextConflicts;
  }, [conflictsQuery.data]);

  const priorityByProgram = React.useMemo(() => {
    const nextPriority = new Map<string, string>();
    for (const h of hintsQuery.data ?? []) {
      const pid = String(h?.program_id ?? "");
      if (!pid) continue;
      nextPriority.set(pid, String(h?.priority ?? "LOW").toUpperCase());
    }
    return nextPriority;
  }, [hintsQuery.data]);

  const vm = React.useMemo(() => buildProgramListPageVM({
    items: portfolioQuery.data ?? [],
    conflictsByProgram,
    priorityByProgram,
    seasonFilter,
    riskFilter,
    sortBy,
    locale,
  }), [portfolioQuery.data, conflictsByProgram, priorityByProgram, seasonFilter, riskFilter, sortBy, locale]);

  const resolveText = React.useCallback((value: string) => resolveDisplayText(value, vm.tf), [vm.tf]);
  const conflictText = React.useCallback((kind: string) => conflictLabel(kind, vm.tf), [vm.tf]);

  const refresh = async (): Promise<void> => {
    await Promise.all([portfolioQuery.refetch(), conflictsQuery.refetch(), hintsQuery.refetch()]);
  };

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
