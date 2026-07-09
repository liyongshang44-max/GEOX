// apps/server/src/runtime/twin_runtime/next_tick_input_service_v1.ts
// Purpose: reconstruct the next logical tick input exclusively from persisted PostgreSQL read state and immutable Runtime authority snapshots.
// Boundary: application validation and DTO preparation only; no propagation, Forecast success, scheduler, route, web, filesystem, wall-clock, or canonical writes.

import type { CanonicalObjectEnvelopeV1 } from "../../domain/twin_runtime/canonical_object_contracts_v1.js";
import type { NextTickReadPortV1, PreparedNextTickInputV1, TwinScopeKeyV1 } from "./ports.js";

function requiredStringV1(value: unknown, code: string): string {
  if (typeof value !== "string" || !value) throw new Error(code);
  return value;
}

function requiredFiniteNumberV1(value: unknown, code: string): number {
  if (typeof value !== "number" || !Number.isFinite(value)) throw new Error(code);
  return value;
}

function exactScopeV1(object: CanonicalObjectEnvelopeV1, scope: TwinScopeKeyV1, code: string): void {
  if (object.tenant_id !== scope.tenant_id
    || object.project_id !== scope.project_id
    || object.group_id !== scope.group_id
    || object.field_id !== scope.field_id
    || object.season_id !== scope.season_id
    || object.zone_id !== scope.zone_id) throw new Error(code);
}

function exactSnapshotScopeV1(actual: TwinScopeKeyV1, expected: TwinScopeKeyV1): void {
  if (actual.tenant_id !== expected.tenant_id
    || actual.project_id !== expected.project_id
    || actual.group_id !== expected.group_id
    || actual.field_id !== expected.field_id
    || actual.season_id !== expected.season_id
    || actual.zone_id !== expected.zone_id) throw new Error("REALITY_BINDING_SCOPE_MISMATCH");
}

export class PrepareNextTickInputServiceV1 {
  constructor(private readonly reader: NextTickReadPortV1) {}

  async prepareNextTickInput(scope: TwinScopeKeyV1): Promise<PreparedNextTickInputV1> {
    const snapshot = await this.reader.readPersistedNextTickSnapshot(scope);
    if (!snapshot) throw new Error("PERSISTED_NEXT_TICK_STATE_NOT_FOUND");

    const { active_lineage_ref: activeLineageRef, checkpoint, previous_posterior: previousPosterior, runtime_config: runtimeConfig, reality_binding: realityBinding } = snapshot;
    exactScopeV1(checkpoint, scope, "CHECKPOINT_SCOPE_MISMATCH");
    exactScopeV1(previousPosterior, scope, "PREVIOUS_POSTERIOR_SCOPE_MISMATCH");
    exactScopeV1(runtimeConfig, scope, "RUNTIME_CONFIG_SCOPE_MISMATCH");
    exactSnapshotScopeV1(realityBinding.scope, scope);

    if (checkpoint.object_type !== "twin_runtime_checkpoint_v1") throw new Error("LATEST_CHECKPOINT_OBJECT_TYPE_MISMATCH");
    if (previousPosterior.object_type !== "twin_state_estimate_v1") throw new Error("LATEST_STATE_OBJECT_TYPE_MISMATCH");
    if (runtimeConfig.object_type !== "twin_runtime_config_v1") throw new Error("RUNTIME_CONFIG_OBJECT_TYPE_REQUIRED");

    const lineageId = requiredStringV1(checkpoint.lineage_id, "CHECKPOINT_LINEAGE_REQUIRED");
    if (activeLineageRef !== lineageId) throw new Error("ACTIVE_LINEAGE_CHECKPOINT_MISMATCH");
    if (previousPosterior.lineage_id !== lineageId) throw new Error("ACTIVE_LINEAGE_STATE_MISMATCH");
    if (checkpoint.revision_id !== previousPosterior.revision_id) throw new Error("CHECKPOINT_STATE_REVISION_MISMATCH");
    if (checkpoint.payload.last_posterior_state_ref !== previousPosterior.object_id) throw new Error("CHECKPOINT_PREVIOUS_POSTERIOR_REF_MISMATCH");

    const runtimeConfigRef = requiredStringV1(previousPosterior.runtime_config_ref, "STATE_RUNTIME_CONFIG_REF_REQUIRED");
    const runtimeConfigHash = requiredStringV1(previousPosterior.runtime_config_hash, "STATE_RUNTIME_CONFIG_HASH_REQUIRED");
    if (checkpoint.runtime_config_ref !== runtimeConfigRef || checkpoint.runtime_config_hash !== runtimeConfigHash) throw new Error("CHECKPOINT_STATE_RUNTIME_CONFIG_MISMATCH");
    if (runtimeConfig.object_id !== runtimeConfigRef || runtimeConfig.determinism_hash !== runtimeConfigHash) throw new Error("PERSISTED_RUNTIME_CONFIG_MISMATCH");

    const realityBindingRef = requiredStringV1(runtimeConfig.payload.reality_binding_ref, "REALITY_BINDING_REF_REQUIRED");
    const realityBindingHash = requiredStringV1(runtimeConfig.payload.reality_binding_hash, "REALITY_BINDING_HASH_REQUIRED");
    if (realityBinding.binding_id !== realityBindingRef || realityBinding.determinism_hash !== realityBindingHash) throw new Error("PERSISTED_REALITY_BINDING_MISMATCH");

    const posterior = previousPosterior.payload.posterior;
    if (!posterior || typeof posterior !== "object" || Array.isArray(posterior)) throw new Error("PREVIOUS_POSTERIOR_PAYLOAD_REQUIRED");
    const priorMean = requiredFiniteNumberV1((posterior as Record<string, unknown>).mean, "PREVIOUS_POSTERIOR_MEAN_REQUIRED");
    const priorVariance = requiredFiniteNumberV1((posterior as Record<string, unknown>).variance, "PREVIOUS_POSTERIOR_VARIANCE_REQUIRED");
    if (priorVariance < 0) throw new Error("PREVIOUS_POSTERIOR_VARIANCE_INVALID");

    const nextLogicalTickTime = requiredStringV1(checkpoint.payload.next_tick_logical_time, "NEXT_LOGICAL_TICK_TIME_REQUIRED");
    const checkpointTime = Date.parse(checkpoint.logical_time);
    const nextTime = Date.parse(nextLogicalTickTime);
    if (!Number.isFinite(checkpointTime) || !Number.isFinite(nextTime) || nextTime - checkpointTime !== 60 * 60 * 1000) throw new Error("NEXT_LOGICAL_TICK_TIME_INVALID");

    return {
      ...scope,
      previous_posterior_ref: previousPosterior.object_id,
      previous_checkpoint_ref: checkpoint.object_id,
      lineage_id: lineageId,
      prior_mean: priorMean,
      prior_variance: priorVariance,
      next_logical_tick_time: nextLogicalTickTime,
      runtime_config_ref: runtimeConfigRef,
      runtime_config_hash: runtimeConfigHash,
      reality_binding_ref: realityBindingRef,
      reality_binding_hash: realityBindingHash,
    };
  }
}
