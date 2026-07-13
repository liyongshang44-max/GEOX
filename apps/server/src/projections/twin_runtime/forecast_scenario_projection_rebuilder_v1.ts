// apps/server/src/projections/twin_runtime/forecast_scenario_projection_rebuilder_v1.ts
// Purpose: derive rebuildable CAP-04 Forecast and Scenario projection rows from canonical facts without creating an alternative source of truth.
// Boundary: pure projection-row construction only; no SQL, persistence, route, scheduler, filesystem, network, environment, or wall clock.

import type { CanonicalObjectEnvelopeV1 } from "../../domain/twin_runtime/canonical_object_contracts_v1.js";
import {
  validateCap04ForecastRunPayloadV1,
  validateCap04ScenarioSetPayloadV1,
  type Cap04ForecastRunPayloadV1,
  type Cap04ScenarioOptionIdV1,
  type Cap04ScenarioSetEnvelopeV1,
} from "../../domain/twin_runtime/forecast_scenario_contracts_v1.js";
import type { Cap04ScenarioSetRecordV1 } from "../../domain/twin_runtime/forecast_scenario_record_set_identity_v1.js";

export type Cap04ForecastProjectionRowsV1 = {
  run: {
    forecast_object_id: string;
    tenant_id: string;
    project_id: string;
    group_id: string;
    field_id: string;
    season_id: string;
    zone_id: string;
    lineage_id: string;
    revision_id: string;
    logical_time: string;
    forecast_status: "COMPLETED" | "BLOCKED";
    source_posterior_ref: string;
    source_posterior_hash: string;
    runtime_config_ref: string;
    runtime_config_hash: string;
    forcing_window_hash: string | null;
    point_count: number;
    determinism_hash: string;
    canonical_payload: Cap04ForecastRunPayloadV1;
    source_fact_id: string;
  };
  points: Array<{
    forecast_object_id: string;
    horizon_hour: number;
    target_time: string;
    storage_mean_mm: string;
    storage_variance_mm2: string;
    available_water_fraction: string;
    determinism_hash: string;
    canonical_point: Cap04ForecastRunPayloadV1["points"][number];
  }>;
};

export type Cap04ScenarioProjectionRowsV1 = {
  set: {
    scenario_set_id: string;
    tenant_id: string;
    project_id: string;
    group_id: string;
    field_id: string;
    season_id: string;
    zone_id: string;
    lineage_id: string;
    revision_id: string;
    logical_time: string;
    source_forecast_ref: string;
    source_forecast_hash: string;
    source_posterior_ref: string;
    source_posterior_hash: string;
    runtime_config_ref: string;
    runtime_config_hash: string;
    scenario_policy_id: string;
    option_count: number;
    determinism_hash: string;
    canonical_payload: Cap04ScenarioSetEnvelopeV1["payload"];
    source_fact_id: string;
  };
  points: Array<{
    scenario_set_id: string;
    option_id: Cap04ScenarioOptionIdV1;
    horizon_hour: number;
    target_time: string;
    storage_mean_mm: string;
    storage_variance_mm2: string;
    available_water_fraction: string;
    determinism_hash: string;
    canonical_point: Cap04ScenarioSetEnvelopeV1["payload"]["options"][number]["trajectory_points"][number];
  }>;
  latest: {
    tenant_id: string;
    project_id: string;
    group_id: string;
    field_id: string;
    season_id: string;
    zone_id: string;
    scenario_set_id: string;
    source_forecast_ref: string;
    source_forecast_hash: string;
    logical_time: string;
    determinism_hash: string;
    source_fact_id: string;
  };
};

function scopeStringV1(value: string | null | undefined, code: string): string {
  if (typeof value !== "string" || !value.trim()) throw new Error(code);
  return value;
}

export function buildCap04ForecastProjectionRowsV1(
  forecast: CanonicalObjectEnvelopeV1,
  sourceFactId: string,
): Cap04ForecastProjectionRowsV1 {
  if (forecast.object_type !== "twin_forecast_run_v1") throw new Error("CAP04_FORECAST_PROJECTION_OBJECT_TYPE_REQUIRED");
  validateCap04ForecastRunPayloadV1(forecast.payload as unknown as Cap04ForecastRunPayloadV1);
  const payload = structuredClone(forecast.payload) as unknown as Cap04ForecastRunPayloadV1;
  const run: Cap04ForecastProjectionRowsV1["run"] = {
    forecast_object_id: forecast.object_id,
    tenant_id: forecast.tenant_id,
    project_id: forecast.project_id,
    group_id: scopeStringV1(forecast.group_id, "CAP04_FORECAST_PROJECTION_GROUP_REQUIRED"),
    field_id: forecast.field_id,
    season_id: scopeStringV1(forecast.season_id, "CAP04_FORECAST_PROJECTION_SEASON_REQUIRED"),
    zone_id: scopeStringV1(forecast.zone_id, "CAP04_FORECAST_PROJECTION_ZONE_REQUIRED"),
    lineage_id: scopeStringV1(forecast.lineage_id, "CAP04_FORECAST_PROJECTION_LINEAGE_REQUIRED"),
    revision_id: scopeStringV1(forecast.revision_id, "CAP04_FORECAST_PROJECTION_REVISION_REQUIRED"),
    logical_time: forecast.logical_time,
    forecast_status: payload.status,
    source_posterior_ref: payload.source_posterior_ref,
    source_posterior_hash: payload.source_posterior_hash,
    runtime_config_ref: payload.runtime_config_ref,
    runtime_config_hash: payload.runtime_config_hash,
    forcing_window_hash: payload.forcing_window_hash,
    point_count: payload.points.length,
    determinism_hash: forecast.determinism_hash,
    canonical_payload: payload,
    source_fact_id: sourceFactId,
  };
  return {
    run,
    points: payload.points.map((point) => ({
      forecast_object_id: forecast.object_id,
      horizon_hour: point.horizon_hour,
      target_time: point.target_time,
      storage_mean_mm: point.storage_mean_mm,
      storage_variance_mm2: point.storage_variance_mm2,
      available_water_fraction: point.available_water_fraction,
      determinism_hash: point.determinism_hash,
      canonical_point: structuredClone(point),
    })),
  };
}

export function buildCap04ScenarioProjectionRowsV1(
  record: Cap04ScenarioSetRecordV1,
  sourceForecastPayload: Cap04ForecastRunPayloadV1,
  sourceFactId: string,
): Cap04ScenarioProjectionRowsV1 {
  const scenario = record.scenario_set;
  validateCap04ScenarioSetPayloadV1(scenario.payload, sourceForecastPayload);
  const payload = structuredClone(scenario.payload);
  const set: Cap04ScenarioProjectionRowsV1["set"] = {
    scenario_set_id: scenario.object_id,
    tenant_id: scenario.tenant_id,
    project_id: scenario.project_id,
    group_id: scopeStringV1(scenario.group_id, "CAP04_SCENARIO_PROJECTION_GROUP_REQUIRED"),
    field_id: scenario.field_id,
    season_id: scopeStringV1(scenario.season_id, "CAP04_SCENARIO_PROJECTION_SEASON_REQUIRED"),
    zone_id: scopeStringV1(scenario.zone_id, "CAP04_SCENARIO_PROJECTION_ZONE_REQUIRED"),
    lineage_id: scopeStringV1(scenario.lineage_id, "CAP04_SCENARIO_PROJECTION_LINEAGE_REQUIRED"),
    revision_id: scopeStringV1(scenario.revision_id, "CAP04_SCENARIO_PROJECTION_REVISION_REQUIRED"),
    logical_time: scenario.logical_time,
    source_forecast_ref: payload.source_forecast_ref,
    source_forecast_hash: payload.source_forecast_hash,
    source_posterior_ref: payload.source_posterior_ref,
    source_posterior_hash: payload.source_posterior_hash,
    runtime_config_ref: payload.runtime_config_ref,
    runtime_config_hash: payload.runtime_config_hash,
    scenario_policy_id: payload.scenario_policy_id,
    option_count: payload.options.length,
    determinism_hash: scenario.determinism_hash,
    canonical_payload: payload,
    source_fact_id: sourceFactId,
  };
  const points = payload.options.flatMap((option) => option.trajectory_points.map((point) => ({
    scenario_set_id: scenario.object_id,
    option_id: option.option_id,
    horizon_hour: point.horizon_hour,
    target_time: point.target_time,
    storage_mean_mm: point.storage_mean_mm,
    storage_variance_mm2: point.storage_variance_mm2,
    available_water_fraction: point.available_water_fraction,
    determinism_hash: point.determinism_hash,
    canonical_point: structuredClone(point),
  })));
  return {
    set,
    points,
    latest: {
      tenant_id: set.tenant_id,
      project_id: set.project_id,
      group_id: set.group_id,
      field_id: set.field_id,
      season_id: set.season_id,
      zone_id: set.zone_id,
      scenario_set_id: set.scenario_set_id,
      source_forecast_ref: set.source_forecast_ref,
      source_forecast_hash: set.source_forecast_hash,
      logical_time: set.logical_time,
      determinism_hash: set.determinism_hash,
      source_fact_id: set.source_fact_id,
    },
  };
}
