// apps/server/src/persistence/twin_runtime/postgres_forecast_residual_source_v1.ts
// Purpose: reconstruct canonical COMPLETED historical Forecast candidates for one observation target and prove each source posterior's Evidence Window consumed canonical Action Feedback.
// Boundary: read-only PostgreSQL adapter; no fact append, projection mutation, State change, Forecast execution, Residual construction, route, scheduler, filesystem, environment or network authority beyond the supplied Pool.

import type { Pool, PoolClient } from "pg";
import type { CanonicalObjectEnvelopeV1 } from "../../domain/twin_runtime/canonical_object_contracts_v1.js";
import { canonicalJsonV1 } from "../../domain/twin_runtime/canonical_json_v1.js";
import {
  validateCap04CanonicalForecastRunPayloadV1,
  type Cap04CanonicalCompletedForecastRunPayloadV1,
} from "../../domain/twin_runtime/forecast_canonical_authority_v1.js";
import type { Cap05HistoricalForecastResidualCandidateV1 } from "../../runtime/twin_runtime/historical_forecast_residual_selector_v1.js";
import type { TwinScopeKeyV1 } from "../../runtime/twin_runtime/ports.js";

function requiredStringV1(value: unknown, code: string): string {
  if (typeof value !== "string" || !value.trim()) throw new Error(code);
  return value;
}

function canonicalInstantV1(value: unknown, code: string): string {
  const text = requiredStringV1(value, code);
  const parsed = Date.parse(text);
  if (!Number.isFinite(parsed) || new Date(parsed).toISOString() !== text) throw new Error(code);
  return text;
}

function parseFactObjectV1(value: unknown, code: string): CanonicalObjectEnvelopeV1 {
  const parsed = typeof value === "string" ? JSON.parse(value) : value;
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) throw new Error(code);
  const record = parsed as Record<string, unknown>;
  if (!record.payload || typeof record.payload !== "object" || Array.isArray(record.payload)) throw new Error(code);
  return record.payload as CanonicalObjectEnvelopeV1;
}

function exactScopeV1(object: CanonicalObjectEnvelopeV1, scope: TwinScopeKeyV1, code: string): void {
  if (object.tenant_id !== scope.tenant_id
    || object.project_id !== scope.project_id
    || object.group_id !== scope.group_id
    || object.field_id !== scope.field_id
    || object.season_id !== scope.season_id
    || object.zone_id !== scope.zone_id) throw new Error(code);
}

function exactProjectionMatchV1(row: Record<string, unknown>, forecast: CanonicalObjectEnvelopeV1): void {
  const payload = forecast.payload as unknown as Cap04CanonicalCompletedForecastRunPayloadV1;
  const fields: Array<[string, unknown, unknown]> = [
    ["forecast_object_id", row.forecast_object_id, forecast.object_id],
    ["tenant_id", row.tenant_id, forecast.tenant_id],
    ["project_id", row.project_id, forecast.project_id],
    ["group_id", row.group_id, forecast.group_id],
    ["field_id", row.field_id, forecast.field_id],
    ["season_id", row.season_id, forecast.season_id],
    ["zone_id", row.zone_id, forecast.zone_id],
    ["lineage_id", row.lineage_id, forecast.lineage_id],
    ["revision_id", row.revision_id, forecast.revision_id],
    ["forecast_status", row.forecast_status, payload.status],
    ["source_posterior_ref", row.source_posterior_ref, payload.source_posterior_ref],
    ["source_posterior_hash", row.source_posterior_hash, payload.source_posterior_hash],
    ["runtime_config_ref", row.runtime_config_ref, forecast.runtime_config_ref],
    ["runtime_config_hash", row.runtime_config_hash, forecast.runtime_config_hash],
    ["point_count", Number(row.point_count), payload.points.length],
    ["forecast_determinism_hash", row.forecast_determinism_hash, forecast.determinism_hash],
  ];
  for (const [field, actual, expected] of fields) {
    if (actual !== expected) throw new Error(`CAP05_RESIDUAL_SOURCE_FORECAST_PROJECTION_MISMATCH:${field}`);
  }
  const logicalTime = row.forecast_logical_time instanceof Date
    ? row.forecast_logical_time.toISOString()
    : String(row.forecast_logical_time);
  if (logicalTime !== forecast.logical_time || logicalTime !== payload.issued_at) {
    throw new Error("CAP05_RESIDUAL_SOURCE_FORECAST_PROJECTION_MISMATCH:logical_time");
  }
}

function exactPointProjectionMatchV1(
  row: Record<string, unknown>,
  payload: Cap04CanonicalCompletedForecastRunPayloadV1,
): void {
  const horizon = Number(row.horizon_hour);
  const matches = payload.points.filter((point) => point.horizon_hour === horizon);
  if (matches.length !== 1) throw new Error("CAP05_RESIDUAL_SOURCE_FORECAST_POINT_CARDINALITY");
  const point = matches[0];
  const targetTime = row.target_time instanceof Date ? row.target_time.toISOString() : String(row.target_time);
  if (targetTime !== point.target_time
    || row.point_determinism_hash !== point.determinism_hash
    || canonicalJsonV1(row.canonical_point) !== canonicalJsonV1(point)) {
    throw new Error("CAP05_RESIDUAL_SOURCE_FORECAST_POINT_PROJECTION_MISMATCH");
  }
}

async function readExactCanonicalObjectV1(
  client: PoolClient,
  objectId: string,
  code: string,
): Promise<CanonicalObjectEnvelopeV1> {
  const result = await client.query(
    `SELECT record_json FROM facts
     WHERE record_json->'payload'->>'object_id'=$1
     LIMIT 2`,
    [objectId],
  );
  if (result.rows.length !== 1) throw new Error(code);
  return parseFactObjectV1(result.rows[0].record_json, code);
}

function evidenceRefsV1(evidence: CanonicalObjectEnvelopeV1): string[] {
  const payloadRefs = Array.isArray(evidence.payload.consumed_evidence_refs)
    ? evidence.payload.consumed_evidence_refs
    : [];
  return [...new Set([...evidence.evidence_refs, ...payloadRefs]
    .filter((value): value is string => typeof value === "string" && Boolean(value.trim())))]
    .sort((left, right) => left.localeCompare(right));
}

async function actionFeedbackRefsForSourcePosteriorV1(input: {
  client: PoolClient;
  forecast: CanonicalObjectEnvelopeV1;
  scope: TwinScopeKeyV1;
}): Promise<string[]> {
  const payload = input.forecast.payload as unknown as Cap04CanonicalCompletedForecastRunPayloadV1;
  const state = await readExactCanonicalObjectV1(
    input.client,
    payload.source_posterior_ref,
    "CAP05_RESIDUAL_SOURCE_POSTERIOR_NOT_FOUND",
  );
  if (state.object_type !== "twin_state_estimate_v1"
    || state.determinism_hash !== payload.source_posterior_hash) {
    throw new Error("CAP05_RESIDUAL_SOURCE_POSTERIOR_MISMATCH");
  }
  exactScopeV1(state, input.scope, "CAP05_RESIDUAL_SOURCE_POSTERIOR_SCOPE_MISMATCH");
  if (state.lineage_id !== input.forecast.lineage_id || state.revision_id !== input.forecast.revision_id) {
    throw new Error("CAP05_RESIDUAL_SOURCE_POSTERIOR_CONTEXT_MISMATCH");
  }
  const evidenceWindowRef = requiredStringV1(
    state.payload.evidence_window_ref,
    "CAP05_RESIDUAL_SOURCE_POSTERIOR_EVIDENCE_WINDOW_REQUIRED",
  );
  const evidence = await readExactCanonicalObjectV1(
    input.client,
    evidenceWindowRef,
    "CAP05_RESIDUAL_SOURCE_EVIDENCE_WINDOW_NOT_FOUND",
  );
  if (evidence.object_type !== "twin_evidence_window_v1") {
    throw new Error("CAP05_RESIDUAL_SOURCE_EVIDENCE_WINDOW_TYPE_MISMATCH");
  }
  exactScopeV1(evidence, input.scope, "CAP05_RESIDUAL_SOURCE_EVIDENCE_WINDOW_SCOPE_MISMATCH");
  if (evidence.lineage_id !== input.forecast.lineage_id || evidence.revision_id !== input.forecast.revision_id) {
    throw new Error("CAP05_RESIDUAL_SOURCE_EVIDENCE_WINDOW_CONTEXT_MISMATCH");
  }
  const refs = evidenceRefsV1(evidence);
  if (refs.length === 0) return [];
  const result = await input.client.query(
    `SELECT action_feedback_object_id,determinism_hash,source_fact_id
     FROM twin_action_feedback_projection_v1
     WHERE action_feedback_object_id=ANY($1::text[])
     ORDER BY action_feedback_object_id`,
    [refs],
  );
  const actionFeedbackRefs: string[] = [];
  for (const row of result.rows) {
    const feedback = await readExactCanonicalObjectV1(
      input.client,
      String(row.action_feedback_object_id),
      "CAP05_RESIDUAL_SOURCE_ACTION_FEEDBACK_NOT_FOUND",
    );
    if ((feedback as unknown as { object_type: string }).object_type !== "twin_action_feedback_v1"
      || feedback.determinism_hash !== row.determinism_hash) {
      throw new Error("CAP05_RESIDUAL_SOURCE_ACTION_FEEDBACK_PROJECTION_MISMATCH");
    }
    exactScopeV1(feedback, input.scope, "CAP05_RESIDUAL_SOURCE_ACTION_FEEDBACK_SCOPE_MISMATCH");
    actionFeedbackRefs.push(feedback.object_id);
  }
  return [...new Set(actionFeedbackRefs)].sort((left, right) => left.localeCompare(right));
}

export class PostgresForecastResidualSourceV1 {
  constructor(private readonly pool: Pool) {}

  async loadHistoricalForecastCandidates(input: {
    scope: TwinScopeKeyV1;
    lineage_id: string;
    revision_id: string;
    observation_target_time: string;
    observation_available_to_runtime_at: string;
  }): Promise<readonly Cap05HistoricalForecastResidualCandidateV1[]> {
    const targetTime = canonicalInstantV1(input.observation_target_time, "CAP05_RESIDUAL_SOURCE_TARGET_TIME_INVALID");
    const availableAt = canonicalInstantV1(input.observation_available_to_runtime_at, "CAP05_RESIDUAL_SOURCE_AVAILABLE_TIME_INVALID");
    if (Date.parse(availableAt) < Date.parse(targetTime)) throw new Error("CAP05_RESIDUAL_SOURCE_AVAILABLE_BEFORE_TARGET");
    const client = await this.pool.connect();
    try {
      const result = await client.query(
        `SELECT
           fr.forecast_object_id,
           fr.tenant_id,fr.project_id,fr.group_id,fr.field_id,fr.season_id,fr.zone_id,
           fr.lineage_id,fr.revision_id,
           fr.logical_time AS forecast_logical_time,
           fr.forecast_status,
           fr.source_posterior_ref,fr.source_posterior_hash,
           fr.runtime_config_ref,fr.runtime_config_hash,
           fr.point_count,
           fr.determinism_hash AS forecast_determinism_hash,
           fp.horizon_hour,fp.target_time,
           fp.determinism_hash AS point_determinism_hash,
           fp.canonical_point,
           f.record_json AS forecast_record_json
         FROM twin_forecast_run_projection_v1 fr
         JOIN twin_forecast_point_projection_v1 fp
           ON fp.forecast_object_id=fr.forecast_object_id
         JOIN facts f
           ON f.fact_id=fr.source_fact_id
         WHERE fr.tenant_id=$1 AND fr.project_id=$2 AND fr.group_id=$3
           AND fr.field_id=$4 AND fr.season_id=$5 AND fr.zone_id=$6
           AND fr.lineage_id=$7 AND fr.revision_id=$8
           AND fr.forecast_status='COMPLETED'
           AND fp.target_time=$9::timestamptz
           AND fr.logical_time < $9::timestamptz
         ORDER BY fr.logical_time DESC,fr.forecast_object_id ASC`,
        [
          input.scope.tenant_id,
          input.scope.project_id,
          input.scope.group_id,
          input.scope.field_id,
          input.scope.season_id,
          input.scope.zone_id,
          requiredStringV1(input.lineage_id, "CAP05_RESIDUAL_SOURCE_LINEAGE_REQUIRED"),
          requiredStringV1(input.revision_id, "CAP05_RESIDUAL_SOURCE_REVISION_REQUIRED"),
          targetTime,
        ],
      );
      const candidates: Cap05HistoricalForecastResidualCandidateV1[] = [];
      for (const row of result.rows as Record<string, unknown>[]) {
        const forecast = parseFactObjectV1(
          row.forecast_record_json,
          "CAP05_RESIDUAL_SOURCE_FORECAST_FACT_INVALID",
        );
        if (forecast.object_type !== "twin_forecast_run_v1") {
          throw new Error("CAP05_RESIDUAL_SOURCE_FORECAST_TYPE_MISMATCH");
        }
        exactScopeV1(forecast, input.scope, "CAP05_RESIDUAL_SOURCE_FORECAST_SCOPE_MISMATCH");
        const payload = forecast.payload as unknown as Cap04CanonicalCompletedForecastRunPayloadV1;
        validateCap04CanonicalForecastRunPayloadV1(payload);
        if (payload.status !== "COMPLETED") throw new Error("CAP05_RESIDUAL_SOURCE_FORECAST_NOT_COMPLETED");
        exactProjectionMatchV1(row, forecast);
        exactPointProjectionMatchV1(row, payload);
        candidates.push({
          forecast: structuredClone(forecast),
          source_posterior_action_feedback_refs: await actionFeedbackRefsForSourcePosteriorV1({
            client,
            forecast,
            scope: input.scope,
          }),
        });
      }
      return candidates;
    } finally {
      client.release();
    }
  }
}
