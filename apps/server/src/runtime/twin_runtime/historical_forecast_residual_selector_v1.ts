// apps/server/src/runtime/twin_runtime/historical_forecast_residual_selector_v1.ts
// Purpose: deterministically select the latest canonical COMPLETED historical Forecast point that targets one exact observation and whose source posterior consumed canonical Action Feedback.
// Boundary: pure selection and trace construction only; no database, persistence, State mutation, Forecast execution, Residual construction, route, scheduler, filesystem, environment, network or wall-clock authority.

import { semanticHashV1 } from "../../domain/twin_runtime/canonical_identity_v1.js";
import type { CanonicalObjectEnvelopeV1 } from "../../domain/twin_runtime/canonical_object_contracts_v1.js";
import {
  validateCap04CanonicalForecastRunPayloadV1,
  type Cap04CanonicalCompletedForecastRunPayloadV1,
  type Cap04CanonicalForecastRunPayloadV1,
} from "../../domain/twin_runtime/forecast_canonical_authority_v1.js";
import {
  buildCap05ForecastPointMemberRefV1,
  CAP05_FORECAST_RESIDUAL_MATCHING_POLICY_ID_V1,
  CAP05_FORECAST_RESIDUAL_MATCHING_POLICY_VERSION_V1,
} from "../../domain/twin_runtime/forecast_observation_residual_v1.js";
import type { Cap04ForecastPointV1 } from "../../domain/twin_runtime/forecast_scenario_contracts_v1.js";
import type { TwinScopeKeyV1 } from "./ports.js";

export const CAP05_HISTORICAL_FORECAST_SELECTOR_ID_V1 =
  "LATEST_COMPLETED_FORECAST_POINT_TARGETING_OBSERVATION_SELECTOR_V1" as const;
export const CAP05_HISTORICAL_FORECAST_TIE_POLICY_ID_V1 =
  "SEMANTIC_EQUIVALENCE_REQUIRED_OBJECT_ID_ASC_V1" as const;
export const CAP05_SOURCE_POSTERIOR_ACTION_FEEDBACK_POLICY_ID_V1 =
  "SOURCE_POSTERIOR_EVIDENCE_WINDOW_MUST_CONSUME_CANONICAL_H_V1" as const;

export type Cap05HistoricalForecastResidualCandidateV1 = {
  forecast: CanonicalObjectEnvelopeV1;
  source_posterior_action_feedback_refs: string[];
};

export type Cap05HistoricalForecastSelectionDispositionV1 =
  | "SELECTED"
  | "EQUIVALENT_TIE_NOT_SELECTED"
  | "EXCLUDED_SCOPE"
  | "EXCLUDED_CONTEXT"
  | "EXCLUDED_NOT_COMPLETED"
  | "EXCLUDED_TARGET_TIME"
  | "EXCLUDED_NOT_HISTORICAL"
  | "EXCLUDED_NOT_AVAILABLE_BEFORE_OBSERVATION"
  | "EXCLUDED_SOURCE_POSTERIOR_WITHOUT_ACTION_FEEDBACK";

export type Cap05HistoricalForecastSelectionTraceEntryV1 = {
  forecast_run_ref: string;
  forecast_run_hash: string;
  forecast_issued_at: string;
  forecast_point_ref: string | null;
  forecast_point_hash: string | null;
  source_posterior_ref: string | null;
  source_posterior_hash: string | null;
  source_posterior_action_feedback_refs: string[];
  semantic_equivalence_hash: string;
  disposition: Cap05HistoricalForecastSelectionDispositionV1;
  reason_code: string | null;
};

export type Cap05HistoricalForecastSelectionTraceV1 = {
  selector_id: typeof CAP05_HISTORICAL_FORECAST_SELECTOR_ID_V1;
  matching_policy_id: typeof CAP05_FORECAST_RESIDUAL_MATCHING_POLICY_ID_V1;
  matching_policy_version: typeof CAP05_FORECAST_RESIDUAL_MATCHING_POLICY_VERSION_V1;
  tie_policy_id: typeof CAP05_HISTORICAL_FORECAST_TIE_POLICY_ID_V1;
  source_posterior_action_feedback_policy_id: typeof CAP05_SOURCE_POSTERIOR_ACTION_FEEDBACK_POLICY_ID_V1;
  observation_target_time: string;
  observation_available_to_runtime_at: string;
  candidate_count: number;
  selected_forecast_run_ref: string | null;
  selected_forecast_point_ref: string | null;
  entries: Cap05HistoricalForecastSelectionTraceEntryV1[];
  semantic_digest: string;
};

export type Cap05HistoricalForecastSelectionV1 = {
  forecast: CanonicalObjectEnvelopeV1;
  payload: Cap04CanonicalCompletedForecastRunPayloadV1;
  point: Cap04ForecastPointV1;
  forecast_point_ref: string;
  source_posterior_action_feedback_refs: string[];
  trace: Cap05HistoricalForecastSelectionTraceV1;
};

type ClassifiedCandidateV1 = {
  candidate: Cap05HistoricalForecastResidualCandidateV1;
  payload: Cap04CanonicalCompletedForecastRunPayloadV1 | null;
  point: Cap04ForecastPointV1 | null;
  entry: Cap05HistoricalForecastSelectionTraceEntryV1;
  eligible: boolean;
};

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

function exactScopeV1(forecast: CanonicalObjectEnvelopeV1, scope: TwinScopeKeyV1): boolean {
  return forecast.tenant_id === scope.tenant_id
    && forecast.project_id === scope.project_id
    && forecast.group_id === scope.group_id
    && forecast.field_id === scope.field_id
    && forecast.season_id === scope.season_id
    && forecast.zone_id === scope.zone_id;
}

function exactContextV1(
  forecast: CanonicalObjectEnvelopeV1,
  lineageId: string,
  revisionId: string,
): boolean {
  return forecast.lineage_id === lineageId && forecast.revision_id === revisionId;
}

function uniqueSortedV1(values: readonly string[]): string[] {
  return [...new Set(values.map((value) => requiredStringV1(value, "CAP05_FORECAST_SELECTOR_ACTION_FEEDBACK_REF_INVALID")))]
    .sort((left, right) => left.localeCompare(right));
}

function semanticEquivalenceHashV1(
  forecast: CanonicalObjectEnvelopeV1,
  payload: Cap04CanonicalForecastRunPayloadV1 | null,
): string {
  return semanticHashV1({
    scope: {
      tenant_id: forecast.tenant_id,
      project_id: forecast.project_id,
      group_id: forecast.group_id,
      field_id: forecast.field_id,
      season_id: forecast.season_id,
      zone_id: forecast.zone_id,
    },
    lineage_id: forecast.lineage_id,
    revision_id: forecast.revision_id,
    logical_time: forecast.logical_time,
    runtime_config_ref: forecast.runtime_config_ref,
    runtime_config_hash: forecast.runtime_config_hash,
    payload,
  });
}

function baseEntryV1(input: {
  candidate: Cap05HistoricalForecastResidualCandidateV1;
  payload: Cap04CanonicalForecastRunPayloadV1 | null;
  point: Cap04ForecastPointV1 | null;
}): Cap05HistoricalForecastSelectionTraceEntryV1 {
  const { forecast } = input.candidate;
  const issuedAt = input.payload && typeof input.payload.issued_at === "string"
    ? input.payload.issued_at
    : forecast.logical_time;
  const sourcePosteriorRef = input.payload && typeof input.payload.source_posterior_ref === "string"
    ? input.payload.source_posterior_ref
    : null;
  const sourcePosteriorHash = input.payload && typeof input.payload.source_posterior_hash === "string"
    ? input.payload.source_posterior_hash
    : null;
  return {
    forecast_run_ref: forecast.object_id,
    forecast_run_hash: forecast.determinism_hash,
    forecast_issued_at: issuedAt,
    forecast_point_ref: input.point
      ? buildCap05ForecastPointMemberRefV1(forecast.object_id, input.point.horizon_hour)
      : null,
    forecast_point_hash: input.point?.determinism_hash ?? null,
    source_posterior_ref: sourcePosteriorRef,
    source_posterior_hash: sourcePosteriorHash,
    source_posterior_action_feedback_refs: uniqueSortedV1(input.candidate.source_posterior_action_feedback_refs),
    semantic_equivalence_hash: semanticEquivalenceHashV1(forecast, input.payload),
    disposition: "EXCLUDED_NOT_COMPLETED",
    reason_code: "FORECAST_NOT_COMPLETED",
  };
}

function classifyCandidateV1(input: {
  candidate: Cap05HistoricalForecastResidualCandidateV1;
  scope: TwinScopeKeyV1;
  lineage_id: string;
  revision_id: string;
  observation_target_time: string;
  observation_available_to_runtime_at: string;
}): ClassifiedCandidateV1 {
  const forecast = input.candidate.forecast;
  if (forecast.object_type !== "twin_forecast_run_v1") {
    throw new Error("CAP05_FORECAST_SELECTOR_OBJECT_TYPE_INVALID");
  }
  requiredStringV1(forecast.object_id, "CAP05_FORECAST_SELECTOR_OBJECT_ID_REQUIRED");
  requiredStringV1(forecast.determinism_hash, "CAP05_FORECAST_SELECTOR_HASH_REQUIRED");
  const payload = forecast.payload as unknown as Cap04CanonicalForecastRunPayloadV1;
  validateCap04CanonicalForecastRunPayloadV1(payload);
  const point = payload.status === "COMPLETED"
    ? payload.points.find((candidatePoint) => candidatePoint.target_time === input.observation_target_time) ?? null
    : null;
  const entry = baseEntryV1({ candidate: input.candidate, payload, point });

  if (!exactScopeV1(forecast, input.scope)) {
    return { candidate: input.candidate, payload: null, point, entry: { ...entry, disposition: "EXCLUDED_SCOPE", reason_code: "FORECAST_SCOPE_MISMATCH" }, eligible: false };
  }
  if (!exactContextV1(forecast, input.lineage_id, input.revision_id)) {
    return { candidate: input.candidate, payload: null, point, entry: { ...entry, disposition: "EXCLUDED_CONTEXT", reason_code: "FORECAST_CONTEXT_MISMATCH" }, eligible: false };
  }
  if (payload.status !== "COMPLETED") {
    return { candidate: input.candidate, payload: null, point: null, entry, eligible: false };
  }
  const completed = payload as Cap04CanonicalCompletedForecastRunPayloadV1;
  if (completed.points.length !== 72 || point === null) {
    return { candidate: input.candidate, payload: completed, point, entry: { ...entry, disposition: "EXCLUDED_TARGET_TIME", reason_code: "FORECAST_POINT_TARGET_TIME_NOT_FOUND" }, eligible: false };
  }
  const targetMatches = completed.points.filter((candidatePoint) => candidatePoint.target_time === input.observation_target_time);
  if (targetMatches.length !== 1) throw new Error("CAP05_FORECAST_SELECTOR_TARGET_POINT_CARDINALITY");
  const issuedAt = canonicalInstantV1(completed.issued_at, "CAP05_FORECAST_SELECTOR_ISSUED_AT_INVALID");
  if (Date.parse(issuedAt) >= Date.parse(input.observation_target_time)) {
    return { candidate: input.candidate, payload: completed, point, entry: { ...entry, disposition: "EXCLUDED_NOT_HISTORICAL", reason_code: "FORECAST_NOT_ISSUED_BEFORE_OBSERVATION" }, eligible: false };
  }
  const createdAt = canonicalInstantV1(forecast.created_at, "CAP05_FORECAST_SELECTOR_CREATED_AT_INVALID");
  if (Date.parse(createdAt) >= Date.parse(input.observation_available_to_runtime_at)) {
    return { candidate: input.candidate, payload: completed, point, entry: { ...entry, disposition: "EXCLUDED_NOT_AVAILABLE_BEFORE_OBSERVATION", reason_code: "FORECAST_NOT_AVAILABLE_BEFORE_OBSERVATION" }, eligible: false };
  }
  const actionFeedbackRefs = uniqueSortedV1(input.candidate.source_posterior_action_feedback_refs);
  if (actionFeedbackRefs.length === 0) {
    return { candidate: input.candidate, payload: completed, point, entry: { ...entry, disposition: "EXCLUDED_SOURCE_POSTERIOR_WITHOUT_ACTION_FEEDBACK", reason_code: "SOURCE_POSTERIOR_ACTION_FEEDBACK_REQUIRED" }, eligible: false };
  }
  return {
    candidate: input.candidate,
    payload: completed,
    point,
    entry: { ...entry, disposition: "SELECTED", reason_code: null },
    eligible: true,
  };
}

function traceDigestV1(value: Omit<Cap05HistoricalForecastSelectionTraceV1, "semantic_digest">): string {
  return semanticHashV1(value);
}

export function selectHistoricalForecastForResidualV1(input: {
  scope: TwinScopeKeyV1;
  lineage_id: string;
  revision_id: string;
  observation_target_time: string;
  observation_available_to_runtime_at: string;
  candidates: readonly Cap05HistoricalForecastResidualCandidateV1[];
}): Cap05HistoricalForecastSelectionV1 {
  const targetTime = canonicalInstantV1(input.observation_target_time, "CAP05_FORECAST_SELECTOR_TARGET_TIME_INVALID");
  const availableAt = canonicalInstantV1(input.observation_available_to_runtime_at, "CAP05_FORECAST_SELECTOR_OBSERVATION_AVAILABLE_INVALID");
  if (Date.parse(availableAt) < Date.parse(targetTime)) throw new Error("CAP05_FORECAST_SELECTOR_OBSERVATION_AVAILABLE_BEFORE_TARGET");
  const lineageId = requiredStringV1(input.lineage_id, "CAP05_FORECAST_SELECTOR_LINEAGE_REQUIRED");
  const revisionId = requiredStringV1(input.revision_id, "CAP05_FORECAST_SELECTOR_REVISION_REQUIRED");
  if (!Array.isArray(input.candidates)) throw new Error("CAP05_FORECAST_SELECTOR_CANDIDATES_REQUIRED");

  const classified = input.candidates.map((candidate) => classifyCandidateV1({
    candidate,
    scope: input.scope,
    lineage_id: lineageId,
    revision_id: revisionId,
    observation_target_time: targetTime,
    observation_available_to_runtime_at: availableAt,
  }));
  const eligible = classified.filter((candidate) => candidate.eligible);
  if (eligible.length === 0) throw new Error("CAP05_FORECAST_RESIDUAL_MATCH_NOT_FOUND");

  eligible.sort((left, right) => {
    const issued = right.entry.forecast_issued_at.localeCompare(left.entry.forecast_issued_at);
    if (issued !== 0) return issued;
    return left.entry.forecast_run_ref.localeCompare(right.entry.forecast_run_ref);
  });
  const latestIssuedAt = eligible[0].entry.forecast_issued_at;
  const tied = eligible.filter((candidate) => candidate.entry.forecast_issued_at === latestIssuedAt);
  const tieHashes = new Set(tied.map((candidate) => candidate.entry.semantic_equivalence_hash));
  if (tieHashes.size > 1) throw new Error("CAP05_FORECAST_RESIDUAL_LATEST_FORECAST_TIE_CONFLICT");
  const winner = tied[0];
  for (const candidate of tied.slice(1)) {
    candidate.entry = {
      ...candidate.entry,
      disposition: "EQUIVALENT_TIE_NOT_SELECTED",
      reason_code: "SEMANTICALLY_EQUIVALENT_OBJECT_ID_TIE_BREAK",
    };
  }
  for (const candidate of eligible.filter((candidate) => candidate.entry.forecast_issued_at !== latestIssuedAt)) {
    candidate.entry = {
      ...candidate.entry,
      disposition: "EXCLUDED_NOT_HISTORICAL",
      reason_code: "OLDER_MATCHING_FORECAST_SUPERSEDED_BY_LATEST_ISSUANCE",
    };
  }

  if (!winner.payload || !winner.point) throw new Error("CAP05_FORECAST_SELECTOR_INTERNAL_WINNER_INCOMPLETE");
  const entries = classified.map((candidate) => candidate.entry).sort((left, right) =>
    right.forecast_issued_at.localeCompare(left.forecast_issued_at)
      || left.forecast_run_ref.localeCompare(right.forecast_run_ref));
  const traceWithoutDigest: Omit<Cap05HistoricalForecastSelectionTraceV1, "semantic_digest"> = {
    selector_id: CAP05_HISTORICAL_FORECAST_SELECTOR_ID_V1,
    matching_policy_id: CAP05_FORECAST_RESIDUAL_MATCHING_POLICY_ID_V1,
    matching_policy_version: CAP05_FORECAST_RESIDUAL_MATCHING_POLICY_VERSION_V1,
    tie_policy_id: CAP05_HISTORICAL_FORECAST_TIE_POLICY_ID_V1,
    source_posterior_action_feedback_policy_id: CAP05_SOURCE_POSTERIOR_ACTION_FEEDBACK_POLICY_ID_V1,
    observation_target_time: targetTime,
    observation_available_to_runtime_at: availableAt,
    candidate_count: input.candidates.length,
    selected_forecast_run_ref: winner.candidate.forecast.object_id,
    selected_forecast_point_ref: winner.entry.forecast_point_ref,
    entries,
  };
  return {
    forecast: structuredClone(winner.candidate.forecast),
    payload: structuredClone(winner.payload),
    point: structuredClone(winner.point),
    forecast_point_ref: requiredStringV1(winner.entry.forecast_point_ref, "CAP05_FORECAST_SELECTOR_POINT_REF_REQUIRED"),
    source_posterior_action_feedback_refs: uniqueSortedV1(winner.candidate.source_posterior_action_feedback_refs),
    trace: { ...traceWithoutDigest, semantic_digest: traceDigestV1(traceWithoutDigest) },
  };
}
