import { resolveLocale, t, type Locale } from "../lib/i18n";
import { buildProgramListCards, riskSortRank, type ProgramListCardVM } from "./programDashboardViewModel";

export function resolveDisplayText(value: string, tf: (k: string) => string): string {
  if (value.startsWith("program.") || value.startsWith("portfolio.") || value.startsWith("common.")) return tf(value);
  return value;
}

export function conflictLabel(kind: string, tf: (k: string) => string): string {
  const k = String(kind ?? "").toUpperCase();
  if (k === "DEVICE_CONFLICT") return tf("portfolio.deviceConflict");
  if (k === "FIELD_CONFLICT") return tf("portfolio.fieldConflict");
  if (k === "PROGRAM_INTENT_CONFLICT") return tf("portfolio.intentConflict");
  return k || tf("common.none");
}

export function sortProgramCards(cards: ProgramListCardVM[], sortBy: string): ProgramListCardVM[] {
  if (sortBy === "risk") return [...cards].sort((a, b) => a.sortRiskRank - b.sortRiskRank);
  if (sortBy === "priority") return [...cards].sort((a, b) => a.sortPriorityRank - b.sortPriorityRank);
  if (sortBy === "sla") return [...cards].sort((a, b) => a.sortSlaRank - b.sortSlaRank);
  if (sortBy === "cost") {
    return [...cards].sort((a, b) => {
      if (a.sortCostValue == null && b.sortCostValue == null) return 0;
      if (a.sortCostValue == null) return 1;
      if (b.sortCostValue == null) return -1;
      return b.sortCostValue - a.sortCostValue;
    });
  }
  if (sortBy === "efficiency") {
    return [...cards].sort((a, b) => {
      if (a.sortEfficiencyValue == null && b.sortEfficiencyValue == null) return 0;
      if (a.sortEfficiencyValue == null) return 1;
      if (b.sortEfficiencyValue == null) return -1;
      return b.sortEfficiencyValue - a.sortEfficiencyValue;
    });
  }
  return cards;
}

export function groupProgramCards(cards: ProgramListCardVM[]): Array<[string, ProgramListCardVM[]]> {
  const bySeason = new Map<string, ProgramListCardVM[]>();
  for (const card of cards) {
    const list = bySeason.get(card.seasonId) ?? [];
    list.push(card);
    bySeason.set(card.seasonId, list);
  }
  return Array.from(bySeason.entries()).sort((a, b) => b[0].localeCompare(a[0]));
}

export function buildProgramListPageVM(args: {
  items: any[];
  conflictsByProgram: Map<string, string[]>;
  priorityByProgram: Map<string, string>;
  seasonFilter: string;
  riskFilter: string;
  sortBy: string;
  locale: Locale;
}): {
  tf: (key: string) => string;
  seasons: string[];
  filtered: ProgramListCardVM[];
  grouped: Array<[string, ProgramListCardVM[]]>;
  summary: { activePrograms: number; atRiskPrograms: number; pendingActions: number; lowEfficiencyOrInsufficient: number };
} {
  const tf = (key: string) => t(args.locale, key);
  const cards = buildProgramListCards({
    items: args.items,
    conflictsByProgram: args.conflictsByProgram,
    priorityByProgram: args.priorityByProgram,
    insufficientText: tf("common.insufficientData"),
    noRecordText: tf("common.noRecord"),
  });

  const filteredBySeason = cards.filter((x) => (args.seasonFilter === "ALL" ? true : x.seasonId === args.seasonFilter));
  const filteredByRisk = filteredBySeason.filter((x) => {
    if (args.riskFilter === "ALL") return true;
    if (args.riskFilter === "INSUFFICIENT_DATA") return x.sortRiskRank === 3;
    return x.sortRiskRank === riskSortRank(args.riskFilter);
  });

  const filtered = sortProgramCards(filteredByRisk, args.sortBy);
  const grouped = groupProgramCards(filtered);
  const seasons = Array.from(new Set(args.items.map((x) => String(x.season_id ?? "")).filter(Boolean))).sort();

  const summary = {
    activePrograms: filtered.length,
    atRiskPrograms: filtered.filter((x) => x.sortRiskRank <= 1).length,
    pendingActions: filtered.filter((x) => x.primaryActionText !== "当前无需新增操作").length,
    lowEfficiencyOrInsufficient: filtered.filter((x) => x.sortEfficiencyValue == null || x.sortEfficiencyValue < 0.6).length,
  };

  return { tf, seasons, filtered, grouped, summary };
}

export function defaultProgramListLocale(): Locale {
  return resolveLocale();
}
