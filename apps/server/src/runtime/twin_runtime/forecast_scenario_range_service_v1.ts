// apps/server/src/runtime/twin_runtime/forecast_scenario_range_service_v1.ts
// Purpose: execute one explicit bounded CAP-04 forward Replay range by repeatedly invoking the verified pending-Scenario-barrier single-tick service from persisted predecessor authority.
// Boundary: contiguous forward range orchestration only; no restart/backfill mode, route, scheduler, wall-clock logical time, duplicated State/Forecast/Scenario mathematics, recommendation, decision, action, calibration, model activation, or live-field claim.

import type {
  ExecuteCap04SingleTickInputV1,
  ExecuteCap04SingleTickResultV1,
} from "./forecast_scenario_single_tick_service_v1.js";
import type {
  PreparedNextTickInputV1,
  TwinScopeKeyV1,
} from "./ports.js";

export const MAX_CAP04_FORECAST_SCENARIO_RANGE_TICKS_V1 = 24;
export const CAP04_FORECAST_SCENARIO_TICK_INTERVAL_MS_V1 = 60 * 60 * 1000;

export type PrepareCap04RangeNextTickInputPortV1 = {
  prepareNextTickInput(scope: TwinScopeKeyV1): Promise<PreparedNextTickInputV1>;
};

export type ExecuteOneCap04ForecastScenarioTickPortV1 = {
  executeOneTick(input: ExecuteCap04SingleTickInputV1): Promise<ExecuteCap04SingleTickResultV1>;
};

export type RunCap04ForecastScenarioRangeInputV1 = {
  scope: TwinScopeKeyV1;
  to_logical_time: string;
  created_at: string;
  runtime_config_refs_by_logical_time: Readonly<Record<string, string>>;
  runtime_config_hashes_by_logical_time: Readonly<Record<string, string>>;
  authorized_future_forcing_binding_ids: readonly string[];
  crop_stage_context: ExecuteCap04SingleTickInputV1["crop_stage_context"];
  lease_owner: string;
  lease_duration_seconds: number;
};

export type RunCap04ForecastScenarioRangeResultV1 = {
  status: "COMPLETED" | "ALREADY_COMPLETE" | "BLOCKED";
  persisted_start_logical_time: string;
  requested_target_logical_time: string;
  executed_tick_count: number;
  successful_a1_tick_count: number;
  blocked_a2_tick_count: 0 | 1;
  posterior_state_count: number;
  successful_forecast_run_count: number;
  scenario_set_count: number;
  forecast_point_count: number;
  scenario_point_count: number;
  tick_results: ExecuteCap04SingleTickResultV1[];
  blocked_logical_time: string | null;
  final_handoff: PreparedNextTickInputV1;
};

function requiredCanonicalIsoV1(value: unknown, code: string): string {
  if (typeof value !== "string" || !value.trim()) throw new Error(code);
  const parsed = Date.parse(value);
  if (!Number.isFinite(parsed) || new Date(parsed).toISOString() !== value) throw new Error(code);
  return value;
}

function requiredHourAlignedIsoV1(value: unknown, code: string): string {
  const canonical = requiredCanonicalIsoV1(value, code);
  const date = new Date(canonical);
  if (date.getUTCMinutes() !== 0 || date.getUTCSeconds() !== 0 || date.getUTCMilliseconds() !== 0) {
    throw new Error(code);
  }
  return canonical;
}

function requiredPositiveIntegerV1(value: unknown, code: string): number {
  if (typeof value !== "number" || !Number.isInteger(value) || value <= 0) throw new Error(code);
  return value;
}

function requiredNonNegativeIntegerV1(value: unknown, code: string): number {
  if (typeof value !== "number" || !Number.isInteger(value) || value < 0) throw new Error(code);
  return value;
}

function requiredStringV1(value: unknown, code: string): string {
  if (typeof value !== "string" || !value.trim()) throw new Error(code);
  return value;
}

function addHoursV1(value: string, hours: number): string {
  return new Date(Date.parse(value) + hours * CAP04_FORECAST_SCENARIO_TICK_INTERVAL_MS_V1).toISOString();
}

function forecastPointCountV1(result: ExecuteCap04SingleTickResultV1): number {
  const forecast = result.a_record_set.members.find((member) => member.object_type === "twin_forecast_run_v1");
  if (!forecast) throw new Error("CAP04_RANGE_FORECAST_MEMBER_REQUIRED");
  if (!Array.isArray(forecast.payload.points)) throw new Error("CAP04_RANGE_FORECAST_POINTS_REQUIRED");
  return forecast.payload.points.length;
}

function scenarioPointCountV1(result: ExecuteCap04SingleTickResultV1): number {
  if (!result.b_record) return 0;
  const options = result.b_record.scenario_set.payload.options;
  if (!Array.isArray(options)) throw new Error("CAP04_RANGE_SCENARIO_OPTIONS_REQUIRED");
  return options.reduce((sum, option) => {
    if (!Array.isArray(option.trajectory_points)) throw new Error("CAP04_RANGE_SCENARIO_POINTS_REQUIRED");
    return sum + option.trajectory_points.length;
  }, 0);
}

function isBlockedV1(result: ExecuteCap04SingleTickResultV1): boolean {
  return result.status === "BLOCKED_INSERTED" || result.status === "EXISTING_BLOCKED_IDEMPOTENT_SUCCESS";
}

function validateCompletedTickV1(result: ExecuteCap04SingleTickResultV1): void {
  if (isBlockedV1(result)) throw new Error("CAP04_RANGE_INTERNAL_COMPLETED_TICK_BLOCKED");
  if (result.a_record_set.members.length !== 8) throw new Error("CAP04_RANGE_A1_MEMBER_COUNT_MISMATCH");
  if (!result.b_record) throw new Error("CAP04_RANGE_SUCCESSFUL_FORECAST_SCENARIO_SET_REQUIRED");
  if (forecastPointCountV1(result) !== 72) throw new Error("CAP04_RANGE_FORECAST_POINT_COUNT_MISMATCH");
  if (result.b_record.scenario_set.payload.options.length !== 3) throw new Error("CAP04_RANGE_SCENARIO_OPTION_COUNT_MISMATCH");
  if (scenarioPointCountV1(result) !== 216) throw new Error("CAP04_RANGE_SCENARIO_POINT_COUNT_MISMATCH");
}

export class Cap04ForecastScenarioRangeServiceV1 {
  constructor(
    private readonly handoffService: PrepareCap04RangeNextTickInputPortV1,
    private readonly tickService: ExecuteOneCap04ForecastScenarioTickPortV1,
  ) {}

  async runContiguousRange(
    input: RunCap04ForecastScenarioRangeInputV1,
  ): Promise<RunCap04ForecastScenarioRangeResultV1> {
    const targetLogicalTime = requiredHourAlignedIsoV1(
      input.to_logical_time,
      "CAP04_RANGE_TARGET_NOT_CANONICAL_HOUR",
    );
    requiredCanonicalIsoV1(input.created_at, "CAP04_RANGE_CREATED_AT_INVALID");
    requiredStringV1(input.lease_owner, "CAP04_RANGE_LEASE_OWNER_REQUIRED");
    requiredPositiveIntegerV1(input.lease_duration_seconds, "CAP04_RANGE_LEASE_DURATION_INVALID");
    if (!Array.isArray(input.authorized_future_forcing_binding_ids)
      || input.authorized_future_forcing_binding_ids.length === 0
      || input.authorized_future_forcing_binding_ids.some((value) => typeof value !== "string" || !value.trim())) {
      throw new Error("CAP04_RANGE_FORCING_BINDING_AUTHORITY_REQUIRED");
    }

    const initialHandoff = await this.handoffService.prepareNextTickInput(input.scope);
    const persistedStartLogicalTime = requiredHourAlignedIsoV1(
      initialHandoff.next_logical_tick_time,
      "CAP04_RANGE_PERSISTED_NEXT_TICK_NOT_CANONICAL_HOUR",
    );
    const initialSequence = requiredNonNegativeIntegerV1(
      initialHandoff.previous_tick_sequence,
      "CAP04_RANGE_INITIAL_SEQUENCE_INVALID",
    );
    const startMs = Date.parse(persistedStartLogicalTime);
    const targetMs = Date.parse(targetLogicalTime);

    if (targetMs < startMs) {
      return {
        status: "ALREADY_COMPLETE",
        persisted_start_logical_time: persistedStartLogicalTime,
        requested_target_logical_time: targetLogicalTime,
        executed_tick_count: 0,
        successful_a1_tick_count: 0,
        blocked_a2_tick_count: 0,
        posterior_state_count: 0,
        successful_forecast_run_count: 0,
        scenario_set_count: 0,
        forecast_point_count: 0,
        scenario_point_count: 0,
        tick_results: [],
        blocked_logical_time: null,
        final_handoff: initialHandoff,
      };
    }

    const intervalCount = (targetMs - startMs) / CAP04_FORECAST_SCENARIO_TICK_INTERVAL_MS_V1;
    if (!Number.isInteger(intervalCount)) throw new Error("CAP04_RANGE_TARGET_NOT_CONTIGUOUS_HOUR");
    const requestedTickCount = intervalCount + 1;
    if (requestedTickCount > MAX_CAP04_FORECAST_SCENARIO_RANGE_TICKS_V1) {
      throw new Error("CAP04_RANGE_MAX_TICKS_EXCEEDED");
    }

    const runtimeConfigRefs: string[] = [];
    const runtimeConfigHashes: string[] = [];
    for (let index = 0; index < requestedTickCount; index += 1) {
      const logicalTime = addHoursV1(persistedStartLogicalTime, index);
      runtimeConfigRefs.push(requiredStringV1(
        input.runtime_config_refs_by_logical_time[logicalTime],
        `CAP04_RANGE_RUNTIME_CONFIG_REF_REQUIRED:${logicalTime}`,
      ));
      runtimeConfigHashes.push(requiredStringV1(
        input.runtime_config_hashes_by_logical_time[logicalTime],
        `CAP04_RANGE_RUNTIME_CONFIG_HASH_REQUIRED:${logicalTime}`,
      ));
    }

    const tickResults: ExecuteCap04SingleTickResultV1[] = [];
    let expectedLogicalTime = persistedStartLogicalTime;
    let finalHandoff = initialHandoff;
    let successfulA1TickCount = 0;
    let blockedA2TickCount: 0 | 1 = 0;
    let posteriorStateCount = 0;
    let successfulForecastRunCount = 0;
    let scenarioSetCount = 0;
    let forecastPointCount = 0;
    let scenarioPointCount = 0;

    for (let index = 0; index < requestedTickCount; index += 1) {
      const result = await this.tickService.executeOneTick({
        scope: input.scope,
        logical_time: expectedLogicalTime,
        created_at: input.created_at,
        runtime_config_ref: runtimeConfigRefs[index],
        runtime_config_hash: runtimeConfigHashes[index],
        authorized_future_forcing_binding_ids: input.authorized_future_forcing_binding_ids,
        crop_stage_context: input.crop_stage_context,
        lease_owner: input.lease_owner,
        lease_duration_seconds: input.lease_duration_seconds,
      });
      const expectedNextLogicalTime = addHoursV1(expectedLogicalTime, 1);
      const expectedCommittedSequence = initialSequence + index + 1;
      if (result.next_handoff.next_logical_tick_time !== expectedNextLogicalTime) {
        throw new Error("CAP04_RANGE_NONCONTIGUOUS_COMMITTED_HANDOFF");
      }
      if (result.next_handoff.previous_tick_sequence !== expectedCommittedSequence) {
        throw new Error("CAP04_RANGE_NONCONTIGUOUS_COMMITTED_SEQUENCE");
      }

      tickResults.push(result);
      finalHandoff = result.next_handoff;
      posteriorStateCount += 1;

      if (isBlockedV1(result)) {
        if (result.b_record !== null || forecastPointCountV1(result) !== 0) {
          throw new Error("CAP04_RANGE_BLOCKED_RESULT_GRAPH_MISMATCH");
        }
        blockedA2TickCount = 1;
        return {
          status: "BLOCKED",
          persisted_start_logical_time: persistedStartLogicalTime,
          requested_target_logical_time: targetLogicalTime,
          executed_tick_count: tickResults.length,
          successful_a1_tick_count: successfulA1TickCount,
          blocked_a2_tick_count: blockedA2TickCount,
          posterior_state_count: posteriorStateCount,
          successful_forecast_run_count: successfulForecastRunCount,
          scenario_set_count: scenarioSetCount,
          forecast_point_count: forecastPointCount,
          scenario_point_count: scenarioPointCount,
          tick_results: tickResults,
          blocked_logical_time: expectedLogicalTime,
          final_handoff: finalHandoff,
        };
      }

      validateCompletedTickV1(result);
      successfulA1TickCount += 1;
      successfulForecastRunCount += 1;
      scenarioSetCount += 1;
      forecastPointCount += 72;
      scenarioPointCount += 216;
      expectedLogicalTime = expectedNextLogicalTime;
    }

    if (tickResults.length !== requestedTickCount) throw new Error("CAP04_RANGE_EXECUTED_COUNT_MISMATCH");
    if (finalHandoff.next_logical_tick_time !== addHoursV1(targetLogicalTime, 1)) {
      throw new Error("CAP04_RANGE_FINAL_HANDOFF_MISMATCH");
    }
    if (finalHandoff.previous_tick_sequence !== initialSequence + requestedTickCount) {
      throw new Error("CAP04_RANGE_FINAL_SEQUENCE_MISMATCH");
    }

    return {
      status: "COMPLETED",
      persisted_start_logical_time: persistedStartLogicalTime,
      requested_target_logical_time: targetLogicalTime,
      executed_tick_count: tickResults.length,
      successful_a1_tick_count: successfulA1TickCount,
      blocked_a2_tick_count: blockedA2TickCount,
      posterior_state_count: posteriorStateCount,
      successful_forecast_run_count: successfulForecastRunCount,
      scenario_set_count: scenarioSetCount,
      forecast_point_count: forecastPointCount,
      scenario_point_count: scenarioPointCount,
      tick_results: tickResults,
      blocked_logical_time: null,
      final_handoff: finalHandoff,
    };
  }
}
