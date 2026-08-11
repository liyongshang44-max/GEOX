// apps/server/src/runtime/twin_runtime/fixed_lag_scheduler_adapter_v1.ts
// Purpose: add an explicit wall-clock eligibility lag in front of an existing SchedulerPortV1 without mutating historical scheduler semantics.
// Boundary: pure adapter composition only; no database, persistence, provider fetch, canonical write, route, timer loop, or clock acceleration.

import type {
  SchedulerPortV1,
  ShadowOnlineBoundaryV1,
  ShadowOnlineSlotClaimV1,
  ShadowOnlineTerminalSlotResultV1,
  TwinScopeKeyV1,
} from "./ports.js";

const HOUR_MS = 3_600_000;

export const FIXED_LAG_SCHEDULER_PROFILE_V1 = {
  schema_version: "geox_fixed_lag_scheduler_profile_v1",
  default_eligibility_lag_hours: 0,
  external_formal_eligibility_lag_hours: 7,
  historical_default_behavior_preserved: true,
  accelerated_clock_allowed: false,
} as const;

export type FixedLagSchedulerAdapterConfigV1 = {
  eligibility_lag_hours?: number;
  now?: () => Date;
};

function parseInstantV1(value: string, code: string): number {
  const parsed = Date.parse(value);
  if (!Number.isFinite(parsed)) throw new Error(code);
  return parsed;
}

function resolveLagHoursV1(value: number | undefined): number {
  const lag = value ?? FIXED_LAG_SCHEDULER_PROFILE_V1.default_eligibility_lag_hours;
  if (!Number.isInteger(lag) || lag < 0 || lag > 24) throw new Error("SCHEDULER_ELIGIBILITY_LAG_HOURS_INVALID");
  return lag;
}

function floorToUtcHourV1(valueMs: number): number {
  return Math.floor(valueMs / HOUR_MS) * HOUR_MS;
}

export class FixedLagSchedulerAdapterV1 implements SchedulerPortV1 {
  private readonly eligibilityLagHours: number;
  private readonly now: () => Date;

  constructor(
    private readonly inner: SchedulerPortV1,
    config: FixedLagSchedulerAdapterConfigV1 = {},
  ) {
    this.eligibilityLagHours = resolveLagHoursV1(config.eligibility_lag_hours);
    this.now = config.now ?? (() => new Date());
  }

  private wallClockNowV1(): Date {
    const value = this.now();
    if (!(value instanceof Date) || !Number.isFinite(value.getTime())) throw new Error("SCHEDULER_WALL_CLOCK_INVALID");
    return value;
  }

  private assertBoundaryEligibleV1(boundary: ShadowOnlineBoundaryV1): void {
    const logicalMs = parseInstantV1(boundary.logical_time, "BOUNDARY_LOGICAL_TIME_INVALID");
    const observedMs = parseInstantV1(boundary.scheduler_wall_clock_observed_at, "SCHEDULER_WALL_CLOCK_INVALID");
    const eligibleAtMs = logicalMs + this.eligibilityLagHours * HOUR_MS;
    if (observedMs < eligibleAtMs) throw new Error("FIXED_LAG_BOUNDARY_NOT_YET_ELIGIBLE");
  }

  async claimDueSlot(input: {
    boundary: ShadowOnlineBoundaryV1;
    lease_owner: string;
    lease_duration_seconds: number;
  }): Promise<ShadowOnlineSlotClaimV1> {
    this.assertBoundaryEligibleV1(input.boundary);
    return this.inner.claimDueSlot(input);
  }

  async listMissedSlots(input: {
    scope: TwinScopeKeyV1;
    through_logical_time: string;
  }): Promise<readonly ShadowOnlineBoundaryV1[]> {
    const requestedThroughMs = parseInstantV1(input.through_logical_time, "THROUGH_LOGICAL_TIME_INVALID");
    const now = this.wallClockNowV1();
    const eligibleThroughMs = floorToUtcHourV1(now.getTime()) - this.eligibilityLagHours * HOUR_MS;
    const effectiveThroughMs = Math.min(requestedThroughMs, eligibleThroughMs);
    const rows = await this.inner.listMissedSlots({
      scope: input.scope,
      through_logical_time: new Date(effectiveThroughMs).toISOString(),
    });
    return rows.map((boundary) => ({
      ...boundary,
      scheduler_wall_clock_observed_at: now.toISOString(),
    }));
  }

  async recordTerminalResult(input: {
    claim: ShadowOnlineSlotClaimV1;
    result: ShadowOnlineTerminalSlotResultV1;
  }): Promise<void> {
    this.assertBoundaryEligibleV1(input.claim.boundary);
    await this.inner.recordTerminalResult(input);
  }
}

export function createExternalFormalFixedLagSchedulerAdapterV1(
  inner: SchedulerPortV1,
  now?: () => Date,
): FixedLagSchedulerAdapterV1 {
  return new FixedLagSchedulerAdapterV1(inner, {
    eligibility_lag_hours: FIXED_LAG_SCHEDULER_PROFILE_V1.external_formal_eligibility_lag_hours,
    ...(now ? { now } : {}),
  });
}
