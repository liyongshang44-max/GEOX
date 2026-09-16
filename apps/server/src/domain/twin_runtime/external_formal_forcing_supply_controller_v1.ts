import {
  MCFT_CAP09_FORMAL_FORCING_ACQUISITION_BUDGET_AUTHORITY_ID_V1,
  formalForcingAcquisitionStartDeadlineV1,
  type FormalForcingAcquisitionBudgetAdjudicationV1,
} from "./external_formal_forcing_acquisition_budget_v1.js";
import type { ExternalFormalForcingBaseCursorSnapshotV1 } from "../../runtime/twin_runtime/postgres_external_formal_forcing_base_continuity_repository_v1.js";

export const MCFT_CAP09_FORMAL_FORCING_SUPPLY_CONTROLLER_ID_V1 =
  "FORMAL_FORCING_SUPPLY_CONTROLLER_V1" as const;

export const MCFT_CAP09_FORMAL_FORCING_ACQUISITION_START_DEADLINE_MISSED_V1 =
  "FORMAL_FORCING_ACQUISITION_START_DEADLINE_MISSED" as const;

export type ExternalFormalForcingSupplyControllerDecisionV1 =
  | {
      controller_id: typeof MCFT_CAP09_FORMAL_FORCING_SUPPLY_CONTROLLER_ID_V1;
      status: "NO_WORK";
      reason: "FORCING_BASE_WINDOW_COMPLETE";
      target_source: "DURABLE_FORCING_CURSOR_NEXT_MISSING_REQUIRED_BASE";
      wall_clock_rounding_target_used: false;
    }
  | {
      controller_id: typeof MCFT_CAP09_FORMAL_FORCING_SUPPLY_CONTROLLER_ID_V1;
      status: "ACQUIRE_NEXT_MISSING_BASE";
      base_target_t: string;
      acquisition_start_deadline: string;
      physical_visibility_deadline: string;
      selected_budget_ms: number;
      database_now: string;
      target_source: "DURABLE_FORCING_CURSOR_NEXT_MISSING_REQUIRED_BASE";
      wall_clock_rounding_target_used: false;
      arbitrary_future_base_skip_allowed: false;
    }
  | {
      controller_id: typeof MCFT_CAP09_FORMAL_FORCING_SUPPLY_CONTROLLER_ID_V1;
      status: "TERMINAL_LATE_WAKE";
      base_target_t: string;
      acquisition_start_deadline: string;
      physical_visibility_deadline: string;
      selected_budget_ms: number;
      database_now: string;
      failure_class:
        | typeof MCFT_CAP09_FORMAL_FORCING_ACQUISITION_START_DEADLINE_MISSED_V1
        | "REQUIRED_FORMAL_FORCING_BASE_DEADLINE_MISSED";
      target_source: "DURABLE_FORCING_CURSOR_NEXT_MISSING_REQUIRED_BASE";
      wall_clock_rounding_target_used: false;
      arbitrary_future_base_skip_allowed: false;
    };

function canonicalIso(value: string, code: string): string {
  if (typeof value !== "string" || !value.trim()) throw new Error(code);
  const parsed = Date.parse(value);
  if (!Number.isFinite(parsed) || new Date(parsed).toISOString() !== value) throw new Error(code);
  return value;
}

function canonicalHour(value: string, code: string): string {
  const text = canonicalIso(value, code);
  if (!text.endsWith(":00:00.000Z")) throw new Error(code);
  return text;
}

function requireQualifiedBudget(
  value: FormalForcingAcquisitionBudgetAdjudicationV1,
): FormalForcingAcquisitionBudgetAdjudicationV1 {
  if (!value || value.status !== "PASS") throw new Error("FORMAL_FORCING_CONTROLLER_QUALIFIED_BUDGET_REQUIRED");
  if (value.authority_id !== MCFT_CAP09_FORMAL_FORCING_ACQUISITION_BUDGET_AUTHORITY_ID_V1) {
    throw new Error("FORMAL_FORCING_CONTROLLER_BUDGET_AUTHORITY_MISMATCH");
  }
  if (!Number.isSafeInteger(value.selected_budget_ms) || value.selected_budget_ms <= 0) {
    throw new Error("FORMAL_FORCING_CONTROLLER_SELECTED_BUDGET_INVALID");
  }
  if (value.hardcoded_default_budget_minutes !== null) {
    throw new Error("FORMAL_FORCING_CONTROLLER_HARDCODED_DEFAULT_BUDGET_FORBIDDEN");
  }
  return value;
}

export function decideExternalFormalForcingSupplyV1(input: {
  cursor: ExternalFormalForcingBaseCursorSnapshotV1;
  database_now: string;
  qualified_budget: FormalForcingAcquisitionBudgetAdjudicationV1;
}): ExternalFormalForcingSupplyControllerDecisionV1 {
  const now = canonicalIso(input.database_now, "FORMAL_FORCING_CONTROLLER_DATABASE_NOW_INVALID");
  const budget = requireQualifiedBudget(input.qualified_budget);
  const cursor = input.cursor;
  if (!cursor || cursor.cursor_id !== "FORMAL_FORCING_BASE_CONTINUITY_CURSOR_V1") {
    throw new Error("FORMAL_FORCING_CONTROLLER_CURSOR_AUTHORITY_REQUIRED");
  }

  if (cursor.completed) {
    if (cursor.next_missing_required_base !== null) {
      throw new Error("FORMAL_FORCING_CONTROLLER_COMPLETED_CURSOR_NEXT_MISSING_FORBIDDEN");
    }
    return {
      controller_id: MCFT_CAP09_FORMAL_FORCING_SUPPLY_CONTROLLER_ID_V1,
      status: "NO_WORK",
      reason: "FORCING_BASE_WINDOW_COMPLETE",
      target_source: "DURABLE_FORCING_CURSOR_NEXT_MISSING_REQUIRED_BASE",
      wall_clock_rounding_target_used: false,
    };
  }

  if (cursor.next_missing_required_base === null) {
    throw new Error("FORMAL_FORCING_CONTROLLER_NEXT_MISSING_REQUIRED");
  }
  const base = canonicalHour(cursor.next_missing_required_base, "FORMAL_FORCING_CONTROLLER_NEXT_BASE_INVALID");
  const startDeadline = formalForcingAcquisitionStartDeadlineV1(base, budget.selected_budget_ms);
  const common = {
    controller_id: MCFT_CAP09_FORMAL_FORCING_SUPPLY_CONTROLLER_ID_V1,
    base_target_t: base,
    acquisition_start_deadline: startDeadline,
    physical_visibility_deadline: base,
    selected_budget_ms: budget.selected_budget_ms,
    database_now: now,
    target_source: "DURABLE_FORCING_CURSOR_NEXT_MISSING_REQUIRED_BASE" as const,
    wall_clock_rounding_target_used: false as const,
    arbitrary_future_base_skip_allowed: false as const,
  };

  if (Date.parse(now) >= Date.parse(base)) {
    return {
      ...common,
      status: "TERMINAL_LATE_WAKE",
      failure_class: "REQUIRED_FORMAL_FORCING_BASE_DEADLINE_MISSED",
    };
  }
  if (Date.parse(now) > Date.parse(startDeadline)) {
    return {
      ...common,
      status: "TERMINAL_LATE_WAKE",
      failure_class: MCFT_CAP09_FORMAL_FORCING_ACQUISITION_START_DEADLINE_MISSED_V1,
    };
  }
  return {
    ...common,
    status: "ACQUIRE_NEXT_MISSING_BASE",
  };
}
