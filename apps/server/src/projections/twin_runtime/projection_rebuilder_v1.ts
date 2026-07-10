// apps/server/src/projections/twin_runtime/projection_rebuilder_v1.ts
// Purpose: derive authorized A0 and MCFT-CAP-02 continuation rebuildable projection rows from canonical facts without changing semantic payloads.
// Boundary: pure projection mapping only; no SQL, no canonical writes, no equations, no wall clock, and no action creation.

import type { CanonicalObjectEnvelopeV1 } from "../../domain/twin_runtime/canonical_object_contracts_v1.js";

export type CanonicalFactReadV1 = { fact_id: string; object: CanonicalObjectEnvelopeV1 };
export type A0ProjectionRowsV1 = {
  active_lineage: Record<string, unknown>;
  state_history: Record<string, unknown>;
  state_latest: Record<string, unknown>;
  forecast_result_latest: Record<string, unknown>;
  checkpoint_latest: Record<string, unknown>;
  runtime_health_latest: Record<string, unknown>;
};

export type ContinuationProjectionRowsV1 = {
  state_history: Record<string, unknown>;
  state_latest: Record<string, unknown>;
  forecast_result_latest: Record<string, unknown>;
  checkpoint_latest: Record<string, unknown>;
  runtime_health_latest: Record<string, unknown>;
};

function byType(facts: readonly CanonicalFactReadV1[], type: CanonicalObjectEnvelopeV1["object_type"]): CanonicalFactReadV1 {
  const matches = facts.filter((fact) => fact.object.object_type === type);
  if (matches.length !== 1) throw new Error(`EXPECTED_EXACTLY_ONE_${type}`);
  return matches[0];
}

function scope(object: CanonicalObjectEnvelopeV1) {
  return {
    tenant_id: object.tenant_id,
    project_id: object.project_id,
    group_id: object.group_id,
    field_id: object.field_id,
    season_id: object.season_id,
    zone_id: object.zone_id,
  };
}

function buildStateRowsV1(state: CanonicalFactReadV1) {
  return {
    state_history: {
      ...scope(state.object),
      state_object_id: state.object.object_id,
      lineage_id: state.object.lineage_id,
      revision_id: state.object.revision_id,
      logical_time: state.object.logical_time,
      determinism_hash: state.object.determinism_hash,
      canonical_payload: state.object,
      source_fact_id: state.fact_id,
    },
    state_latest: {
      ...scope(state.object),
      state_object_id: state.object.object_id,
      lineage_id: state.object.lineage_id,
      revision_id: state.object.revision_id,
      logical_time: state.object.logical_time,
      determinism_hash: state.object.determinism_hash,
      source_fact_id: state.fact_id,
    },
  };
}

function buildForecastRowV1(forecast: CanonicalFactReadV1) {
  return {
    ...scope(forecast.object),
    forecast_object_id: forecast.object.object_id,
    forecast_status: forecast.object.payload.status,
    logical_time: forecast.object.logical_time,
    determinism_hash: forecast.object.determinism_hash,
    source_fact_id: forecast.fact_id,
  };
}

function buildCheckpointRowV1(checkpoint: CanonicalFactReadV1) {
  return {
    ...scope(checkpoint.object),
    checkpoint_object_id: checkpoint.object.object_id,
    lineage_id: checkpoint.object.lineage_id,
    revision_id: checkpoint.object.revision_id,
    logical_time: checkpoint.object.logical_time,
    determinism_hash: checkpoint.object.determinism_hash,
    source_fact_id: checkpoint.fact_id,
  };
}

function buildHealthRowV1(health: CanonicalFactReadV1) {
  return {
    ...scope(health.object),
    health_object_id: health.object.object_id,
    operation_status: health.object.payload.operation_status,
    logical_time: health.object.logical_time,
    determinism_hash: health.object.determinism_hash,
    source_fact_id: health.fact_id,
  };
}

export function buildA0ProjectionRowsV1(facts: readonly CanonicalFactReadV1[]): A0ProjectionRowsV1 {
  const lineage = byType(facts, "twin_runtime_lineage_v1");
  const state = byType(facts, "twin_state_estimate_v1");
  const forecast = byType(facts, "twin_forecast_run_v1");
  const checkpoint = byType(facts, "twin_runtime_checkpoint_v1");
  const health = byType(facts, "twin_runtime_health_v1");
  const stateRows = buildStateRowsV1(state);
  return {
    active_lineage: {
      ...scope(lineage.object),
      active_lineage_ref: lineage.object.object_id,
      activation_authority_kind: "INITIAL_LINEAGE_DECLARATION",
      activation_authority_ref: lineage.object.object_id,
      expected_previous_active_lineage: null,
    },
    ...stateRows,
    forecast_result_latest: buildForecastRowV1(forecast),
    checkpoint_latest: buildCheckpointRowV1(checkpoint),
    runtime_health_latest: buildHealthRowV1(health),
  };
}

export function buildContinuationProjectionRowsV1(facts: readonly CanonicalFactReadV1[]): ContinuationProjectionRowsV1 {
  const state = byType(facts, "twin_state_estimate_v1");
  const forecast = byType(facts, "twin_forecast_run_v1");
  const checkpoint = byType(facts, "twin_runtime_checkpoint_v1");
  const health = byType(facts, "twin_runtime_health_v1");
  const stateRows = buildStateRowsV1(state);
  return {
    ...stateRows,
    forecast_result_latest: buildForecastRowV1(forecast),
    checkpoint_latest: buildCheckpointRowV1(checkpoint),
    runtime_health_latest: buildHealthRowV1(health),
  };
}
