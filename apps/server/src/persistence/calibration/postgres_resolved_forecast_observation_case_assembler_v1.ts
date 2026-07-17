// apps/server/src/persistence/calibration/postgres_resolved_forecast_observation_case_assembler_v1.ts
// Purpose: resolve one or more exact CAP-05 Residual roots through canonical Forecast, State, Evidence, Runtime Config, Observation, and Assimilation authorities under one repeatable-read snapshot.
// Boundary: exact-ref read-only graph assembly only; no list, search, latest, time-range, scope-range, persistence, projection mutation, calibration/shadow mathematics, Runtime authority, State/checkpoint mutation, active-config mutation, Model Activation, route, scheduler, filesystem, environment, or network beyond the supplied Pool.

import type { Pool, PoolClient } from "pg";
import type { CanonicalObjectEnvelopeV1 } from "../../domain/twin_runtime/canonical_object_contracts_v1.js";
import type { Cap05ForecastResidualEnvelopeV1 } from "../../domain/twin_runtime/forecast_observation_residual_v1.js";
import type { Cap04ExecutionConfigResolverPortV1 } from "../../domain/twin_runtime/runtime_config_execution_view_v1.js";
import {
  assembleResolvedForecastObservationCaseV1,
  type ResolvedObservationEvidenceV1,
} from "../../domain/twin_runtime/resolved_forecast_observation_case_v1.js";
import type { Cap06CalibrationCaseSourceV1 } from "../../domain/calibration/contracts_v1.js";
import type { Cap06ExactResidualGraphResolverV1 } from "./postgres_exact_calibration_residual_repository_v1.js";

function requiredStringV1(value: unknown, code: string): string {
  if (typeof value !== "string" || !value.trim()) throw new Error(code);
  return value;
}

function recordV1(value: unknown, code: string): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error(code);
  return value as Record<string, unknown>;
}

function parseFactRecordV1(value: unknown, code: string): { type: string; payload: unknown } {
  const parsed = typeof value === "string" ? JSON.parse(value) : value;
  const record = recordV1(parsed, code);
  return {
    type: requiredStringV1(record.type, `${code}_TYPE_REQUIRED`),
    payload: record.payload,
  };
}

function parseCanonicalFactV1(
  value: unknown,
  expectedType: string,
  code: string,
): CanonicalObjectEnvelopeV1 {
  const record = parseFactRecordV1(value, code);
  if (record.type !== expectedType) throw new Error(`${code}_TYPE_MISMATCH`);
  const object = recordV1(record.payload, `${code}_PAYLOAD_REQUIRED`) as unknown as CanonicalObjectEnvelopeV1;
  if (object.object_type !== expectedType) throw new Error(`${code}_OBJECT_TYPE_MISMATCH`);
  return object;
}

function parseObservationFactV1(value: unknown): ResolvedObservationEvidenceV1 {
  const record = parseFactRecordV1(value, "CAP06_GRAPH_OBSERVATION_FACT_INVALID");
  const raw = recordV1(record.payload, "CAP06_GRAPH_OBSERVATION_PAYLOAD_REQUIRED");
  const roleTime = raw.role_time && typeof raw.role_time === "object" && !Array.isArray(raw.role_time)
    ? raw.role_time as Record<string, unknown>
    : {};
  const quality = raw.quality && typeof raw.quality === "object" && !Array.isArray(raw.quality)
    ? raw.quality as Record<string, unknown>
    : {};
  const canonicalPayload = raw.canonical_payload
    && typeof raw.canonical_payload === "object"
    && !Array.isArray(raw.canonical_payload)
    ? raw.canonical_payload as Record<string, unknown>
    : {};
  const qualityStatus = raw.quality_status ?? quality.status;
  if (qualityStatus !== "PASS" && qualityStatus !== "LIMITED") {
    throw new Error("CAP06_GRAPH_OBSERVATION_QUALITY_INVALID");
  }
  const canonicalUnit = raw.canonical_unit ?? canonicalPayload.unit;
  if (canonicalUnit !== "fraction") throw new Error("CAP06_GRAPH_OBSERVATION_UNIT_INVALID");
  return {
    ...structuredClone(raw),
    source_record_id: requiredStringV1(
      raw.source_record_id,
      "CAP06_GRAPH_OBSERVATION_SOURCE_RECORD_ID_REQUIRED",
    ),
    source_record_hash: requiredStringV1(
      raw.source_record_hash,
      "CAP06_GRAPH_OBSERVATION_SOURCE_RECORD_HASH_REQUIRED",
    ),
    observed_at: requiredStringV1(
      raw.observed_at ?? roleTime.observed_at,
      "CAP06_GRAPH_OBSERVATION_OBSERVED_AT_REQUIRED",
    ),
    available_to_runtime_at: requiredStringV1(
      raw.available_to_runtime_at ?? roleTime.available_to_runtime_at,
      "CAP06_GRAPH_OBSERVATION_AVAILABLE_AT_REQUIRED",
    ),
    quality_status: qualityStatus,
    canonical_value: raw.canonical_value ?? canonicalPayload.value,
    canonical_unit: canonicalUnit,
    observation_variance: raw.observation_variance ?? "0.000000000000",
    representativeness_variance: raw.representativeness_variance ?? "0.000000000000",
  };
}

async function readExactCanonicalObjectV1(
  client: PoolClient,
  objectId: string,
  objectType: string,
  code: string,
): Promise<CanonicalObjectEnvelopeV1> {
  const result = await client.query(
    `SELECT record_json
       FROM facts
      WHERE record_json->>'type'=$2
        AND record_json->'payload'->>'object_id'=$1
      LIMIT 2`,
    [requiredStringV1(objectId, `${code}_OBJECT_ID_REQUIRED`), objectType],
  );
  if (result.rows.length !== 1) throw new Error(`${code}_CARDINALITY:${result.rows.length}`);
  const object = parseCanonicalFactV1(result.rows[0].record_json, objectType, code);
  if (object.object_id !== objectId) throw new Error(`${code}_OBJECT_ID_MISMATCH`);
  return object;
}

async function readExactObservationV1(
  client: PoolClient,
  sourceRecordId: string,
): Promise<ResolvedObservationEvidenceV1> {
  const result = await client.query(
    `SELECT record_json
       FROM facts
      WHERE record_json->'payload'->>'source_record_id'=$1
      LIMIT 2`,
    [requiredStringV1(sourceRecordId, "CAP06_GRAPH_OBSERVATION_REF_REQUIRED")],
  );
  if (result.rows.length !== 1) {
    throw new Error(`CAP06_GRAPH_OBSERVATION_CARDINALITY:${result.rows.length}`);
  }
  const observation = parseObservationFactV1(result.rows[0].record_json);
  if (observation.source_record_id !== sourceRecordId) {
    throw new Error("CAP06_GRAPH_OBSERVATION_REF_MISMATCH");
  }
  return observation;
}

export class PostgresResolvedForecastObservationCaseAssemblerV1
implements Cap06ExactResidualGraphResolverV1 {
  constructor(
    private readonly pool: Pool,
    private readonly executionConfigResolver: Cap04ExecutionConfigResolverPortV1,
  ) {
    if (!executionConfigResolver
      || typeof executionConfigResolver.resolveExecutionConfig !== "function") {
      throw new Error("CAP06_GRAPH_EXECUTION_CONFIG_RESOLVER_REQUIRED");
    }
  }

  async resolveExactResidualGraph(
    residual: Cap05ForecastResidualEnvelopeV1,
    caseIndex: number,
  ): Promise<Cap06CalibrationCaseSourceV1> {
    const client = await this.pool.connect();
    try {
      await client.query("BEGIN TRANSACTION ISOLATION LEVEL REPEATABLE READ READ ONLY");
      const result = await this.resolveWithClientV1(client, residual, caseIndex);
      await client.query("COMMIT");
      return result;
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    } finally {
      client.release();
    }
  }

  async resolveExactResidualGraphs(
    orderedResiduals: readonly Cap05ForecastResidualEnvelopeV1[],
  ): Promise<readonly Cap06CalibrationCaseSourceV1[]> {
    if (!Array.isArray(orderedResiduals) || orderedResiduals.length === 0) {
      throw new Error("CAP06_GRAPH_ORDERED_RESIDUALS_REQUIRED");
    }
    const client = await this.pool.connect();
    try {
      await client.query("BEGIN TRANSACTION ISOLATION LEVEL REPEATABLE READ READ ONLY");
      const resolved: Cap06CalibrationCaseSourceV1[] = [];
      for (let caseIndex = 0; caseIndex < orderedResiduals.length; caseIndex += 1) {
        resolved.push(await this.resolveWithClientV1(client, orderedResiduals[caseIndex], caseIndex));
      }
      await client.query("COMMIT");
      return resolved;
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    } finally {
      client.release();
    }
  }

  private async resolveWithClientV1(
    client: PoolClient,
    residual: Cap05ForecastResidualEnvelopeV1,
    caseIndex: number,
  ): Promise<Cap06CalibrationCaseSourceV1> {
    const residualPayload = recordV1(residual.payload, "CAP06_GRAPH_RESIDUAL_PAYLOAD_REQUIRED");
    const sourceForecast = await readExactCanonicalObjectV1(
      client,
      requiredStringV1(residualPayload.forecast_run_ref, "CAP06_GRAPH_FORECAST_REF_REQUIRED"),
      "twin_forecast_run_v1",
      "CAP06_GRAPH_FORECAST",
    );
    const forecastPayload = recordV1(sourceForecast.payload, "CAP06_GRAPH_FORECAST_PAYLOAD_REQUIRED");
    const sourcePosterior = await readExactCanonicalObjectV1(
      client,
      requiredStringV1(forecastPayload.source_posterior_ref, "CAP06_GRAPH_POSTERIOR_REF_REQUIRED"),
      "twin_state_estimate_v1",
      "CAP06_GRAPH_SOURCE_POSTERIOR",
    );
    const posteriorPayload = recordV1(sourcePosterior.payload, "CAP06_GRAPH_POSTERIOR_PAYLOAD_REQUIRED");
    const sourceForecastEvidenceWindow = await readExactCanonicalObjectV1(
      client,
      requiredStringV1(
        posteriorPayload.evidence_window_ref,
        "CAP06_GRAPH_FORECAST_EVIDENCE_REF_REQUIRED",
      ),
      "twin_evidence_window_v1",
      "CAP06_GRAPH_FORECAST_EVIDENCE_WINDOW",
    );
    const sourceRuntimeConfig = await readExactCanonicalObjectV1(
      client,
      requiredStringV1(residualPayload.runtime_config_ref, "CAP06_GRAPH_RUNTIME_CONFIG_REF_REQUIRED"),
      "twin_runtime_config_v1",
      "CAP06_GRAPH_RUNTIME_CONFIG",
    );
    const rawObservation = await readExactObservationV1(
      client,
      requiredStringV1(
        residualPayload.actual_observation_ref,
        "CAP06_GRAPH_OBSERVATION_REF_REQUIRED",
      ),
    );
    const actualObservation: ResolvedObservationEvidenceV1 = {
      ...rawObservation,
      observation_variance: residualPayload.actual_observation_variance as string,
      representativeness_variance: residualPayload.representativeness_variance as string,
    };
    const assimilationUpdate = await readExactCanonicalObjectV1(
      client,
      requiredStringV1(
        residualPayload.assimilation_update_ref,
        "CAP06_GRAPH_ASSIMILATION_REF_REQUIRED",
      ),
      "twin_assimilation_update_v1",
      "CAP06_GRAPH_ASSIMILATION_UPDATE",
    );
    const assimilationPayload = recordV1(
      assimilationUpdate.payload,
      "CAP06_GRAPH_ASSIMILATION_PAYLOAD_REQUIRED",
    );
    const observationEvidenceWindow = await readExactCanonicalObjectV1(
      client,
      requiredStringV1(
        assimilationPayload.evidence_window_ref,
        "CAP06_GRAPH_OBSERVATION_EVIDENCE_REF_REQUIRED",
      ),
      "twin_evidence_window_v1",
      "CAP06_GRAPH_OBSERVATION_EVIDENCE_WINDOW",
    );
    const resolvedExecutionConfig = this.executionConfigResolver.resolveExecutionConfig(
      sourceRuntimeConfig,
    );

    return assembleResolvedForecastObservationCaseV1({
      case_index: caseIndex,
      residual: structuredClone(residual),
      source_forecast: sourceForecast,
      source_posterior: sourcePosterior,
      source_forecast_evidence_window: sourceForecastEvidenceWindow,
      source_runtime_config: sourceRuntimeConfig,
      resolved_execution_config: resolvedExecutionConfig,
      actual_observation: actualObservation,
      assimilation_update: assimilationUpdate,
      observation_evidence_window: observationEvidenceWindow,
    }).case_source;
  }
}
