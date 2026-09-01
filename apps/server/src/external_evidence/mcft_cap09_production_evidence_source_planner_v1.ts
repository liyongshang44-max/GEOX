// MCFT-CAP-09 production Evidence source-specific pure planner.
// Boundary: deterministic planning over explicit inputs only. No database/provider/network,
// wall clock, environment, retention, cursor mutation, work-item construction, host binding,
// RuntimeTickCursor, Twin state, process lifecycle, or production activation.

import type {
  EvidenceSourceSpecificProgressV1,
  GfsCyclePairProgressV1,
} from "./mcft_cap09_evidence_source_progress_v1.js";
import type {
  ProductionEvidenceAcquisitionHorizonV1,
} from "./mcft_cap09_production_evidence_acquisition_horizon_v1.js";
import {
  MCFT_CAP09_GFS_MAX_ATTEMPTS_PER_TARGET_WINDOW_V1,
  MCFT_CAP09_GFS_RETRY_MINIMUM_INTERVAL_SECONDS_V1,
} from "./mcft_cap09_production_gfs_target_due_policy_v1.js";

export const MCFT_CAP09_PRODUCTION_EVIDENCE_SOURCE_PLANNER_ID_V1 =
  "MCFT_CAP09_PRODUCTION_EVIDENCE_SOURCE_PLANNER_V1" as const;

export type ProductionEvidenceNotDueStateV1 = {
  status: "NOT_DUE";
  authority_ref: string;
  evaluated_at: string;
};

export type ProductionEvidenceDueStateV1 = {
  status: "DUE";
  authority_ref: string;
  evaluated_at: string;
  requested_at: string;
};

export type ProductionEvidenceGfsDueStateV1 =
  | ProductionEvidenceNotDueStateV1
  | (ProductionEvidenceDueStateV1 & {
      target_logical_time: string;
      due_window_start: string;
      due_window_end_exclusive: string;
      max_attempts_per_target_window: typeof MCFT_CAP09_GFS_MAX_ATTEMPTS_PER_TARGET_WINDOW_V1;
      retry_minimum_interval_seconds: typeof MCFT_CAP09_GFS_RETRY_MINIMUM_INTERVAL_SECONDS_V1;
    });

export type ProductionEvidenceSourceDueStateSetV1 = {
  kbs_raw_hourly: ProductionEvidenceNotDueStateV1 | ProductionEvidenceDueStateV1;
  gfs_bundle: ProductionEvidenceGfsDueStateV1;
  kbs_soil: ProductionEvidenceNotDueStateV1 | ProductionEvidenceDueStateV1;
};

export type ProductionEvidenceSourceDecisionV1 =
  | {
      source_family: "KBS_RAW_HOURLY" | "GFS_BUNDLE" | "KBS_SOIL";
      status: "NOT_DUE";
      reason: "EXPLICIT_NOT_DUE" | "GFS_TARGET_ALREADY_DURABLE";
      authority_ref: string;
    }
  | {
      source_family: "KBS_RAW_HOURLY" | "GFS_BUNDLE" | "KBS_SOIL";
      status: "ACTION";
      authority_ref: string;
      operation:
        | {
            kind: "KBS_RAW_HOURLY_PUBLICATION_CYCLE";
            requested_at: string;
            observed_pair_state: "ABSENT" | "PARTIAL" | "PAIRED";
            paired_contiguous_through: string | null;
            pair_skew_seconds: number | null;
            bindable_to_current_cycle_service: true;
          }
        | {
            kind: "GFS_BUNDLE_ACQUIRE";
            target_logical_time: string;
            requested_at: string;
            due_window_start: string;
            due_window_end_exclusive: string;
            max_attempts_per_target_window: typeof MCFT_CAP09_GFS_MAX_ATTEMPTS_PER_TARGET_WINDOW_V1;
            retry_minimum_interval_seconds: typeof MCFT_CAP09_GFS_RETRY_MINIMUM_INTERVAL_SECONDS_V1;
            bindable_to_current_work_item_factory: true;
          }
        | {
            kind: "GFS_PARTIAL_PAIR_REHYDRATE";
            requested_at: string;
            target_logical_time: string;
            cycle_key: string;
            cycle_issued_at: string;
            available_role: "WEATHER" | "FUTURE_ET0";
            partial_progress: GfsCyclePairProgressV1;
            due_window_start: string;
            due_window_end_exclusive: string;
            bindable_to_current_cycle_service: true;
          }
        | {
            kind: "KBS_SOIL_CURRENT_ACQUIRE";
            requested_at: string;
            latest_observed_event_time: string | null;
            bindable_to_current_work_item_factory: true;
          };
    };

export type ProductionEvidenceSourcePlanV1 = {
  planner_id: typeof MCFT_CAP09_PRODUCTION_EVIDENCE_SOURCE_PLANNER_ID_V1;
  planning_time: string;
  activation_fence_time: string;
  status: "NOT_DUE" | "ACTIONABLE";
  decisions: readonly ProductionEvidenceSourceDecisionV1[];
  blockers: readonly string[];
  action_count: number;
  blocked_capability_count: number;
  production_host_binding_authorized: false;
  database_connection_attempted: false;
  provider_request_count: 0;
  runtime_tick_cursor_access_count: 0;
};

function textV1(value: unknown, code: string): string {
  if (typeof value !== "string" || !value.trim()) throw new Error(code);
  return value.trim();
}

function isoV1(value: unknown, code: string): string {
  const text = textV1(value, code);
  const parsed = Date.parse(text);
  if (!Number.isFinite(parsed) || new Date(parsed).toISOString() !== text) {
    throw new Error(code);
  }
  return text;
}

function hourV1(value: unknown, code: string): string {
  const text = isoV1(value, code);
  if (!text.endsWith(":00:00.000Z")) throw new Error(code);
  return text;
}

function authorityRefV1(value: unknown): string {
  return textV1(value, "PRODUCTION_EVIDENCE_SOURCE_PLANNER_DUE_AUTHORITY_REF_REQUIRED");
}

function validateDueStateV1(
  state: ProductionEvidenceNotDueStateV1 | ProductionEvidenceDueStateV1,
  planningTime: string,
  activationFenceTime: string,
): void {
  authorityRefV1(state.authority_ref);
  const evaluatedAt = isoV1(
    state.evaluated_at,
    "PRODUCTION_EVIDENCE_SOURCE_PLANNER_DUE_EVALUATED_AT_INVALID",
  );
  if (Date.parse(evaluatedAt) > Date.parse(planningTime)) {
    throw new Error("PRODUCTION_EVIDENCE_SOURCE_PLANNER_DUE_EVALUATED_AFTER_PLANNING_TIME");
  }
  if (state.status === "DUE") {
    const requestedAt = isoV1(
      state.requested_at,
      "PRODUCTION_EVIDENCE_SOURCE_PLANNER_REQUESTED_AT_INVALID",
    );
    if (Date.parse(requestedAt) < Date.parse(activationFenceTime)) {
      throw new Error("PRODUCTION_EVIDENCE_SOURCE_PLANNER_REQUEST_BEFORE_ACTIVATION_FENCE");
    }
    if (Date.parse(requestedAt) > Date.parse(planningTime)) {
      throw new Error("PRODUCTION_EVIDENCE_SOURCE_PLANNER_REQUEST_AFTER_PLANNING_TIME");
    }
  }
}

function progressTargetV1(
  cycle: GfsCyclePairProgressV1,
  code: string,
): string | null {
  if (cycle.state === "PAIRED") {
    return cycle.paired_valid_from
      ? hourV1(cycle.paired_valid_from, code)
      : null;
  }
  const candidate = cycle.weather?.role_time.valid_from
    ?? cycle.future_et0?.role_time.valid_from
    ?? null;
  return candidate === null ? null : hourV1(candidate, code);
}

function latestDurableGfsTargetV1(
  cycles: readonly GfsCyclePairProgressV1[],
): string | null {
  const targets = cycles
    .filter((cycle) => cycle.state === "PAIRED")
    .map((cycle) => progressTargetV1(
      cycle,
      "PRODUCTION_EVIDENCE_SOURCE_PLANNER_GFS_PAIRED_TARGET_INVALID",
    ))
    .filter((value): value is string => value !== null);
  if (targets.length === 0) return null;
  return targets.sort((a, b) => Date.parse(b) - Date.parse(a))[0]!;
}

function partialGfsForTargetV1(
  cycles: readonly GfsCyclePairProgressV1[],
  target: string,
): GfsCyclePairProgressV1 | null {
  const matching = cycles
    .filter((cycle) => cycle.state === "PARTIAL")
    .filter((cycle) =>
      progressTargetV1(
        cycle,
        "PRODUCTION_EVIDENCE_SOURCE_PLANNER_GFS_PARTIAL_TARGET_INVALID",
      ) === target
    )
    .sort((a, b) => Date.parse(b.cycle_issued_at) - Date.parse(a.cycle_issued_at));
  return matching[0] ?? null;
}

function notDueDecisionV1(
  sourceFamily: "KBS_RAW_HOURLY" | "GFS_BUNDLE" | "KBS_SOIL",
  state: ProductionEvidenceNotDueStateV1,
): ProductionEvidenceSourceDecisionV1 {
  return {
    source_family: sourceFamily,
    status: "NOT_DUE",
    reason: "EXPLICIT_NOT_DUE",
    authority_ref: authorityRefV1(state.authority_ref),
  };
}

export function planProductionEvidenceSourcesV1(input: {
  planning_time: string;
  horizon: ProductionEvidenceAcquisitionHorizonV1;
  progress: EvidenceSourceSpecificProgressV1;
  due_state: ProductionEvidenceSourceDueStateSetV1;
}): ProductionEvidenceSourcePlanV1 {
  const planningTime = isoV1(
    input.planning_time,
    "PRODUCTION_EVIDENCE_SOURCE_PLANNER_PLANNING_TIME_INVALID",
  );
  const activationFenceTime = isoV1(
    input.horizon.activation_fence_time,
    "PRODUCTION_EVIDENCE_SOURCE_PLANNER_ACTIVATION_FENCE_INVALID",
  );
  if (Date.parse(planningTime) < Date.parse(activationFenceTime)) {
    throw new Error("PRODUCTION_EVIDENCE_SOURCE_PLANNER_BEFORE_ACTIVATION_FENCE");
  }
  if (!input.horizon.runtime_start_authority_ref.trim()) {
    throw new Error("PRODUCTION_EVIDENCE_SOURCE_PLANNER_RUNTIME_START_AUTHORITY_REQUIRED");
  }

  validateDueStateV1(input.due_state.kbs_raw_hourly, planningTime, activationFenceTime);
  validateDueStateV1(input.due_state.gfs_bundle, planningTime, activationFenceTime);
  validateDueStateV1(input.due_state.kbs_soil, planningTime, activationFenceTime);

  const decisions: ProductionEvidenceSourceDecisionV1[] = [];

  const kbsDue = input.due_state.kbs_raw_hourly;
  if (kbsDue.status === "NOT_DUE") {
    decisions.push(notDueDecisionV1("KBS_RAW_HOURLY", kbsDue));
  } else {
    const kbs = input.progress.kbs_raw_hourly;
    decisions.push({
      source_family: "KBS_RAW_HOURLY",
      status: "ACTION",
      authority_ref: authorityRefV1(kbsDue.authority_ref),
      operation: {
        kind: "KBS_RAW_HOURLY_PUBLICATION_CYCLE",
        requested_at: kbsDue.requested_at,
        observed_pair_state: kbs.state,
        paired_contiguous_through: kbs.paired_contiguous_through,
        pair_skew_seconds: kbs.pair_skew_seconds,
        bindable_to_current_cycle_service: true,
      },
    });
  }

  const gfsDue = input.due_state.gfs_bundle;
  if (gfsDue.status === "NOT_DUE") {
    decisions.push(notDueDecisionV1("GFS_BUNDLE", gfsDue));
  } else {
    const target = hourV1(
      gfsDue.target_logical_time,
      "PRODUCTION_EVIDENCE_SOURCE_PLANNER_GFS_TARGET_INVALID",
    );
    const dueWindowStart=isoV1(gfsDue.due_window_start,"PRODUCTION_EVIDENCE_SOURCE_PLANNER_GFS_DUE_WINDOW_START_INVALID");
    const dueWindowEnd=isoV1(gfsDue.due_window_end_exclusive,"PRODUCTION_EVIDENCE_SOURCE_PLANNER_GFS_DUE_WINDOW_END_INVALID");
    if(Date.parse(dueWindowStart)>=Date.parse(dueWindowEnd)) throw new Error("PRODUCTION_EVIDENCE_SOURCE_PLANNER_GFS_DUE_WINDOW_ORDER_INVALID");
    if(Date.parse(gfsDue.requested_at)<Date.parse(dueWindowStart)||Date.parse(gfsDue.requested_at)>=Date.parse(dueWindowEnd)) throw new Error("PRODUCTION_EVIDENCE_SOURCE_PLANNER_GFS_REQUEST_OUTSIDE_DUE_WINDOW");
    if(gfsDue.max_attempts_per_target_window!==MCFT_CAP09_GFS_MAX_ATTEMPTS_PER_TARGET_WINDOW_V1||gfsDue.retry_minimum_interval_seconds!==MCFT_CAP09_GFS_RETRY_MINIMUM_INTERVAL_SECONDS_V1) throw new Error("PRODUCTION_EVIDENCE_SOURCE_PLANNER_GFS_RETRY_POLICY_MISMATCH");
    const durableTarget = latestDurableGfsTargetV1(input.progress.gfs_bundle.cycles);
    if (durableTarget && Date.parse(durableTarget) >= Date.parse(target)) {
      decisions.push({
        source_family: "GFS_BUNDLE",
        status: "NOT_DUE",
        reason: "GFS_TARGET_ALREADY_DURABLE",
        authority_ref: authorityRefV1(gfsDue.authority_ref),
      });
    } else {
      const partial = partialGfsForTargetV1(input.progress.gfs_bundle.cycles, target);
      if (partial) {
        const availableRole = partial.weather ? "WEATHER" as const : "FUTURE_ET0" as const;
        decisions.push({
          source_family: "GFS_BUNDLE",
          status: "ACTION",
          authority_ref: authorityRefV1(gfsDue.authority_ref),
          operation: {
            kind: "GFS_PARTIAL_PAIR_REHYDRATE",
            requested_at: gfsDue.requested_at,
            target_logical_time: target,
            cycle_key: partial.cycle_key,
            cycle_issued_at: partial.cycle_issued_at,
            available_role: availableRole,
            partial_progress: partial,
            due_window_start: dueWindowStart,
            due_window_end_exclusive: dueWindowEnd,
            bindable_to_current_cycle_service: true,
          },
        });
      } else {
        decisions.push({
          source_family: "GFS_BUNDLE",
          status: "ACTION",
          authority_ref: authorityRefV1(gfsDue.authority_ref),
          operation: {
            kind: "GFS_BUNDLE_ACQUIRE",
            target_logical_time: target,
            requested_at: gfsDue.requested_at,
            due_window_start: dueWindowStart,
            due_window_end_exclusive: dueWindowEnd,
            max_attempts_per_target_window: gfsDue.max_attempts_per_target_window,
            retry_minimum_interval_seconds: gfsDue.retry_minimum_interval_seconds,
            bindable_to_current_work_item_factory: true,
          },
        });
      }
    }
  }

  const soilDue = input.due_state.kbs_soil;
  if (soilDue.status === "NOT_DUE") {
    decisions.push(notDueDecisionV1("KBS_SOIL", soilDue));
  } else {
    decisions.push({
      source_family: "KBS_SOIL",
      status: "ACTION",
      authority_ref: authorityRefV1(soilDue.authority_ref),
      operation: {
        kind: "KBS_SOIL_CURRENT_ACQUIRE",
        requested_at: soilDue.requested_at,
        latest_observed_event_time:
          input.progress.kbs_soil.latest?.latest_event_time ?? null,
        bindable_to_current_work_item_factory: true,
      },
    });
  }

  const blockers: string[] = [];
  const actionCount = decisions.filter((decision) => decision.status === "ACTION").length;
  const blockedCapabilityCount = 0;
  const status = actionCount > 0 ? "ACTIONABLE" as const : "NOT_DUE" as const;

  return {
    planner_id: MCFT_CAP09_PRODUCTION_EVIDENCE_SOURCE_PLANNER_ID_V1,
    planning_time: planningTime,
    activation_fence_time: activationFenceTime,
    status,
    decisions,
    blockers,
    action_count: actionCount,
    blocked_capability_count: blockedCapabilityCount,
    production_host_binding_authorized: false,
    database_connection_attempted: false,
    provider_request_count: 0,
    runtime_tick_cursor_access_count: 0,
  };
}
