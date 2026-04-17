import type { Pool } from "pg";
import { detectSchedulingConflictsV1, type SchedulingConflictV1 } from "./conflict_detector_v1.js";
import { projectProgramPortfolioV1, type ProgramPortfolioItemV1 } from "../../projections/program_portfolio_v1.js";

type TenantTriple = { tenant_id: string; project_id: string; group_id: string };

type HintPriority = "LOW" | "MEDIUM" | "HIGH";

export type SchedulingHintV1 = {
  program_id: string;
  kind: "PRIORITIZE_PROGRAM_ACTION" | "DEFER_PROGRAM_ACTION" | "MANUAL_REVIEW_PROGRAM_INTENT";
  priority: HintPriority;
  reason: string;
  conflict_kind: SchedulingConflictV1["kind"];
  target_ref: string;
};

function priorityScore(priority: HintPriority): number {
  if (priority === "HIGH") return 3;
  if (priority === "MEDIUM") return 2;
  return 1;
}

function reliabilityScore(item: ProgramPortfolioItemV1): number {
  let score = 0;
  if (item.latest_acceptance_result === "FAILED") score += 100;
  if (item.execution_reliability === "AT_RISK") score += 30;
  if (item.execution_reliability === "OFF_TRACK") score += 50;
  if (item.water_management === "OFF_TRACK") score += 20;
  if (item.water_management === "ON_TRACK") score -= 5;
  return score;
}

function inferCurrentSeasonByField(items: ProgramPortfolioItemV1[]): Map<string, string> {
  const out = new Map<string, ProgramPortfolioItemV1>();
  for (const item of items) {
    const prev = out.get(item.field_id);
    if (!prev || item.updated_at_ts >= prev.updated_at_ts) out.set(item.field_id, item);
  }
  return new Map(Array.from(out.entries()).map(([fieldId, item]) => [fieldId, item.season_id]));
}

function fieldPriorityScore(item: ProgramPortfolioItemV1, currentSeasonByField: Map<string, string>): number {
  let score = 0;
  if (currentSeasonByField.get(item.field_id) === item.season_id) score += 50;
  if (item.status.toUpperCase() === "ACTIVE") score += 30;
  if (item.pending_operation_plan_id) score += 20;
  return score;
}

function pickBest(items: ProgramPortfolioItemV1[], scorer: (item: ProgramPortfolioItemV1) => number): ProgramPortfolioItemV1 | null {
  let best: ProgramPortfolioItemV1 | null = null;
  let bestScore = Number.NEGATIVE_INFINITY;
  for (const item of items) {
    const score = scorer(item);
    if (score > bestScore) {
      best = item;
      bestScore = score;
    }
  }
  return best;
}

function dedupeHighestPriorityHints(hints: SchedulingHintV1[]): SchedulingHintV1[] {
  const out = new Map<string, SchedulingHintV1>();
  for (const hint of hints) {
    const prev = out.get(hint.program_id);
    if (!prev || priorityScore(hint.priority) > priorityScore(prev.priority)) {
      out.set(hint.program_id, hint);
    }
  }
  return Array.from(out.values()).sort((a, b) => priorityScore(b.priority) - priorityScore(a.priority));
}

export function buildSchedulingHintsFromData(conflicts: SchedulingConflictV1[], portfolio: ProgramPortfolioItemV1[]): SchedulingHintV1[] {
  const byProgram = new Map(portfolio.map((x) => [x.program_id, x]));
  const currentSeasonByField = inferCurrentSeasonByField(portfolio);
  const hints: SchedulingHintV1[] = [];

  for (const conflict of conflicts) {
    const candidates = conflict.related_program_ids.map((id) => byProgram.get(id)).filter(Boolean) as ProgramPortfolioItemV1[];
    if (!candidates.length) continue;

    if (conflict.kind === "DEVICE_CONFLICT") {
      const selected = pickBest(candidates, reliabilityScore);
      if (!selected) continue;
      hints.push({
        program_id: selected.program_id,
        kind: "PRIORITIZE_PROGRAM_ACTION",
        priority: "HIGH",
        conflict_kind: conflict.kind,
        target_ref: conflict.target_ref,
        reason: `device conflict on ${conflict.target_ref}; prioritize by failed acceptance / reliability risk`
      });
      for (const item of candidates) {
        if (item.program_id === selected.program_id) continue;
        hints.push({
          program_id: item.program_id,
          kind: "DEFER_PROGRAM_ACTION",
          priority: "LOW",
          conflict_kind: conflict.kind,
          target_ref: conflict.target_ref,
          reason: `defer due to device conflict on ${conflict.target_ref}; lower risk than ${selected.program_id}`
        });
      }
      continue;
    }

    if (conflict.kind === "FIELD_CONFLICT") {
      const selected = pickBest(candidates, (x) => fieldPriorityScore(x, currentSeasonByField));
      if (!selected) continue;
      hints.push({
        program_id: selected.program_id,
        kind: "PRIORITIZE_PROGRAM_ACTION",
        priority: "MEDIUM",
        conflict_kind: conflict.kind,
        target_ref: conflict.target_ref,
        reason: `field conflict on ${conflict.target_ref}; prioritize current-season active program with pending plan`
      });
      for (const item of candidates) {
        if (item.program_id === selected.program_id) continue;
        hints.push({
          program_id: item.program_id,
          kind: "DEFER_PROGRAM_ACTION",
          priority: "LOW",
          conflict_kind: conflict.kind,
          target_ref: conflict.target_ref,
          reason: `defer due to field conflict on ${conflict.target_ref}; lower scheduling priority`
        });
      }
      continue;
    }

    for (const item of candidates) {
      hints.push({
        program_id: item.program_id,
        kind: "MANUAL_REVIEW_PROGRAM_INTENT",
        priority: "MEDIUM",
        conflict_kind: conflict.kind,
        target_ref: conflict.target_ref,
        reason: `conflicting program intent on ${conflict.target_ref}; review before scheduling`
      });
    }
  }

  return dedupeHighestPriorityHints(hints);
}

export async function projectSchedulingHintsV1(pool: Pool, tenant: TenantTriple): Promise<SchedulingHintV1[]> {
  const [conflicts, portfolio] = await Promise.all([
    detectSchedulingConflictsV1(pool, tenant),
    projectProgramPortfolioV1(pool, tenant)
  ]);
  return buildSchedulingHintsFromData(conflicts, portfolio);
}
