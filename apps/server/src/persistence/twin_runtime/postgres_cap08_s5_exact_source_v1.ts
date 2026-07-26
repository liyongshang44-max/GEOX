// Purpose: resolve one exact MCFT-CAP-08.S5 Forecast/FVO obligation, append its canonical Residual, and assemble the bounded calibration replay authority.
// Boundary: exact-ref reads plus one existing C_FORECAST_RESIDUAL_COMMIT only; no list/latest lookup, historical rewrite, State/checkpoint mutation, Candidate/Shadow persistence, active Config, route, scheduler, production Runtime source, or MCFT-CAP-09 authority.

import type { Pool } from "pg";
import {
  formatFixedDecimalV1,
  normalizeFixedDecimalV1,
  parseFixedDecimalV1,
} from "../../domain/soil_water/fixed_point_water_decimal_v1.js";
import { buildRootZoneObservationOperatorV1 } from "../../domain/soil_water/root_zone_observation_operator_v1.js";
import type { HourlyWaterBalanceConfigV1, HourlyWaterBalanceInputV1 } from "../../domain/soil_water/hourly_water_balance_v1.js";
import type { Cap06CalibrationCaseSourceV1, Cap06RealityScopeV1 } from "../../domain/calibration/contracts_v1.js";
import {
  computeCap08S4AuthorityDeterminismHashV1,
  CAP08_S4_AUTHORITY_SCHEMA_VERSION_V1,
  type Cap08S4AppendForwardAuthorityV1,
} from "../../domain/twin_runtime/cap08_s4_append_forward_contracts_v1.js";
import {
  CAP08_S5_PHASE_ENGINE_CONTRACT_DIGEST_V1,
  type Cap08S5ExactSourcePortV1,
  type Cap08S5ResidualObligationV1,
  type Cap08S5ResolvedObligationV1,
} from "../../domain/twin_runtime/cap08_s5_residual_calibration_shadow_contracts_v1.js";
import {
  buildCap05ForecastPointMemberRefV1,
  buildCap05ForecastResidualV1,
  type Cap05ForecastResidualEnvelopeV1,
} from "../../domain/twin_runtime/forecast_observation_residual_v1.js";
import {
  validateCap04CanonicalForecastRunPayloadV1,
  type Cap04CanonicalCompletedForecastRunPayloadV1,
} from "../../domain/twin_runtime/forecast_canonical_authority_v1.js";
import type { CanonicalObjectEnvelopeV1 } from "../../domain/twin_runtime/canonical_object_contracts_v1.js";
import { semanticHashV1 } from "../../domain/twin_runtime/canonical_identity_v1.js";
import {
  DirectCap04ExecutionConfigResolverV1,
  type ResolvedCap04ExecutionConfigV1,
} from "../../domain/twin_runtime/runtime_config_execution_view_v1.js";
import type {
  Cap05PersistedObjectV1,
  Cap05PersistenceResultV1,
} from "./postgres_feedback_persistence_repository_v1.js";

export type Cap08S5ResidualPersistencePortV1 = {
  commitCanonicalObject(input: {
    object: Cap05ForecastResidualEnvelopeV1;
    fault_injection?: (stage: string) => void;
  }): Promise<Cap05PersistenceResultV1>;
  readCanonicalObject(objectId: string): Promise<Cap05PersistedObjectV1 | null>;
};

type ScopeLikeV1 = {
  tenant_id: string;
  project_id: string;
  group_id: string | null;
  field_id: string;
  season_id: string | null;
  zone_id: string | null;
};

type OrdinaryObservationGraphV1 = {
  assimilation: CanonicalObjectEnvelopeV1;
  posterior: CanonicalObjectEnvelopeV1;
  evidence_window: CanonicalObjectEnvelopeV1;
};

function requiredStringV1(value: unknown, code: string): string {
  if (typeof value !== "string" || !value.trim()) throw new Error(code);
  return value;
}

function recordV1(value: unknown, code: string): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error(code);
  return value as Record<string, unknown>;
}

function canonicalInstantV1(value: unknown, code: string): string {
  const text = requiredStringV1(value, code);
  const parsed = Date.parse(text);
  if (!Number.isFinite(parsed) || new Date(parsed).toISOString() !== text) throw new Error(code);
  return text;
}

function fixed6V1(value: unknown, code: string): string {
  const text = typeof value === "number" ? String(value) : requiredStringV1(value, code);
  return formatFixedDecimalV1(parseFixedDecimalV1(text, 6, code), 6);
}

function add6V1(...values: string[]): string {
  return formatFixedDecimalV1(
    values.reduce((sum, value) => sum + parseFixedDecimalV1(value, 6), 0n),
    6,
  );
}

function subtract6V1(left: string, right: string): string {
  return formatFixedDecimalV1(
    parseFixedDecimalV1(left, 6) - parseFixedDecimalV1(right, 6),
    6,
  );
}

function exactScopeV1(actual: ScopeLikeV1, expected: Cap06RealityScopeV1, code: string): void {
  for (const field of ["tenant_id", "project_id", "group_id", "field_id", "season_id", "zone_id"] as const) {
    if (actual[field] !== expected[field]) throw new Error(`${code}:${field}`);
  }
}

function parseCanonicalRecordV1(value: unknown, expectedType: string, code: string): CanonicalObjectEnvelopeV1 {
  const record = recordV1(typeof value === "string" ? JSON.parse(value) : value, code);
  if (record.type !== expectedType) throw new Error(`${code}_TYPE_MISMATCH`);
  const object = recordV1(record.payload, `${code}_PAYLOAD_REQUIRED`) as unknown as CanonicalObjectEnvelopeV1;
  if (object.object_type !== expectedType) throw new Error(`${code}_OBJECT_TYPE_MISMATCH`);
  return object;
}

function selectedObservationSnapshotV1(
  evidenceWindow: CanonicalObjectEnvelopeV1,
  expectedRef: string,
): Record<string, unknown> {
  const selection = recordV1(
    recordV1(evidenceWindow.payload, "CAP08_S5_EVIDENCE_PAYLOAD_REQUIRED").observation_selection,
    "CAP08_S5_OBSERVATION_SELECTION_REQUIRED",
  );
  if (selection.selected_observation_ref !== expectedRef) {
    throw new Error("CAP08_S5_SELECTED_OBSERVATION_REF_MISMATCH");
  }
  const selected = recordV1(
    selection.selected_observation,
    "CAP08_S5_SELECTED_OBSERVATION_SNAPSHOT_REQUIRED",
  );
  if ((selected.observation_ref ?? selected.source_record_id) !== expectedRef) {
    throw new Error("CAP08_S5_SELECTED_OBSERVATION_SNAPSHOT_REF_MISMATCH");
  }
  return selected;
}

function replayConfigV1(resolved: ResolvedCap04ExecutionConfigV1): HourlyWaterBalanceConfigV1 {
  const payload = resolved.payload;
  return {
    root_zone_depth_mm: fixed6V1(payload.soil_hydraulic_snapshot.root_zone_depth_mm, "CAP08_S5_ROOT_ZONE_DEPTH_REQUIRED"),
    wilting_point_storage_mm: fixed6V1(payload.soil_hydraulic_snapshot.wilting_point_storage_mm, "CAP08_S5_WILTING_STORAGE_REQUIRED"),
    field_capacity_storage_mm: fixed6V1(payload.soil_hydraulic_snapshot.field_capacity_storage_mm, "CAP08_S5_FIELD_CAPACITY_REQUIRED"),
    saturation_storage_mm: fixed6V1(payload.soil_hydraulic_snapshot.saturation_storage_mm, "CAP08_S5_SATURATION_STORAGE_REQUIRED"),
    saturation_fraction: fixed6V1(payload.soil_hydraulic_snapshot.saturation_fraction, "CAP08_S5_SATURATION_FRACTION_REQUIRED"),
    runoff_fraction: fixed6V1(payload.dynamics_parameters.runoff_fraction, "CAP08_S5_RUNOFF_FRACTION_REQUIRED"),
    drainage_coefficient_per_hour: fixed6V1(payload.dynamics_parameters.drainage_coefficient_per_hour, "CAP08_S5_DRAINAGE_COEFFICIENT_REQUIRED"),
    structural_process_stddev_mm_per_hour: fixed6V1(payload.process_uncertainty.structural_process_stddev_mm_per_hour, "CAP08_S5_STRUCTURAL_STDDEV_REQUIRED"),
    rainfall_relative_stddev: fixed6V1(payload.process_uncertainty.rainfall_relative_stddev, "CAP08_S5_RAINFALL_STDDEV_REQUIRED"),
    crop_et_relative_stddev: fixed6V1(payload.process_uncertainty.crop_et_relative_stddev, "CAP08_S5_CROP_ET_STDDEV_REQUIRED"),
    executed_irrigation_relative_stddev: fixed6V1(payload.process_uncertainty.executed_irrigation_relative_stddev, "CAP08_S5_IRRIGATION_STDDEV_REQUIRED"),
  };
}

function replayInputV1(input: {
  point: Cap04CanonicalCompletedForecastRunPayloadV1["points"][number];
  sourcePosterior: CanonicalObjectEnvelopeV1;
}): Omit<HourlyWaterBalanceInputV1, "config"> {
  if (input.point.horizon_hour !== 1) throw new Error("CAP08_S5_H1_FORECAST_POINT_REQUIRED");
  if (input.point.assumed_irrigation_mm !== "0.000000") {
    throw new Error("CAP08_S5_BASELINE_NO_NEW_IRRIGATION_REQUIRED");
  }
  return {
    interval_start_exclusive: input.point.interval_start,
    interval_end_inclusive: input.point.interval_end,
    previous_storage_mm_decimal: input.point.previous_storage_mm,
    previous_variance_basis: {
      basis_origin: "CARRIED_FROM_PREVIOUS_CONTINUATION_STATE",
      previous_state_ref: input.sourcePosterior.object_id,
      previous_storage_variance_mm2_decimal: "0.000000000000",
    },
    gross_rainfall_mm_decimal: input.point.gross_precipitation_assumption_mm,
    historical_et0_mm_decimal: input.point.reference_et0_mm,
    crop_stage_code: input.point.crop_stage_code,
    kc_decimal: input.point.kc,
    executed_irrigation_candidates: [],
  };
}

export class PostgresCap08S5ExactSourceV1 implements Cap08S5ExactSourcePortV1 {
  private readonly configResolver = new DirectCap04ExecutionConfigResolverV1();

  constructor(
    private readonly pool: Pool,
    private readonly residualPersistence: Cap08S5ResidualPersistencePortV1,
  ) {
    if (!pool || typeof pool.query !== "function") throw new Error("CAP08_S5_POOL_REQUIRED");
    if (!residualPersistence
      || typeof residualPersistence.commitCanonicalObject !== "function"
      || typeof residualPersistence.readCanonicalObject !== "function") {
      throw new Error("CAP08_S5_RESIDUAL_PERSISTENCE_PORT_REQUIRED");
    }
  }

  private async readExactObjectV1(input: {
    objectId: string;
    objectType: string;
    expectedHash?: string;
    scope: Cap06RealityScopeV1;
    code: string;
  }): Promise<CanonicalObjectEnvelopeV1> {
    const result = await this.pool.query(
      `SELECT record_json FROM facts
        WHERE record_json->>'type'=$2
          AND record_json->'payload'->>'object_id'=$1
        LIMIT 2`,
      [requiredStringV1(input.objectId, `${input.code}_OBJECT_ID_REQUIRED`), input.objectType],
    );
    if (result.rows.length !== 1) throw new Error(`${input.code}_CARDINALITY:${result.rows.length}`);
    const object = parseCanonicalRecordV1(result.rows[0].record_json, input.objectType, input.code);
    if (object.object_id !== input.objectId
      || (input.expectedHash !== undefined && object.determinism_hash !== input.expectedHash)) {
      throw new Error(`${input.code}_IDENTITY_MISMATCH`);
    }
    exactScopeV1(object, input.scope, `${input.code}_SCOPE_MISMATCH`);
    return object;
  }

  private async loadOrdinaryObservationGraphV1(input: {
    obligation: Cap08S5ResidualObligationV1;
    scope: Cap06RealityScopeV1;
    lineageId: string;
    revisionId: string;
  }): Promise<OrdinaryObservationGraphV1 | null> {
    if (input.obligation.assimilation_update_ref === null) return null;
    const assimilation = await this.readExactObjectV1({
      objectId: input.obligation.assimilation_update_ref,
      objectType: "twin_assimilation_update_v1",
      expectedHash: requiredStringV1(
        input.obligation.assimilation_update_hash,
        "CAP08_S5_ASSIMILATION_HASH_REQUIRED",
      ),
      scope: input.scope,
      code: "CAP08_S5_ASSIMILATION",
    });
    if (assimilation.lineage_id !== input.lineageId || assimilation.revision_id !== input.revisionId) {
      throw new Error("CAP08_S5_ASSIMILATION_CONTEXT_MISMATCH");
    }
    const assimilationPayload = recordV1(assimilation.payload, "CAP08_S5_ASSIMILATION_PAYLOAD_REQUIRED");
    if (assimilationPayload.selected_observation_ref !== input.obligation.observation.source_record_id
      || assimilationPayload.model_parameter_change_applied !== false
      || assimilation.logical_time !== input.obligation.observation.available_to_runtime_at) {
      throw new Error("CAP08_S5_ASSIMILATION_OBSERVATION_MISMATCH");
    }
    const posterior = await this.readExactObjectV1({
      objectId: requiredStringV1(assimilationPayload.posterior_state_ref, "CAP08_S5_OBSERVATION_POSTERIOR_REF_REQUIRED"),
      objectType: "twin_state_estimate_v1",
      scope: input.scope,
      code: "CAP08_S5_OBSERVATION_POSTERIOR",
    });
    if (posterior.lineage_id !== input.lineageId
      || posterior.revision_id !== input.revisionId
      || posterior.logical_time !== input.obligation.observation.available_to_runtime_at) {
      throw new Error("CAP08_S5_OBSERVATION_POSTERIOR_CONTEXT_MISMATCH");
    }
    const posteriorPayload = recordV1(posterior.payload, "CAP08_S5_OBSERVATION_POSTERIOR_PAYLOAD_REQUIRED");
    if (posteriorPayload.assimilation_update_ref !== assimilation.object_id) {
      throw new Error("CAP08_S5_OBSERVATION_POSTERIOR_ASSIMILATION_MISMATCH");
    }
    const evidenceWindow = await this.readExactObjectV1({
      objectId: requiredStringV1(posteriorPayload.evidence_window_ref, "CAP08_S5_OBSERVATION_EVIDENCE_REF_REQUIRED"),
      objectType: "twin_evidence_window_v1",
      scope: input.scope,
      code: "CAP08_S5_OBSERVATION_EVIDENCE_WINDOW",
    });
    const selected = selectedObservationSnapshotV1(
      evidenceWindow,
      input.obligation.observation.source_record_id,
    );
    if (selected.source_record_hash !== input.obligation.observation.source_record_hash
      || evidenceWindow.as_of !== input.obligation.observation.available_to_runtime_at) {
      throw new Error("CAP08_S5_OBSERVATION_EVIDENCE_MISMATCH");
    }
    return { assimilation, posterior, evidence_window: evidenceWindow };
  }

  private async validateS4AuthorityV1(input: {
    formalRunId: string;
    scope: Cap06RealityScopeV1;
    obligation: Cap08S5ResidualObligationV1;
  }): Promise<string | null> {
    if (input.obligation.residual_id !== "R-01" && input.obligation.residual_id !== "R-16") return null;
    const result = await this.pool.query(
      `SELECT determinism_hash,semantic_payload
         FROM twin_runtime_authority_snapshot_v1
        WHERE semantic_payload->>'schema_version'=$1
          AND semantic_payload->>'formal_run_id'=$2
          AND semantic_payload->'scope'->>'tenant_id'=$3
          AND semantic_payload->'scope'->>'project_id'=$4
          AND semantic_payload->'scope'->>'group_id'=$5
          AND semantic_payload->'scope'->>'field_id'=$6
          AND semantic_payload->'scope'->>'season_id'=$7
          AND semantic_payload->'scope'->>'zone_id'=$8`,
      [
        CAP08_S4_AUTHORITY_SCHEMA_VERSION_V1,
        input.formalRunId,
        input.scope.tenant_id,
        input.scope.project_id,
        input.scope.group_id,
        input.scope.field_id,
        input.scope.season_id,
        input.scope.zone_id,
      ],
    );
    if (result.rows.length !== 1) throw new Error(`CAP08_S5_S4_AUTHORITY_CARDINALITY:${result.rows.length}`);
    const authority = structuredClone(
      typeof result.rows[0].semantic_payload === "string"
        ? JSON.parse(result.rows[0].semantic_payload)
        : result.rows[0].semantic_payload,
    ) as Cap08S4AppendForwardAuthorityV1;
    const { determinism_hash: _declared, ...basis } = authority;
    if (authority.determinism_hash !== result.rows[0].determinism_hash
      || authority.determinism_hash !== computeCap08S4AuthorityDeterminismHashV1(basis)
      || authority.phase_engine_contract_digest !== CAP08_S5_PHASE_ENGINE_CONTRACT_DIGEST_V1
      || authority.residual_commit_status !== "PENDING_S5_C_PROVIDER") {
      throw new Error("CAP08_S5_S4_AUTHORITY_INVALID");
    }
    const expected = input.obligation.residual_id === "R-01"
      ? authority.identity_input.late_observation
      : authority.identity_input.ordinary_due_observation;
    if (expected.ref !== input.obligation.observation.source_record_id
      || expected.hash !== input.obligation.observation.source_record_hash) {
      throw new Error(`CAP08_S5_S4_OBSERVATION_BINDING_MISMATCH:${input.obligation.residual_id}`);
    }
    return authority.authority_ref;
  }

  async resolveExactObligation(input: {
    scope: Cap06RealityScopeV1;
    formal_run_id: string;
    obligation: Cap08S5ResidualObligationV1;
    created_at: string;
  }): Promise<Cap08S5ResolvedObligationV1> {
    const formalRunId = requiredStringV1(input.formal_run_id, "CAP08_S5_FORMAL_RUN_ID_REQUIRED");
    const createdAt = canonicalInstantV1(input.created_at, "CAP08_S5_CREATED_AT_INVALID");
    const forecast = await this.readExactObjectV1({
      objectId: input.obligation.forecast_ref,
      objectType: "twin_forecast_run_v1",
      expectedHash: input.obligation.forecast_hash,
      scope: input.scope,
      code: "CAP08_S5_FORECAST",
    });
    const forecastPayload = forecast.payload as unknown as Cap04CanonicalCompletedForecastRunPayloadV1;
    validateCap04CanonicalForecastRunPayloadV1(forecastPayload);
    if (forecastPayload.status !== "COMPLETED") throw new Error("CAP08_S5_COMPLETED_FORECAST_REQUIRED");
    const point = forecastPayload.points[0];
    if (!point || point.horizon_hour !== 1
      || point.target_time !== input.obligation.observation.observed_at) {
      throw new Error("CAP08_S5_FORECAST_FVO_TARGET_MISMATCH");
    }
    const sourcePosterior = await this.readExactObjectV1({
      objectId: forecastPayload.source_posterior_ref,
      objectType: "twin_state_estimate_v1",
      expectedHash: forecastPayload.source_posterior_hash,
      scope: input.scope,
      code: "CAP08_S5_SOURCE_POSTERIOR",
    });
    const lineageId = requiredStringV1(forecast.lineage_id, "CAP08_S5_LINEAGE_ID_REQUIRED");
    const revisionId = requiredStringV1(forecast.revision_id, "CAP08_S5_REVISION_ID_REQUIRED");
    if (sourcePosterior.lineage_id !== lineageId || sourcePosterior.revision_id !== revisionId) {
      throw new Error("CAP08_S5_SOURCE_POSTERIOR_CONTEXT_MISMATCH");
    }
    const sourcePosteriorPayload = recordV1(sourcePosterior.payload, "CAP08_S5_SOURCE_POSTERIOR_PAYLOAD_REQUIRED");
    const forecastEvidenceWindow = await this.readExactObjectV1({
      objectId: requiredStringV1(sourcePosteriorPayload.evidence_window_ref, "CAP08_S5_FORECAST_EVIDENCE_REF_REQUIRED"),
      objectType: "twin_evidence_window_v1",
      scope: input.scope,
      code: "CAP08_S5_FORECAST_EVIDENCE_WINDOW",
    });
    const runtimeConfig = await this.readExactObjectV1({
      objectId: forecastPayload.runtime_config_ref,
      objectType: "twin_runtime_config_v1",
      expectedHash: forecastPayload.runtime_config_hash,
      scope: input.scope,
      code: "CAP08_S5_RUNTIME_CONFIG",
    });
    const resolvedConfig = this.configResolver.resolveExecutionConfig(runtimeConfig);
    const ordinaryGraph = await this.loadOrdinaryObservationGraphV1({
      obligation: input.obligation,
      scope: input.scope,
      lineageId,
      revisionId,
    });
    const s4AuthorityRef = await this.validateS4AuthorityV1({
      formalRunId,
      scope: input.scope,
      obligation: input.obligation,
    });
    if (ordinaryGraph === null
      && input.obligation.residual_id !== "R-01"
      && input.obligation.residual_id !== "R-16"
      && input.obligation.assimilation_update_ref !== null) {
      throw new Error("CAP08_S5_ORDINARY_GRAPH_REQUIRED");
    }

    const operatorPolicy = resolvedConfig.payload.observation_assimilation;
    const operator = buildRootZoneObservationOperatorV1({
      observation_fraction: Number(input.obligation.observation.canonical_value),
      quality_status: input.obligation.observation.quality_status,
      sensor_measurement_stddev_fraction: operatorPolicy.sensor_measurement_stddev_fraction,
      point_to_zone_representativeness_stddev_fraction:
        operatorPolicy.point_to_zone_representativeness_stddev_fraction,
      quality_weights: operatorPolicy.quality_weights,
    });
    const rootDepth = fixed6V1(
      resolvedConfig.payload.soil_hydraulic_snapshot.root_zone_depth_mm,
      "CAP08_S5_ROOT_ZONE_DEPTH_REQUIRED",
    );
    const residual = buildCap05ForecastResidualV1({
      scope: input.scope,
      forecast_run_ref: forecast.object_id,
      forecast_run_hash: forecast.determinism_hash,
      forecast_issued_at: forecastPayload.issued_at,
      forecast_point_ref: buildCap05ForecastPointMemberRefV1(forecast.object_id, 1),
      forecast_point: point,
      root_zone_geometry_ref: resolvedConfig.payload.reality_binding_ref,
      root_zone_geometry_hash: resolvedConfig.payload.reality_binding_hash,
      root_zone_depth_mm: rootDepth,
      actual_observation_ref: input.obligation.observation.source_record_id,
      actual_observation_hash: input.obligation.observation.source_record_hash,
      actual_observation_observed_at: input.obligation.observation.observed_at,
      actual_observation_quality: input.obligation.observation.quality_status,
      actual_observation_value: fixed6V1(input.obligation.observation.canonical_value, "CAP08_S5_OBSERVATION_VALUE_INVALID"),
      actual_observation_variance: normalizeFixedDecimalV1(
        String(operator.effective_observation_variance),
        12,
        "CAP08_S5_EFFECTIVE_OBSERVATION_VARIANCE_INVALID",
      ),
      representativeness_variance: normalizeFixedDecimalV1(
        String(operator.representativeness_variance),
        12,
        "CAP08_S5_REPRESENTATIVENESS_VARIANCE_INVALID",
      ),
      runtime_config_ref: runtimeConfig.object_id,
      runtime_config_hash: runtimeConfig.determinism_hash,
      context_lineage_ref: lineageId,
      context_revision_ref: revisionId,
      observation_available_to_runtime_at: input.obligation.observation.available_to_runtime_at,
      assimilation_update_ref: input.obligation.assimilation_update_ref,
      assimilation_update_hash: input.obligation.assimilation_update_hash,
      created_at: createdAt,
    });
    const persisted = await this.residualPersistence.commitCanonicalObject({ object: residual });
    if (persisted.object.object_type !== "twin_forecast_residual_v1"
      || persisted.object.object_id !== residual.object_id
      || persisted.object.determinism_hash !== residual.determinism_hash) {
      throw new Error("CAP08_S5_RESIDUAL_PERSISTENCE_RESULT_MISMATCH");
    }
    const readback = await this.residualPersistence.readCanonicalObject(residual.object_id);
    if (!readback
      || readback.object_type !== "twin_forecast_residual_v1"
      || readback.determinism_hash !== residual.determinism_hash) {
      throw new Error("CAP08_S5_RESIDUAL_CANONICAL_READBACK_MISMATCH");
    }

    const sourceExecution = resolvedConfig.payload;
    const fieldCapacity = fixed6V1(
      sourceExecution.soil_hydraulic_snapshot.field_capacity_storage_mm,
      "CAP08_S5_FIELD_CAPACITY_REQUIRED",
    );
    const saturation = fixed6V1(
      sourceExecution.soil_hydraulic_snapshot.saturation_storage_mm,
      "CAP08_S5_SATURATION_REQUIRED",
    );
    const storageBeforeDrainage = add6V1(
      point.storage_mean_mm,
      point.drainage_mm,
      point.saturation_overflow_mm,
    );
    const caseInputHash = semanticHashV1({
      formal_run_id: formalRunId,
      phase_engine_contract_digest: CAP08_S5_PHASE_ENGINE_CONTRACT_DIGEST_V1,
      residual_ref: residual.object_id,
      residual_hash: residual.determinism_hash,
      source_forecast_ref: forecast.object_id,
      source_forecast_hash: forecast.determinism_hash,
      source_forecast_point_ref: residual.payload.forecast_point_ref,
      source_forecast_point_hash: point.determinism_hash,
      source_posterior_ref: sourcePosterior.object_id,
      source_posterior_hash: sourcePosterior.determinism_hash,
      source_forecast_evidence_window_ref: forecastEvidenceWindow.object_id,
      source_forecast_evidence_window_hash: forecastEvidenceWindow.determinism_hash,
      source_runtime_config_ref: runtimeConfig.object_id,
      source_runtime_config_hash: runtimeConfig.determinism_hash,
      actual_observation_ref: input.obligation.observation.source_record_id,
      actual_observation_hash: input.obligation.observation.source_record_hash,
      observation_available_to_runtime_at: input.obligation.observation.available_to_runtime_at,
      assimilation_update_ref: ordinaryGraph?.assimilation.object_id ?? null,
      assimilation_update_hash: ordinaryGraph?.assimilation.determinism_hash ?? null,
      observation_posterior_ref: ordinaryGraph?.posterior.object_id ?? null,
      observation_posterior_hash: ordinaryGraph?.posterior.determinism_hash ?? null,
      observation_evidence_window_ref: ordinaryGraph?.evidence_window.object_id ?? null,
      observation_evidence_window_hash: ordinaryGraph?.evidence_window.determinism_hash ?? null,
      s4_correction_authority_ref: s4AuthorityRef,
    });
    const caseSource: Cap06CalibrationCaseSourceV1 & { source_runtime_config_logical_time: string } = {
      case_index: input.obligation.residual_order - 1,
      scope: structuredClone(input.scope),
      residual_ref: residual.object_id,
      residual_hash: residual.determinism_hash,
      source_forecast_ref: forecast.object_id,
      source_forecast_hash: forecast.determinism_hash,
      source_forecast_point_ref: residual.payload.forecast_point_ref,
      source_forecast_point_hash: point.determinism_hash,
      source_posterior_ref: sourcePosterior.object_id,
      source_posterior_hash: sourcePosterior.determinism_hash,
      source_runtime_config_ref: runtimeConfig.object_id,
      source_runtime_config_hash: runtimeConfig.determinism_hash,
      source_runtime_config_logical_time: runtimeConfig.logical_time,
      actual_observation_ref: input.obligation.observation.source_record_id,
      actual_observation_hash: input.obligation.observation.source_record_hash,
      forecast_issued_at: forecastPayload.issued_at,
      forecast_as_of: canonicalInstantV1(forecast.as_of, "CAP08_S5_FORECAST_AS_OF_INVALID"),
      forecast_evidence_cutoff: canonicalInstantV1(
        forecastEvidenceWindow.as_of,
        "CAP08_S5_FORECAST_EVIDENCE_CUTOFF_INVALID",
      ),
      forecast_target_time: point.target_time,
      observation_observed_at: input.obligation.observation.observed_at,
      observation_available_to_runtime_at: input.obligation.observation.available_to_runtime_at,
      actual_observation_vwc: residual.payload.actual_observation_value,
      base_prediction_vwc: residual.payload.predicted_observation_value,
      excess_above_field_capacity_mm: subtract6V1(storageBeforeDrainage, fieldCapacity),
      saturation_minus_field_capacity_mm: subtract6V1(saturation, fieldCapacity),
      context_lineage_ref: lineageId,
      context_revision_ref: revisionId,
      model_component_hash: semanticHashV1({ model_component_refs: sourceExecution.model_component_refs }),
      effective_parameter_bundle_hash: semanticHashV1({
        soil_hydraulic_snapshot: sourceExecution.soil_hydraulic_snapshot,
        dynamics_parameters: sourceExecution.dynamics_parameters,
      }),
      observation_operator_hash: semanticHashV1(sourceExecution.observation_assimilation.observation_operator),
      geometry_hash: sourceExecution.reality_binding_hash,
      runtime_replay_numeric_policy_hash: semanticHashV1({
        decimal_scale_policy_id: sourceExecution.decimal_scale_policy_id,
        rounding_policy_id: sourceExecution.rounding_policy_id,
        water_amount_scale: 6,
        water_variance_scale: 12,
      }),
      case_input_hash: caseInputHash,
    };

    return {
      obligation: structuredClone(input.obligation),
      residual: structuredClone(readback as Cap05ForecastResidualEnvelopeV1),
      residual_fact_id: persisted.fact_id,
      residual_persistence_status: persisted.status,
      case_source: caseSource,
      replay_authority: {
        residual_ref: residual.object_id,
        source_forecast_point: structuredClone(point),
        source_posterior: structuredClone(sourcePosterior),
        resolved_execution_config: structuredClone(resolvedConfig),
        input_without_config: replayInputV1({ point, sourcePosterior }),
        base_config: replayConfigV1(resolvedConfig),
      },
    };
  }
}
