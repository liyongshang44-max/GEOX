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

function requiredScalarV1(value: unknown, code: string): string | number {
  if (typeof value === "string" && value.trim()) return value;
  if (typeof value === "number" && Number.isFinite(value)) return value;
  throw new Error(code);
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
  const object = recordV1(
    record.payload,
    `${code}_PAYLOAD_REQUIRED`,
  ) as unknown as CanonicalObjectEnvelopeV1;
  if (object.object_type !== expectedType) throw new Error(`${code}_OBJECT_TYPE_MISMATCH`);
  return object;
}

function selectedObservationFromEvidenceWindowV1(
  evidenceWindow: CanonicalObjectEnvelopeV1,
  expectedObservationRef: string,
  observationVariance: unknown,
  representativenessVariance: unknown,
): ResolvedObservationEvidenceV1 {
  const payload = recordV1(
    evidenceWindow.payload,
    "CAP06_GRAPH_OBSERVATION_EVIDENCE_PAYLOAD_REQUIRED",
  );
  const selection = recordV1(
    payload.observation_selection,
    "CAP06_GRAPH_OBSERVATION_SELECTION_REQUIRED",
  );
  const selectedRef = requiredStringV1(
    selection.selected_observation_ref,
    "CAP06_GRAPH_SELECTED_OBSERVATION_REF_REQUIRED",
  );
  if (selectedRef !== expectedObservationRef) {
    throw new Error("CAP06_GRAPH_SELECTED_OBSERVATION_REF_MISMATCH");
  }

  let selected: Record<string, unknown>;
  if (selection.selected_observation
    && typeof selection.selected_observation === "object"
    && !Array.isArray(selection.selected_observation)) {
    selected = selection.selected_observation as Record<string, unknown>;
  } else {
    const candidates = Array.isArray(selection.candidates)
      ? selection.candidates.filter((candidate) => {
        if (!candidate || typeof candidate !== "object" || Array.isArray(candidate)) return false;
        const record = candidate as Record<string, unknown>;
        return record.observation_ref === expectedObservationRef
          || record.source_record_id === expectedObservationRef;
      })
      : [];
    if (candidates.length !== 1) {
      throw new Error(`CAP06_GRAPH_SELECTED_OBSERVATION_CARDINALITY:${candidates.length}`);
    }
    selected = candidates[0] as Record<string, unknown>;
  }

  const quality = selected.quality
    && typeof selected.quality === "object"
    && !Array.isArray(selected.quality)
    ? selected.quality as Record<string, unknown>
    : {};
  const canonicalPayload = selected.canonical_payload
    && typeof selected.canonical_payload === "object"
    && !Array.isArray(selected.canonical_payload)
    ? selected.canonical_payload as Record<string, unknown>
    : {};
  const qualityStatus = selected.quality_status ?? quality.status;
  if (qualityStatus !== "PASS" && qualityStatus !== "LIMITED") {
    throw new Error("CAP06_GRAPH_OBSERVATION_QUALITY_INVALID");
  }
  const canonicalUnit = selected.canonical_unit ?? canonicalPayload.unit;
  if (canonicalUnit !== "fraction") {
    throw new Error("CAP06_GRAPH_OBSERVATION_UNIT_INVALID");
  }
  const sourceRecordId = requiredStringV1(
    selected.source_record_id ?? selected.observation_ref,
    "CAP06_GRAPH_OBSERVATION_SOURCE_RECORD_ID_REQUIRED",
  );
  if (sourceRecordId !== expectedObservationRef) {
    throw new Error("CAP06_GRAPH_OBSERVATION_SOURCE_RECORD_ID_MISMATCH");
  }

  return {
    ...structuredClone(selected),
    source_record_id: sourceRecordId,
    source_record_hash: requiredStringV1(
      selected.source_record_hash,
      "CAP06_GRAPH_OBSERVATION_SOURCE_RECORD_HASH_REQUIRED",
    ),
    observed_at: requiredStringV1(
      selected.observed_at,
      "CAP06_GRAPH_OBSERVATION_OBSERVED_AT_REQUIRED",
    ),
    available_to_runtime_at: requiredStringV1(
      selected.available_to_runtime_at,
      "CAP06_GRAPH_OBSERVATION_AVAILABLE_AT_REQUIRED",
    ),
    quality_status: qualityStatus,
    canonical_value: requiredScalarV1(
      selected.canonical_value ?? canonicalPayload.value,
      "CAP06_GRAPH_OBSERVATION_CANONICAL_VALUE_REQUIRED",
    ),
    canonical_unit: canonicalUnit,
    observation_variance: requiredScalarV1(
      observationVariance,
      "CAP06_GRAPH_RESIDUAL_OBSERVATION_VARIANCE_REQUIRED",
    ),
    representativeness_variance: requiredScalarV1(
      representativenessVariance,
      "CAP06_GRAPH_RESIDUAL_REPRESENTATIVENESS_VARIANCE_REQUIRED",
    ),
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
        resolved.push(await this.resolveWithClientV1(
          client,
          orderedResiduals[caseIndex],
          caseIndex,
        ));
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
    const residualPayload = recordV1(
      residual.payload,
      "CAP06_GRAPH_RESIDUAL_PAYLOAD_REQUIRED",
    );
    const sourceForecast = await readExactCanonicalObjectV1(
      client,
      requiredStringV1(residualPayload.forecast_run_ref, "CAP06_GRAPH_FORECAST_REF_REQUIRED"),
      "twin_forecast_run_v1",
      "CAP06_GRAPH_FORECAST",
    );
    const forecastPayload = recordV1(
      sourceForecast.payload,
      "CAP06_GRAPH_FORECAST_PAYLOAD_REQUIRED",
    );
    const sourcePosterior = await readExactCanonicalObjectV1(
      client,
      requiredStringV1(forecastPayload.source_posterior_ref, "CAP06_GRAPH_POSTERIOR_REF_REQUIRED"),
      "twin_state_estimate_v1",
      "CAP06_GRAPH_SOURCE_POSTERIOR",
    );
    const sourcePosteriorPayload = recordV1(
      sourcePosterior.payload,
      "CAP06_GRAPH_POSTERIOR_PAYLOAD_REQUIRED",
    );
    const sourceForecastEvidenceWindow = await readExactCanonicalObjectV1(
      client,
      requiredStringV1(
        sourcePosteriorPayload.evidence_window_ref,
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
    const observationPosterior = await readExactCanonicalObjectV1(
      client,
      requiredStringV1(
        assimilationPayload.posterior_state_ref,
        "CAP06_GRAPH_OBSERVATION_POSTERIOR_REF_REQUIRED",
      ),
      "twin_state_estimate_v1",
      "CAP06_GRAPH_OBSERVATION_POSTERIOR",
    );
    const observationPosteriorPayload = recordV1(
      observationPosterior.payload,
      "CAP06_GRAPH_OBSERVATION_POSTERIOR_PAYLOAD_REQUIRED",
    );
    const observationEvidenceWindow = await readExactCanonicalObjectV1(
      client,
      requiredStringV1(
        observationPosteriorPayload.evidence_window_ref,
        "CAP06_GRAPH_OBSERVATION_EVIDENCE_REF_REQUIRED",
      ),
      "twin_evidence_window_v1",
      "CAP06_GRAPH_OBSERVATION_EVIDENCE_WINDOW",
    );
    const actualObservation = selectedObservationFromEvidenceWindowV1(
      observationEvidenceWindow,
      requiredStringV1(
        residualPayload.actual_observation_ref,
        "CAP06_GRAPH_OBSERVATION_REF_REQUIRED",
      ),
      residualPayload.actual_observation_variance,
      residualPayload.representativeness_variance,
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
      observation_posterior: observationPosterior,
      observation_evidence_window: observationEvidenceWindow,
    }).case_source;
  }
}
