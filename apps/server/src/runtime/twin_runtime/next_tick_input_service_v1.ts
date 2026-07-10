// apps/server/src/runtime/twin_runtime/next_tick_input_service_v1.ts
// Purpose: reconstruct the next logical tick input exclusively from persisted PostgreSQL read state and immutable Runtime authority snapshots.
// Boundary: application validation and DTO preparation only; no propagation, Forecast success, scheduler, route, web, filesystem, wall-clock, or canonical writes.

import {
  WATER_AMOUNT_SCALE_V1,
  normalizeFixedDecimalV1,
} from "../../domain/soil_water/fixed_point_water_decimal_v1.js";
import type { PreviousStorageVarianceBasisV1 } from "../../domain/soil_water/additive_process_uncertainty_budget_v1.js";
import type { CanonicalObjectEnvelopeV1 } from "../../domain/twin_runtime/canonical_object_contracts_v1.js";
import { resolvePreviousCheckpointTickSequenceV1 } from "../../domain/twin_runtime/continuation_contracts_v1.js";
import type {
  NextTickReadPortV1,
  PersistedNextTickSnapshotV1,
  PreparedNextTickInputV1,
  PreparedRestartInputV1,
  TwinScopeKeyV1,
} from "./ports.js";

function requiredStringV1(value: unknown, code: string): string {
  if (typeof value !== "string" || !value) throw new Error(code);
  return value;
}

function requiredFiniteNumberV1(value: unknown, code: string): number {
  if (typeof value !== "number" || !Number.isFinite(value)) throw new Error(code);
  return value;
}

function requiredRecordV1(value: unknown, code: string): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error(code);
  return value as Record<string, unknown>;
}

function exactScopeV1(object: CanonicalObjectEnvelopeV1, scope: TwinScopeKeyV1, code: string): void {
  if (
    object.tenant_id !== scope.tenant_id
    || object.project_id !== scope.project_id
    || object.group_id !== scope.group_id
    || object.field_id !== scope.field_id
    || object.season_id !== scope.season_id
    || object.zone_id !== scope.zone_id
  ) throw new Error(code);
}

function exactSnapshotScopeV1(actual: TwinScopeKeyV1, expected: TwinScopeKeyV1): void {
  if (
    actual.tenant_id !== expected.tenant_id
    || actual.project_id !== expected.project_id
    || actual.group_id !== expected.group_id
    || actual.field_id !== expected.field_id
    || actual.season_id !== expected.season_id
    || actual.zone_id !== expected.zone_id
  ) throw new Error("REALITY_BINDING_SCOPE_MISMATCH");
}

function previousPosteriorMomentsV1(previousPosterior: CanonicalObjectEnvelopeV1): {
  mean: number;
  variance: number;
} {
  const bootstrapPosterior = previousPosterior.payload.posterior;
  if (bootstrapPosterior && typeof bootstrapPosterior === "object" && !Array.isArray(bootstrapPosterior)) {
    const posterior = bootstrapPosterior as Record<string, unknown>;
    return {
      mean: requiredFiniteNumberV1(posterior.mean, "PREVIOUS_POSTERIOR_MEAN_REQUIRED"),
      variance: requiredFiniteNumberV1(posterior.variance, "PREVIOUS_POSTERIOR_VARIANCE_REQUIRED"),
    };
  }

  const vwc = requiredRecordV1(
    previousPosterior.payload.root_zone_vwc_fraction,
    "PREVIOUS_POSTERIOR_VWC_REQUIRED",
  );
  return {
    mean: requiredFiniteNumberV1(vwc.mean, "PREVIOUS_POSTERIOR_MEAN_REQUIRED"),
    variance: requiredFiniteNumberV1(vwc.variance, "PREVIOUS_POSTERIOR_VARIANCE_REQUIRED"),
  };
}

function persistedBootstrapStorageMeanV1(previousPosterior: CanonicalObjectEnvelopeV1): string {
  const derivedState = requiredRecordV1(
    previousPosterior.payload.derived_state,
    "PREVIOUS_BOOTSTRAP_DERIVED_STATE_REQUIRED",
  );
  const rootZoneStorage = requiredRecordV1(
    derivedState.root_zone_water_storage_mm,
    "PREVIOUS_BOOTSTRAP_STORAGE_REQUIRED",
  );
  const storageMean = requiredFiniteNumberV1(
    rootZoneStorage.mean,
    "PREVIOUS_BOOTSTRAP_STORAGE_MEAN_REQUIRED",
  );
  if (storageMean < 0) throw new Error("PREVIOUS_BOOTSTRAP_STORAGE_MEAN_NEGATIVE");
  return normalizeFixedDecimalV1(
    String(storageMean),
    WATER_AMOUNT_SCALE_V1,
    "PREVIOUS_BOOTSTRAP_STORAGE_MEAN_INVALID",
  );
}

function prepareComputationBasisV1(input: {
  previousPosterior: CanonicalObjectEnvelopeV1;
  priorVariance: number;
}): {
  previous_storage_mm_decimal: string;
  previous_variance_basis: PreviousStorageVarianceBasisV1;
} {
  const rawBasis = input.previousPosterior.payload.computation_basis;
  if (rawBasis && typeof rawBasis === "object" && !Array.isArray(rawBasis)) {
    const basis = rawBasis as Record<string, unknown>;
    const storageMean = requiredRecordV1(
      basis.storage_mean_mm_decimal,
      "PREVIOUS_STORAGE_MEAN_DECIMAL_REQUIRED",
    );
    const storageVariance = requiredRecordV1(
      basis.storage_variance_mm2_decimal,
      "PREVIOUS_STORAGE_VARIANCE_DECIMAL_REQUIRED",
    );
    const storageMeanValue = requiredStringV1(
      storageMean.value,
      "PREVIOUS_STORAGE_MEAN_DECIMAL_VALUE_REQUIRED",
    );
    const storageVarianceValue = requiredStringV1(
      storageVariance.value,
      "PREVIOUS_STORAGE_VARIANCE_DECIMAL_VALUE_REQUIRED",
    );
    return {
      previous_storage_mm_decimal: storageMeanValue,
      previous_variance_basis: {
        basis_origin: "CARRIED_FROM_PREVIOUS_CONTINUATION_STATE",
        previous_state_ref: input.previousPosterior.object_id,
        previous_storage_variance_mm2_decimal: storageVarianceValue,
      },
    };
  }

  return {
    previous_storage_mm_decimal: persistedBootstrapStorageMeanV1(input.previousPosterior),
    previous_variance_basis: {
      basis_origin: "DERIVED_FROM_MCFT_CAP_01_POSTERIOR_V1",
      source_posterior_ref: input.previousPosterior.object_id,
      source_vwc_variance: normalizeFixedDecimalV1(
        String(input.priorVariance),
        WATER_AMOUNT_SCALE_V1,
        "PREVIOUS_POSTERIOR_VARIANCE_INVALID",
      ),
    },
  };
}

function checkpointProjectionDivergenceV1(): never {
  throw new Error("CHECKPOINT_PROJECTION_DIVERGENCE");
}

export class PrepareNextTickInputServiceV1 {
  constructor(private readonly reader: NextTickReadPortV1) {}

  private prepareFromSnapshotV1(
    scope: TwinScopeKeyV1,
    snapshot: PersistedNextTickSnapshotV1,
  ): PreparedNextTickInputV1 {
    const {
      active_lineage_ref: activeLineageRef,
      active_lineage_id: persistedActiveLineageId,
      checkpoint,
      previous_posterior: previousPosterior,
      runtime_config: previousRuntimeConfig,
      reality_binding: realityBinding,
    } = snapshot;
    exactScopeV1(checkpoint, scope, "CHECKPOINT_SCOPE_MISMATCH");
    exactScopeV1(previousPosterior, scope, "PREVIOUS_POSTERIOR_SCOPE_MISMATCH");
    exactScopeV1(previousRuntimeConfig, scope, "RUNTIME_CONFIG_SCOPE_MISMATCH");
    exactSnapshotScopeV1(realityBinding.scope, scope);

    requiredStringV1(activeLineageRef, "ACTIVE_LINEAGE_REF_REQUIRED");
    if (checkpoint.object_type !== "twin_runtime_checkpoint_v1") {
      throw new Error("LATEST_CHECKPOINT_OBJECT_TYPE_MISMATCH");
    }
    if (previousPosterior.object_type !== "twin_state_estimate_v1") {
      throw new Error("LATEST_STATE_OBJECT_TYPE_MISMATCH");
    }
    if (previousRuntimeConfig.object_type !== "twin_runtime_config_v1") {
      throw new Error("RUNTIME_CONFIG_OBJECT_TYPE_REQUIRED");
    }

    const lineageId = requiredStringV1(checkpoint.lineage_id, "CHECKPOINT_LINEAGE_REQUIRED");
    const revisionId = requiredStringV1(checkpoint.revision_id, "CHECKPOINT_REVISION_REQUIRED");
    const activeLineageId = persistedActiveLineageId ?? activeLineageRef;
    if (activeLineageId !== lineageId) throw new Error("ACTIVE_LINEAGE_CHECKPOINT_MISMATCH");
    if (previousPosterior.lineage_id !== lineageId) throw new Error("ACTIVE_LINEAGE_STATE_MISMATCH");
    if (previousPosterior.revision_id !== revisionId) throw new Error("CHECKPOINT_STATE_REVISION_MISMATCH");
    if (checkpoint.payload.last_posterior_state_ref !== previousPosterior.object_id) {
      throw new Error("CHECKPOINT_PREVIOUS_POSTERIOR_REF_MISMATCH");
    }

    const previousRuntimeConfigRef = requiredStringV1(
      previousPosterior.runtime_config_ref,
      "STATE_RUNTIME_CONFIG_REF_REQUIRED",
    );
    const previousRuntimeConfigHash = requiredStringV1(
      previousPosterior.runtime_config_hash,
      "STATE_RUNTIME_CONFIG_HASH_REQUIRED",
    );
    if (
      checkpoint.runtime_config_ref !== previousRuntimeConfigRef
      || checkpoint.runtime_config_hash !== previousRuntimeConfigHash
    ) throw new Error("CHECKPOINT_STATE_RUNTIME_CONFIG_MISMATCH");
    if (
      previousRuntimeConfig.object_id !== previousRuntimeConfigRef
      || previousRuntimeConfig.determinism_hash !== previousRuntimeConfigHash
    ) throw new Error("PERSISTED_RUNTIME_CONFIG_MISMATCH");

    const realityBindingRef = requiredStringV1(
      previousRuntimeConfig.payload.reality_binding_ref,
      "REALITY_BINDING_REF_REQUIRED",
    );
    const realityBindingHash = requiredStringV1(
      previousRuntimeConfig.payload.reality_binding_hash,
      "REALITY_BINDING_HASH_REQUIRED",
    );
    if (
      realityBinding.binding_id !== realityBindingRef
      || realityBinding.determinism_hash !== realityBindingHash
    ) throw new Error("PERSISTED_REALITY_BINDING_MISMATCH");

    const moments = previousPosteriorMomentsV1(previousPosterior);
    if (moments.variance < 0) throw new Error("PREVIOUS_POSTERIOR_VARIANCE_INVALID");
    const computation = prepareComputationBasisV1({
      previousPosterior,
      priorVariance: moments.variance,
    });

    const nextLogicalTickTime = requiredStringV1(
      checkpoint.payload.next_tick_logical_time,
      "NEXT_LOGICAL_TICK_TIME_REQUIRED",
    );
    const checkpointTime = Date.parse(checkpoint.logical_time);
    const nextTime = Date.parse(nextLogicalTickTime);
    if (
      !Number.isFinite(checkpointTime)
      || !Number.isFinite(nextTime)
      || nextTime - checkpointTime !== 60 * 60 * 1000
    ) throw new Error("NEXT_LOGICAL_TICK_TIME_INVALID");

    const previousForecastResultRef = requiredStringV1(
      checkpoint.payload.forecast_result_ref,
      "PREVIOUS_FORECAST_RESULT_REF_REQUIRED",
    );
    if (checkpoint.payload.successful_forecast_ref !== null) {
      throw new Error("SUCCESSFUL_FORECAST_POINTER_UNEXPECTED");
    }

    return {
      ...scope,
      active_lineage_ref: activeLineageRef,
      previous_posterior_ref: previousPosterior.object_id,
      previous_posterior_hash: previousPosterior.determinism_hash,
      previous_checkpoint_ref: checkpoint.object_id,
      previous_checkpoint_hash: checkpoint.determinism_hash,
      previous_forecast_result_ref: previousForecastResultRef,
      latest_successful_forecast_ref: null,
      lineage_id: lineageId,
      revision_id: revisionId,
      prior_mean: moments.mean,
      prior_variance: moments.variance,
      previous_storage_mm_decimal: computation.previous_storage_mm_decimal,
      previous_variance_basis: computation.previous_variance_basis,
      previous_tick_sequence: resolvePreviousCheckpointTickSequenceV1(checkpoint),
      next_logical_tick_time: nextLogicalTickTime,
      previous_state_runtime_config_ref: previousRuntimeConfigRef,
      previous_state_runtime_config_hash: previousRuntimeConfigHash,
      reality_binding_ref: realityBindingRef,
      reality_binding_hash: realityBindingHash,
    };
  }

  async prepareNextTickInput(scope: TwinScopeKeyV1): Promise<PreparedNextTickInputV1> {
    const snapshot = await this.reader.readPersistedNextTickSnapshot(scope);
    if (!snapshot) throw new Error("PERSISTED_NEXT_TICK_STATE_NOT_FOUND");
    return this.prepareFromSnapshotV1(scope, snapshot);
  }

  async prepareNextTickInputV1(scope: TwinScopeKeyV1): Promise<PreparedNextTickInputV1> {
    return this.prepareNextTickInput(scope);
  }

  async resumeFromCheckpointV1(scope: TwinScopeKeyV1): Promise<PreparedRestartInputV1> {
    const snapshot = await this.reader.readPersistedNextTickSnapshot(scope);
    if (!snapshot) throw new Error("PERSISTED_NEXT_TICK_STATE_NOT_FOUND");
    const prepared = this.prepareFromSnapshotV1(scope, snapshot);
    const terminalTick = snapshot.last_terminal_tick;
    if (!terminalTick) checkpointProjectionDivergenceV1();

    try {
      exactScopeV1(terminalTick, scope, "CHECKPOINT_PROJECTION_DIVERGENCE");
      if (terminalTick.object_type !== "twin_runtime_tick_v1") checkpointProjectionDivergenceV1();
      if (snapshot.checkpoint.payload.last_completed_tick_ref !== terminalTick.object_id) {
        checkpointProjectionDivergenceV1();
      }
      if (
        terminalTick.lineage_id !== prepared.lineage_id
        || terminalTick.revision_id !== prepared.revision_id
        || terminalTick.logical_time !== snapshot.checkpoint.logical_time
      ) checkpointProjectionDivergenceV1();
      const terminalTime = Date.parse(terminalTick.logical_time);
      const nextTime = Date.parse(prepared.next_logical_tick_time);
      if (!Number.isFinite(terminalTime) || !Number.isFinite(nextTime) || nextTime - terminalTime !== 60 * 60 * 1000) {
        checkpointProjectionDivergenceV1();
      }
    } catch (error) {
      if (error instanceof Error && error.message === "CHECKPOINT_PROJECTION_DIVERGENCE") throw error;
      checkpointProjectionDivergenceV1();
    }

    return {
      ...prepared,
      previous_terminal_tick_ref: terminalTick.object_id,
      previous_terminal_tick_hash: terminalTick.determinism_hash,
      previous_terminal_tick_logical_time: terminalTick.logical_time,
    };
  }
}
