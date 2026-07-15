// apps/server/src/runtime/twin_runtime/pending_scenario_barrier_service_v1.ts
// Purpose: enforce the CAP-04 pending-Scenario recovery barrier before every genuinely new Replay tick, using the immediately previous checkpoint Forecast as the sole authority and never reselecting Future Forcing Evidence.
// Boundary: previous-Forecast B recovery plus delegation to one existing single-tick service only; no range loop, route, scheduler, current-tick Evidence selection, recommendation, decision, action, calibration, model activation, or live-field claim.

import { validateCanonicalObjectV1, type CanonicalObjectEnvelopeV1 } from "../../domain/twin_runtime/canonical_object_contracts_v1.js";
import {
  validateCap04CanonicalForecastRunPayloadV1,
  type Cap04CanonicalCompletedForecastRunPayloadV1,
  type Cap04CanonicalForecastRunPayloadV1,
} from "../../domain/twin_runtime/forecast_canonical_authority_v1.js";
import {
  CAP04_PURE_FORECAST_MATH_CONTRACT_ID_V1,
  computeCap04ForecastMathHashV1,
  validateCap04Pure72hForecastMathResultV1,
  type Cap04Pure72hForecastMathResultV1,
} from "../../domain/twin_runtime/forecast_math_contracts_v1.js";
import { executeCap04PureThreeScenarioMathV1 } from "../../domain/twin_runtime/pure_three_scenario_math_v1.js";
import type { Cap04RuntimeConfigPayloadV1 } from "../../domain/twin_runtime/forecast_scenario_runtime_config_v1.js";
import {
  DirectCap04ExecutionConfigResolverV1,
  type Cap04ExecutionConfigResolverPortV1,
} from "../../domain/twin_runtime/runtime_config_execution_view_v1.js";
import { buildCap04ScenarioSetRecordV1 } from "./scenario_set_record_builder_v1.js";
import {
  Cap04ForecastScenarioSingleTickServiceV1,
  type Cap04SingleTickPersistencePortV1,
  type ExecuteCap04SingleTickInputV1,
  type ExecuteCap04SingleTickResultV1,
} from "./forecast_scenario_single_tick_service_v1.js";
import { PrepareNextTickInputServiceV1 } from "./next_tick_input_service_v1.js";
import type { RuntimeConfigRepositoryPortV1 } from "./ports.js";

function requiredStringV1(value: unknown, code: string): string {
  if (typeof value !== "string" || !value.trim()) throw new Error(code);
  return value;
}

function canonicalForecastMathV1(forecast: CanonicalObjectEnvelopeV1): {
  payload: Cap04CanonicalCompletedForecastRunPayloadV1;
  result: Cap04Pure72hForecastMathResultV1;
} {
  if (forecast.object_type !== "twin_forecast_run_v1") throw new Error("CAP04_PENDING_B_FORECAST_OBJECT_TYPE_REQUIRED");
  const payload = forecast.payload as unknown as Cap04CanonicalForecastRunPayloadV1;
  validateCap04CanonicalForecastRunPayloadV1(payload);
  if (payload.status !== "COMPLETED" || payload.scenario_eligible !== true) throw new Error("CAP04_PENDING_B_COMPLETED_FORECAST_REQUIRED");
  const completed = payload as Cap04CanonicalCompletedForecastRunPayloadV1;
  const resultWithoutHash: Omit<Cap04Pure72hForecastMathResultV1, "forecast_math_hash"> = {
    schema_version: "geox_mcft_cap_04_pure_72h_forecast_math_result_v1",
    contract_id: CAP04_PURE_FORECAST_MATH_CONTRACT_ID_V1,
    forecast_payload: structuredClone(completed),
    point_traces: structuredClone(completed.point_traces),
    trajectory_hash: completed.trajectory_hash,
    aggregates: structuredClone(completed.aggregates),
    uncertainty_basis: structuredClone(completed.uncertainty_basis),
    limitations: structuredClone(completed.limitations),
  };
  const result: Cap04Pure72hForecastMathResultV1 = {
    ...resultWithoutHash,
    forecast_math_hash: computeCap04ForecastMathHashV1(resultWithoutHash),
  };
  validateCap04Pure72hForecastMathResultV1(result);
  return { payload: completed, result };
}

export class Cap04PendingScenarioBarrierSingleTickServiceV1 {
  constructor(
    private readonly handoffService: PrepareNextTickInputServiceV1,
    private readonly runtimeConfigRepository: RuntimeConfigRepositoryPortV1,
    private readonly persistence: Cap04SingleTickPersistencePortV1,
    private readonly inner: Cap04ForecastScenarioSingleTickServiceV1,
    private readonly executionConfigResolver: Cap04ExecutionConfigResolverPortV1 = new DirectCap04ExecutionConfigResolverV1(),
  ) {}

  private async recoverPreviousPendingScenarioV1(input: ExecuteCap04SingleTickInputV1): Promise<boolean> {
    const handoff = await this.handoffService.prepareNextTickInput(input.scope);
    if (handoff.next_logical_tick_time !== input.logical_time) return false;
    const pendingForecast = await this.persistence.detectPendingScenario(input.scope);
    if (!pendingForecast) return false;
    if (pendingForecast.object_id !== handoff.previous_forecast_result_ref
      || pendingForecast.determinism_hash !== handoff.previous_forecast_result_hash) {
      throw new Error("CAP04_PENDING_B_CHECKPOINT_FORECAST_AUTHORITY_MISMATCH");
    }
    const canonical = canonicalForecastMathV1(pendingForecast);
    const runtimeConfigRef = requiredStringV1(canonical.payload.runtime_config_ref, "CAP04_PENDING_B_RUNTIME_CONFIG_REF_REQUIRED");
    const runtimeConfigHash = requiredStringV1(canonical.payload.runtime_config_hash, "CAP04_PENDING_B_RUNTIME_CONFIG_HASH_REQUIRED");
    const runtimeConfig = await this.runtimeConfigRepository.readRuntimeConfig(runtimeConfigRef);
    if (!runtimeConfig) throw new Error("CAP04_PENDING_B_RUNTIME_CONFIG_NOT_FOUND");
    validateCanonicalObjectV1(runtimeConfig);
    if (runtimeConfig.object_id !== runtimeConfigRef || runtimeConfig.determinism_hash !== runtimeConfigHash) {
      throw new Error("CAP04_PENDING_B_RUNTIME_CONFIG_PIN_MISMATCH");
    }
    const resolvedConfig = this.executionConfigResolver.resolveExecutionConfig(runtimeConfig);
    if (resolvedConfig.source_config_ref !== runtimeConfig.object_id
      || resolvedConfig.source_config_hash !== runtimeConfig.determinism_hash) {
      throw new Error("CAP04_PENDING_B_EXECUTION_CONFIG_SOURCE_PIN_MISMATCH");
    }
    const config = resolvedConfig.payload as Cap04RuntimeConfigPayloadV1;
    const scenarioMath = executeCap04PureThreeScenarioMathV1({
      source_forecast: {
        ref: pendingForecast.object_id,
        hash: pendingForecast.determinism_hash,
        math_result: canonical.result,
      },
      runtime_config: {
        ref: runtimeConfig.object_id,
        hash: runtimeConfig.determinism_hash,
        payload: config,
      },
      forcing_window: canonical.payload.forcing_window_authority,
    });
    const candidate = buildCap04ScenarioSetRecordV1({
      source_forecast: pendingForecast,
      scenario_math_result: scenarioMath,
      created_at: pendingForecast.created_at,
    });
    const existing = await this.persistence.lookupScenarioSet(candidate.idempotency_key);
    if (existing) return false;
    const lease = await this.persistence.acquireLease({
      ...input.scope,
      lease_owner: `${input.lease_owner}:pending-b-barrier`,
      lease_duration_seconds: input.lease_duration_seconds,
    });
    const committed = await this.persistence.commitScenarioSet({
      scope: input.scope,
      lease,
      record: candidate,
      fault_injection: input.fault_injection_b,
    });
    const readback = await this.persistence.readScenarioSet(committed.record.scenario_set_id);
    if (!readback || readback.aggregate_determinism_hash !== committed.record.aggregate_determinism_hash) {
      throw new Error("CAP04_PENDING_B_BARRIER_READBACK_MISMATCH");
    }
    return true;
  }

  async executeOneTick(input: ExecuteCap04SingleTickInputV1): Promise<ExecuteCap04SingleTickResultV1> {
    await this.recoverPreviousPendingScenarioV1(input);
    return this.inner.executeOneTick(input);
  }
}
