// MCFT-CAP-09 production GFS target progression and operational due policy.
// Pure policy only. It does not read wall clock/environment/database/provider state,
// mutate EvidenceSupplyCursor/RuntimeTickCursor, or bind/start the production runtime.
//
// Authority split:
// - target identity/progression is anchored to an explicitly supplied Formal A0;
// - provider cycle selection remains owned by the product GFS provider;
// - 70m earliest lead and 60s retry interval are GEOX operational policy promoted here;
// - T-30 latest safe start and max 3 attempts preserve previously qualified hardening.

export const MCFT_CAP09_PRODUCTION_GFS_TARGET_DUE_POLICY_ID_V1 =
  "MCFT_CAP09_PRODUCTION_GFS_TARGET_DUE_POLICY_V1" as const;
export const MCFT_CAP09_PRODUCTION_GFS_TARGET_DUE_AUTHORITY_REF_V1 =
  "docs/digital_twin/mcft/cap_09/GEOX-MCFT-CAP-09-PRODUCTION-GFS-TARGET-DUE-READINESS-V1.json" as const;

export const MCFT_CAP09_GFS_SUBSEQUENT_EARLIEST_START_LEAD_MINUTES_V1 = 70 as const;
export const MCFT_CAP09_GFS_LATEST_SAFE_START_LEAD_MINUTES_V1 = 30 as const;
export const MCFT_CAP09_GFS_MAX_ATTEMPTS_PER_TARGET_WINDOW_V1 = 3 as const;
export const MCFT_CAP09_GFS_RETRY_MINIMUM_INTERVAL_SECONDS_V1 = 60 as const;

export type ProductionGfsTargetProgressV1 = {
  paired_valid_from: string;
};

export type ProductionGfsTargetDueDecisionV1 =
  | {
      policy_id: typeof MCFT_CAP09_PRODUCTION_GFS_TARGET_DUE_POLICY_ID_V1;
      status: "NOT_DUE";
      target_logical_time: string;
      due_window_start: string;
      due_window_end_exclusive: string;
      authority_ref: typeof MCFT_CAP09_PRODUCTION_GFS_TARGET_DUE_AUTHORITY_REF_V1;
      max_attempts_per_target_window: 3;
      retry_minimum_interval_seconds: 60;
    }
  | {
      policy_id: typeof MCFT_CAP09_PRODUCTION_GFS_TARGET_DUE_POLICY_ID_V1;
      status: "DUE";
      target_logical_time: string;
      requested_at: string;
      due_window_start: string;
      due_window_end_exclusive: string;
      authority_ref: typeof MCFT_CAP09_PRODUCTION_GFS_TARGET_DUE_AUTHORITY_REF_V1;
      max_attempts_per_target_window: 3;
      retry_minimum_interval_seconds: 60;
    }
  | {
      policy_id: typeof MCFT_CAP09_PRODUCTION_GFS_TARGET_DUE_POLICY_ID_V1;
      status: "MISSED_WINDOW";
      target_logical_time: string;
      due_window_start: string;
      due_window_end_exclusive: string;
      authority_ref: typeof MCFT_CAP09_PRODUCTION_GFS_TARGET_DUE_AUTHORITY_REF_V1;
      max_attempts_per_target_window: 3;
      retry_minimum_interval_seconds: 60;
    };

function isoV1(value: unknown, code: string): string {
  if (typeof value !== "string" || !value.trim()) throw new Error(code);
  const parsed = Date.parse(value);
  if (!Number.isFinite(parsed) || new Date(parsed).toISOString() !== value) throw new Error(code);
  return value;
}
function hourV1(value: unknown, code: string): string {
  const text = isoV1(value, code);
  if (!text.endsWith(":00:00.000Z")) throw new Error(code);
  return text;
}
function addMinutesV1(value: string, minutes: number): string {
  return new Date(Date.parse(value) + minutes * 60_000).toISOString();
}
function addHoursV1(value: string, hours: number): string {
  return new Date(Date.parse(value) + hours * 3_600_000).toISOString();
}

export function nextProductionGfsTargetLogicalTimeV1(input: {
  formal_a0_logical_time: string;
  durable_paired_targets: readonly ProductionGfsTargetProgressV1[];
}): string {
  const a0 = hourV1(
    input.formal_a0_logical_time,
    "PRODUCTION_GFS_TARGET_DUE_FORMAL_A0_INVALID",
  );
  const targets = [...new Set(input.durable_paired_targets.map((item) =>
    hourV1(item.paired_valid_from, "PRODUCTION_GFS_TARGET_DUE_PROGRESS_TARGET_INVALID")
  ))]
    .filter((target) => Date.parse(target) >= Date.parse(a0))
    .sort((left, right) => Date.parse(left) - Date.parse(right));

  let expected = a0;
  for (const target of targets) {
    if (Date.parse(target) < Date.parse(expected)) continue;
    if (target !== expected) {
      throw new Error(
        "PRODUCTION_GFS_TARGET_DUE_DURABLE_PROGRESS_GAP:" + expected + ":" + target,
      );
    }
    expected = addHoursV1(expected, 1);
  }
  return expected;
}

export function evaluateProductionGfsTargetDueV1(input: {
  planning_time: string;
  activation_fence_time: string;
  formal_a0_logical_time: string;
  durable_paired_targets: readonly ProductionGfsTargetProgressV1[];
}): ProductionGfsTargetDueDecisionV1 {
  const planning = isoV1(
    input.planning_time,
    "PRODUCTION_GFS_TARGET_DUE_PLANNING_TIME_INVALID",
  );
  const fence = isoV1(
    input.activation_fence_time,
    "PRODUCTION_GFS_TARGET_DUE_ACTIVATION_FENCE_INVALID",
  );
  const a0 = hourV1(
    input.formal_a0_logical_time,
    "PRODUCTION_GFS_TARGET_DUE_FORMAL_A0_INVALID",
  );
  if (Date.parse(fence) >= Date.parse(a0)) {
    throw new Error("PRODUCTION_GFS_TARGET_DUE_ACTIVATION_FENCE_MUST_PRECEDE_A0");
  }
  if (Date.parse(planning) < Date.parse(fence)) {
    throw new Error("PRODUCTION_GFS_TARGET_DUE_PLANNING_BEFORE_ACTIVATION_FENCE");
  }

  const target = nextProductionGfsTargetLogicalTimeV1({
    formal_a0_logical_time: a0,
    durable_paired_targets: input.durable_paired_targets,
  });
  const warmStart = target === a0;
  const windowStart = warmStart
    ? fence
    : addMinutesV1(
        target,
        -MCFT_CAP09_GFS_SUBSEQUENT_EARLIEST_START_LEAD_MINUTES_V1,
      );
  const windowEnd = warmStart
    ? a0
    : addMinutesV1(
        target,
        -MCFT_CAP09_GFS_LATEST_SAFE_START_LEAD_MINUTES_V1,
      );

  const common = {
    policy_id: MCFT_CAP09_PRODUCTION_GFS_TARGET_DUE_POLICY_ID_V1,
    target_logical_time: target,
    due_window_start: windowStart,
    due_window_end_exclusive: windowEnd,
    authority_ref: MCFT_CAP09_PRODUCTION_GFS_TARGET_DUE_AUTHORITY_REF_V1,
    max_attempts_per_target_window: MCFT_CAP09_GFS_MAX_ATTEMPTS_PER_TARGET_WINDOW_V1,
    retry_minimum_interval_seconds: MCFT_CAP09_GFS_RETRY_MINIMUM_INTERVAL_SECONDS_V1,
  } as const;

  if (Date.parse(planning) < Date.parse(windowStart)) {
    return { ...common, status: "NOT_DUE" };
  }
  if (Date.parse(planning) >= Date.parse(windowEnd)) {
    return { ...common, status: "MISSED_WINDOW" };
  }
  return { ...common, status: "DUE", requested_at: planning };
}
