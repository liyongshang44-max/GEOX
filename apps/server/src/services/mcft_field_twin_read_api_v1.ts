// Purpose: orchestrate the canonical MCFT-CAP-07 S4 GET-only Runtime API from S2 snapshot repositories and S3 composers.
// Boundary: read orchestration only; no DDL/DML, canonical/projection writers, recommendation, approval, AO-ACT, dispatch, or model activation authority.

import type { Pool } from "pg";
import {
  ActionLifecycleComposerV1,
  BoundedCollectionPageComposerV1,
  CurrentRuntimeComposerV1,
  FIELD_TWIN_EMPTY_COLLECTION_FILTER_V1,
  FieldTwinTimelineComposerV1,
  FieldTwinTraceGraphComposerV1,
  ModelGovernanceComposerV1,
  buildEmptyCollectionFilterHashV1,
  buildScopeHashV1,
  buildTimelineFilterHashV1,
  canonicalUtcInstantV1,
  canonicalizeTimelineFilterV1,
  verifyFieldTwinCursorV1,
  type FieldTwinCanonicalObjectRefV1,
  type FieldTwinCollectionAttachmentV1,
  type FieldTwinCollectionItemV1,
  type FieldTwinCollectionKindV1,
  type FieldTwinCursorPayloadV1,
  type FieldTwinModelGovernanceActivationRelationV1,
  type FieldTwinModelGovernanceCandidateV1,
  type FieldTwinOptionalCollectionSummaryV1,
  type FieldTwinScopeV1,
  type FieldTwinTimelineFilterV1,
  type FieldTwinTraceEdgeV1,
  type FieldTwinTraceNodeV1,
  type MinimalFieldTwinRuntimeReadModelV1,
  type SemanticHashTextV1,
} from "../domain/field_twin_read_model/index.js";
import { canonicalObjectRefV1, type FieldTwinComposerObjectV1 } from "../domain/field_twin_read_model/composer_contracts_v1.js";
import { semanticHashV1 } from "../domain/twin_runtime/canonical_json_v1.js";
import type { CanonicalObjectEnvelopeV1 } from "../domain/twin_runtime/canonical_object_contracts_v1.js";
import { decodeUntrustedFieldTwinCursorEnvelopeV1 } from "./mcft_field_twin_cursor_transport_v1.js";
import { S4RuntimeHealthComposerV1 } from "./mcft_field_twin_s4_health_composer_v1.js";
import {
  MCFT_COLLECTION_SOURCE_SPECS_V1,
  PostgresFieldTwinS4RepositoryV1,
  type McftCollectionSourceSpecV1,
  type ResolvedRuntimeRootV1,
} from "../repositories/field_twin_read_model/postgres_field_twin_s4_repository_v1.js";
import { PostgresFieldTwinSnapshotRepositoryV1, type PostgresFieldTwinSnapshotContextV1 } from "../repositories/field_twin_read_model/postgres_field_twin_snapshot_repository_v1.js";

export type McftFieldTwinReadRequestV1 = {
  scope: FieldTwinScopeV1;
  cursor?: string | null;
  limit?: number;
  from_logical_time?: string | null;
  until_logical_time?: string | null;
  collection_kind?: FieldTwinCollectionKindV1 | null;
  root_object_ref?: string | null;
};

export interface McftFieldTwinReadApiV1 {
  readRuntime(request: McftFieldTwinReadRequestV1): Promise<Record<string, unknown>>;
  readTimeline(request: McftFieldTwinReadRequestV1): Promise<Record<string, unknown>>;
  readTrace(request: McftFieldTwinReadRequestV1): Promise<Record<string, unknown>>;
  readStates(request: McftFieldTwinReadRequestV1): Promise<Record<string, unknown>>;
  readForecasts(request: McftFieldTwinReadRequestV1): Promise<Record<string, unknown>>;
  readScenarios(request: McftFieldTwinReadRequestV1): Promise<Record<string, unknown>>;
  readResiduals(request: McftFieldTwinReadRequestV1): Promise<Record<string, unknown>>;
  readActionLifecycle(request: McftFieldTwinReadRequestV1): Promise<Record<string, unknown>>;
  readModelGovernance(request: McftFieldTwinReadRequestV1): Promise<Record<string, unknown>>;
  readHealth(request: McftFieldTwinReadRequestV1): Promise<Record<string, unknown>>;
}

export class McftFieldTwinReadApiErrorV1 extends Error {
  constructor(readonly code: string, readonly statusCode: 400 | 403 | 404 | 409 | 503, detail?: string) {
    super(detail ? `${code}:${detail}` : code);
    this.name = "McftFieldTwinReadApiErrorV1";
  }
}

type CursorSigningMaterialV1 = { keys: Readonly<Record<string, string>>; primary_key_id: string; primary_key: string };
type CollectionReadV1 = { spec: McftCollectionSourceSpecV1; endpoint_suffix: string };
type ExactCanonicalObjectReadV1 = Awaited<ReturnType<PostgresFieldTwinS4RepositoryV1["readExactObjectByRef"]>>;

function signingMaterialV1(): CursorSigningMaterialV1 {
  const raw = String(process.env.MCFT_CURSOR_SIGNING_KEYS_JSON ?? "").trim();
  if (!raw) throw new McftFieldTwinReadApiErrorV1("MCFT_CURSOR_SIGNING_KEY_UNAVAILABLE", 503);
  let parsed: Record<string, unknown>;
  try { parsed = JSON.parse(raw) as Record<string, unknown>; } catch { throw new McftFieldTwinReadApiErrorV1("MCFT_CURSOR_SIGNING_KEY_UNAVAILABLE", 503); }
  const keys = Object.fromEntries(Object.entries(parsed).filter((entry): entry is [string, string] => Boolean(entry[0]) && typeof entry[1] === "string" && entry[1].length >= 32));
  const keyIds = Object.keys(keys).sort();
  if (keyIds.length === 0) throw new McftFieldTwinReadApiErrorV1("MCFT_CURSOR_SIGNING_KEY_UNAVAILABLE", 503);
  const primaryKeyId = String(process.env.MCFT_CURSOR_PRIMARY_KEY_ID ?? "").trim() || keyIds[0];
  const primaryKey = keys[primaryKeyId];
  if (!primaryKey) throw new McftFieldTwinReadApiErrorV1("MCFT_CURSOR_SIGNING_KEY_UNAVAILABLE", 503);
  return { keys, primary_key_id: primaryKeyId, primary_key: primaryKey };
}

function requestNowV1(): ReturnType<typeof canonicalUtcInstantV1> { return canonicalUtcInstantV1(new Date().toISOString()); }
function exactTextV1(value: unknown, code: string): string {
  if (typeof value !== "string" || !value.trim()) throw new McftFieldTwinReadApiErrorV1(code, 409);
  return value;
}
function payloadRecordV1(object: CanonicalObjectEnvelopeV1, code: string): Record<string, unknown> {
  if (!object.payload || typeof object.payload !== "object" || Array.isArray(object.payload)) throw new McftFieldTwinReadApiErrorV1(code, 409);
  return object.payload as Record<string, unknown>;
}
function optionalAttachmentV1(object: FieldTwinComposerObjectV1 | null, reasonCode: string): FieldTwinCollectionAttachmentV1<FieldTwinCanonicalObjectRefV1> {
  return object ? { attachment_status: "ATTACHED_EXACT", reason_code: null, item: canonicalObjectRefV1(object) } : { attachment_status: "ABSENT_OPTIONAL_DOMAIN", reason_code: reasonCode, item: null };
}
function detachedAttachmentV1(reasonCode: string): FieldTwinCollectionAttachmentV1<FieldTwinCanonicalObjectRefV1> {
  return { attachment_status: "NOT_ATTACHED_TO_CURRENT_RUNTIME_GRAPH", reason_code: reasonCode, item: null };
}
function notComputedSummaryV1(spec: McftCollectionSourceSpecV1, latestItem: FieldTwinCollectionItemV1 | null): FieldTwinOptionalCollectionSummaryV1 {
  return { collection_kind: spec.collection_kind, attachment_status: latestItem ? "ATTACHED_EXACT" : "ABSENT_OPTIONAL_DOMAIN", reason_code: latestItem ? null : "NO_VISIBLE_ITEMS_IN_SCOPE", has_items: latestItem !== null, count_status: "NOT_COMPUTED", total_count: null, latest_item_ref: latestItem?.object_ref ?? null, latest_item_hash: latestItem?.object_hash ?? null, collection_endpoint: spec.endpoint_suffix };
}
function collectionBoundaryV1(payload: FieldTwinCursorPayloadV1 | null): { logical_time: string; object_ref: string } | null {
  if (!payload) return null;
  if (payload.last_sort_tuple.cursor_kind !== "OPTIONAL_COLLECTION") throw new McftFieldTwinReadApiErrorV1("MCFT_CURSOR_INVALID", 400, "COLLECTION_BOUNDARY");
  return { logical_time: payload.last_sort_tuple.logical_time, object_ref: payload.last_sort_tuple.object_ref };
}
function timelineBoundaryV1(payload: FieldTwinCursorPayloadV1 | null): { logical_time: string; event_rank: number; object_ref: string } | null {
  if (!payload) return null;
  if (payload.last_sort_tuple.cursor_kind !== "TIMELINE") throw new McftFieldTwinReadApiErrorV1("MCFT_CURSOR_INVALID", 400, "TIMELINE_BOUNDARY");
  return { logical_time: payload.last_sort_tuple.logical_time, event_rank: payload.last_sort_tuple.event_rank, object_ref: payload.last_sort_tuple.object_ref };
}
function timelineFilterForRequestV1(request: McftFieldTwinReadRequestV1): FieldTwinTimelineFilterV1 {
  return canonicalizeTimelineFilterV1({ from_logical_time: request.from_logical_time ?? null, until_logical_time: request.until_logical_time ?? null });
}
function collectionReadV1(kind: FieldTwinCollectionKindV1): CollectionReadV1 {
  const spec = MCFT_COLLECTION_SOURCE_SPECS_V1[kind];
  if (!spec) throw new McftFieldTwinReadApiErrorV1("MCFT_CURSOR_COLLECTION_KIND_MISMATCH", 400, kind);
  return { spec, endpoint_suffix: spec.endpoint_suffix };
}
function collectionVisibilityContextV1(context: PostgresFieldTwinSnapshotContextV1, kind: FieldTwinCollectionKindV1): { fixed_root_ref: string; fixed_root_graph_content_hash: SemanticHashTextV1 } {
  const semantic = { schema_version: "field_twin_collection_visibility_context_v1", collection_kind: kind, scope_hash: buildScopeHashV1(context.scope), visibility_snapshot_hash: context.canonical_visibility_snapshot.visibility_snapshot_hash };
  const hash = semanticHashV1(semantic) as SemanticHashTextV1;
  return { fixed_root_ref: `collection-visibility:${kind}:${hash}`, fixed_root_graph_content_hash: hash };
}
function collectionItemFromExactV1(value: ExactCanonicalObjectReadV1): FieldTwinCollectionItemV1 {
  if (!value.object.logical_time) throw new McftFieldTwinReadApiErrorV1("MCFT_COLLECTION_LOGICAL_TIME_INVALID", 409, value.object.object_ref);
  return { object_ref: value.object.object_ref, object_type: value.object.object_type, object_hash: value.object.object_hash, logical_time: value.object.logical_time, attachment_status: "ATTACHED_EXACT" };
}

export class PostgresMcftFieldTwinReadApiV1 implements McftFieldTwinReadApiV1 {
  private readonly snapshots: PostgresFieldTwinSnapshotRepositoryV1;
  private readonly repository = new PostgresFieldTwinS4RepositoryV1();
  private readonly currentRuntimeComposer = new CurrentRuntimeComposerV1();
  private readonly timelineComposer = new FieldTwinTimelineComposerV1();
  private readonly collectionComposer = new BoundedCollectionPageComposerV1();
  private readonly traceComposer = new FieldTwinTraceGraphComposerV1();
  private readonly actionComposer = new ActionLifecycleComposerV1();
  private readonly governanceComposer = new ModelGovernanceComposerV1();
  private readonly healthComposer = new S4RuntimeHealthComposerV1();

  constructor(pool: Pool) { this.snapshots = new PostgresFieldTwinSnapshotRepositoryV1(pool); }

  private async collectionSummaryV1(context: PostgresFieldTwinSnapshotContextV1, kind: FieldTwinCollectionKindV1): Promise<FieldTwinOptionalCollectionSummaryV1> {
    const spec = MCFT_COLLECTION_SOURCE_SPECS_V1[kind];
    const summary = await this.repository.readCollectionSummary(context, spec);
    return notComputedSummaryV1(spec, summary.latest_item);
  }

  private assertCompletedScenarioSourceForecastV1(forecast: ExactCanonicalObjectReadV1): void {
    const payload = payloadRecordV1(forecast.payload, "MCFT_SCENARIO_FORECAST_POINTER_INVALID");
    if (payload.status !== "COMPLETED" || payload.point_count !== 72) throw new McftFieldTwinReadApiErrorV1("MCFT_SCENARIO_FORECAST_POINTER_INVALID", 409, "SOURCE_FORECAST_NOT_COMPLETED_72");
  }

  private async composeRuntimeV1(context: PostgresFieldTwinSnapshotContextV1, root: ResolvedRuntimeRootV1): Promise<MinimalFieldTwinRuntimeReadModelV1> {
    const [latestSuccessfulForecast, latestScenario, actionFeedbackSummary, residualSummary, candidateSummary, evaluationSummary, activationSummary] = await Promise.all([
      this.repository.readOptionalScopePointerObject(context, { relation: "public.twin_forecast_success_latest_index_v1", ref_column: "forecast_object_id", hash_column: "determinism_hash", expected_type: "twin_forecast_run_v1" }),
      this.repository.readOptionalScopePointerObject(context, { relation: "public.twin_scenario_latest_index_v1", ref_column: "scenario_set_id", hash_column: "determinism_hash", expected_type: "twin_scenario_set_v1" }),
      this.collectionSummaryV1(context, "ACTION_FEEDBACK"), this.collectionSummaryV1(context, "FORECAST_RESIDUAL"), this.collectionSummaryV1(context, "CALIBRATION_CANDIDATE"), this.collectionSummaryV1(context, "SHADOW_EVALUATION"), this.collectionSummaryV1(context, "MODEL_ACTIVATION"),
    ]);
    let scenarioSourceForecast: ExactCanonicalObjectReadV1 | null = null;
    let currentScenario: FieldTwinCollectionAttachmentV1<FieldTwinCanonicalObjectRefV1> = optionalAttachmentV1(null, "NO_SCENARIO_ATTACHED_TO_CURRENT_RUNTIME");
    let decision: Awaited<ReturnType<PostgresFieldTwinS4RepositoryV1["readDecisionForScenario"]>> | null = null;
    let approvedPlan: Awaited<ReturnType<PostgresFieldTwinS4RepositoryV1["readApprovedPlanForDecision"]>> | null = null;
    if (latestScenario) {
      const scenarioPayload = payloadRecordV1(latestScenario.payload, "MCFT_SCENARIO_FORECAST_POINTER_INVALID");
      const sourceForecastRef = exactTextV1(scenarioPayload.source_forecast_ref, "MCFT_SCENARIO_FORECAST_POINTER_INVALID");
      const sourceForecastHash = exactTextV1(scenarioPayload.source_forecast_hash, "MCFT_SCENARIO_FORECAST_POINTER_INVALID") as SemanticHashTextV1;
      scenarioSourceForecast = await this.repository.readExactObjectByRef(context, sourceForecastRef, "twin_forecast_run_v1");
      if (sourceForecastHash !== scenarioSourceForecast.object.object_hash) throw new McftFieldTwinReadApiErrorV1("MCFT_SCENARIO_FORECAST_POINTER_INVALID", 409, "HASH");
      this.assertCompletedScenarioSourceForecastV1(scenarioSourceForecast);
      const attachedToCurrent = sourceForecastRef === root.current_tick_forecast_result.object_ref && sourceForecastHash === root.current_tick_forecast_result.object_hash;
      if (attachedToCurrent) {
        currentScenario = optionalAttachmentV1(latestScenario.object, "NO_SCENARIO_ATTACHED_TO_CURRENT_RUNTIME");
        decision = await this.repository.readDecisionForScenario(context, latestScenario.object.object_ref, latestScenario.object.object_hash);
        if (decision) approvedPlan = await this.repository.readApprovedPlanForDecision(context, decision.payload);
      } else {
        const currentPayload = payloadRecordV1(root.canonical_payloads_by_ref.get(root.current_tick_forecast_result.object_ref)!, "MCFT_CURRENT_TICK_FORECAST_INVALID");
        currentScenario = detachedAttachmentV1(currentPayload.status === "BLOCKED" ? "CURRENT_FORECAST_BLOCKED" : "SCENARIO_SOURCE_FORECAST_NOT_CURRENT_TICK");
      }
    }
    const validationSummary = [
      ...root.validation_summary,
      ...(latestSuccessfulForecast ? [latestSuccessfulForecast.validation] : []),
      ...(latestScenario ? [latestScenario.validation] : []),
      ...(scenarioSourceForecast ? [scenarioSourceForecast.validation] : []),
      ...(decision ? [decision.validation] : []),
      ...(approvedPlan ? [approvedPlan.validation] : []),
    ];
    return this.currentRuntimeComposer.compose({
      request_scope: context.scope, response_started_at: context.response_started_at, root_graph_status: "COMPLETE_EXACT_GRAPH", active_lineage: root.active_lineage, active_lineage_authority_validation: root.active_lineage_authority_validation, checkpoint: root.checkpoint, runtime_tick: root.runtime_tick, evidence_window: root.evidence_window, state_transition: root.state_transition, assimilation_update: root.assimilation_update, posterior_state: root.posterior_state, terminal_record_set_health: root.terminal_record_set_health, runtime_config: root.runtime_config, record_set_validation: root.record_set_validation, current_tick_forecast_result: root.current_tick_forecast_result,
      latest_successful_forecast: optionalAttachmentV1(latestSuccessfulForecast?.object ?? null, "NO_SUCCESSFUL_FORECAST_IN_SCOPE"), scenario_source_forecast: optionalAttachmentV1(scenarioSourceForecast?.object ?? null, "NO_SCENARIO_SOURCE_FORECAST_IN_SCOPE"), current_scenario_attachment: currentScenario, latest_scenario_in_scope: optionalAttachmentV1(latestScenario?.object ?? null, "NO_SCENARIO_IN_SCOPE"), current_human_decision: optionalAttachmentV1(decision?.object ?? null, "NO_HUMAN_DECISION_ATTACHED_TO_CURRENT_RUNTIME"), current_approved_plan: optionalAttachmentV1(approvedPlan?.object ?? null, "NO_APPROVED_PLAN_ATTACHED_TO_CURRENT_RUNTIME"), action_feedback_summary: actionFeedbackSummary, forecast_residual_summary: residualSummary, calibration_candidate_summary: candidateSummary, shadow_evaluation_summary: evaluationSummary, model_activation_summary: activationSummary, limitations: [], validation_summary: validationSummary,
    });
  }

  private verifyTimelineCursorV1(request: McftFieldTwinReadRequestV1, filter: FieldTwinTimelineFilterV1, limit: number, signing: CursorSigningMaterialV1): FieldTwinCursorPayloadV1 | null {
    if (!request.cursor) return null;
    const decoded = decodeUntrustedFieldTwinCursorEnvelopeV1(request.cursor).payload;
    return verifyFieldTwinCursorV1(request.cursor, { scope_hash: buildScopeHashV1(request.scope), filter_hash: buildTimelineFilterHashV1(filter), database_visibility_epoch_id: decoded.canonical_visibility_snapshot.database_visibility_epoch_id, fixed_root_ref: decoded.fixed_root_ref, fixed_root_graph_content_hash: decoded.fixed_root_graph_content_hash, cursor_kind: "TIMELINE", collection_kind: null, page_limit: limit, now: requestNowV1(), signing_keys: signing.keys }).payload;
  }
  private verifyCollectionCursorV1(request: McftFieldTwinReadRequestV1, kind: FieldTwinCollectionKindV1, limit: number, signing: CursorSigningMaterialV1): FieldTwinCursorPayloadV1 | null {
    if (!request.cursor) return null;
    const decoded = decodeUntrustedFieldTwinCursorEnvelopeV1(request.cursor).payload;
    return verifyFieldTwinCursorV1(request.cursor, { scope_hash: buildScopeHashV1(request.scope), filter_hash: buildEmptyCollectionFilterHashV1(), database_visibility_epoch_id: decoded.canonical_visibility_snapshot.database_visibility_epoch_id, fixed_root_ref: decoded.fixed_root_ref, fixed_root_graph_content_hash: decoded.fixed_root_graph_content_hash, cursor_kind: "OPTIONAL_COLLECTION", collection_kind: kind, page_limit: limit, now: requestNowV1(), signing_keys: signing.keys }).payload;
  }

  async readRuntime(request: McftFieldTwinReadRequestV1): Promise<Record<string, unknown>> {
    return this.snapshots.withReadOnlyRequestSnapshot(request.scope, async (context) => this.composeRuntimeV1(context, await this.repository.resolveCurrentRuntimeRoot(context)) as unknown as Record<string, unknown>);
  }
  async readTimeline(request: McftFieldTwinReadRequestV1): Promise<Record<string, unknown>> {
    const signing = signingMaterialV1();
    const decoded = request.cursor ? decodeUntrustedFieldTwinCursorEnvelopeV1(request.cursor).payload : null;
    const limit = request.limit ?? decoded?.page_limit ?? 50;
    const filter = timelineFilterForRequestV1(request);
    const verified = this.verifyTimelineCursorV1(request, filter, limit, signing);
    const operation = async (context: PostgresFieldTwinSnapshotContextV1, continuation: FieldTwinCursorPayloadV1 | null) => {
      const root = continuation ? await this.repository.resolveHistoricalRuntimeRoot(context, continuation.fixed_root_ref) : await this.repository.resolveCurrentRuntimeRoot(context);
      const runtime = await this.composeRuntimeV1(context, root);
      if (continuation && (runtime.root_graph_content_hash !== continuation.fixed_root_graph_content_hash || root.root_ref !== continuation.fixed_root_ref)) throw new McftFieldTwinReadApiErrorV1("MCFT_RUNTIME_GRAPH_DIVERGENCE", 409);
      const events = await this.repository.readTimelineEvents(context, Math.min(limit + 1, 201), filter, timelineBoundaryV1(continuation));
      return this.timelineComposer.compose({ request_scope: context.scope, response_started_at: context.response_started_at, canonical_visibility_snapshot: context.canonical_visibility_snapshot, fixed_root_ref: root.root_ref, fixed_root_graph_content_hash: runtime.root_graph_content_hash, filter, visible_events: events, limit, verified_cursor_payload: continuation, cursor_signing: { key_id: signing.primary_key_id, key: signing.primary_key } }) as unknown as Record<string, unknown>;
    };
    if (!verified) return this.snapshots.withReadOnlyRequestSnapshot(request.scope, (context) => operation(context, null));
    return this.snapshots.withCursorContinuationTransaction({ scope: request.scope, signed_visibility_snapshot: verified.canonical_visibility_snapshot, operation: (context) => operation(context, verified) });
  }
  async readTrace(request: McftFieldTwinReadRequestV1): Promise<Record<string, unknown>> {
    return this.snapshots.withReadOnlyRequestSnapshot(request.scope, async (context) => {
      const root = request.root_object_ref ? await this.repository.resolveHistoricalRuntimeRoot(context, request.root_object_ref) : await this.repository.resolveCurrentRuntimeRoot(context);
      const nodes: FieldTwinTraceNodeV1[] = [...root.canonical_objects_by_ref.values()].map((object) => ({ node_id: `node:${object.object_ref}`, object_ref: object.object_ref, object_type: object.object_type, object_hash: object.object_hash, scope: object.scope, lineage_id: object.lineage_id, revision_id: object.revision_id, logical_time: object.logical_time, source_fact_ref: object.source_fact_ref, validation_profile: object.validation_profile, validation_status: object.validation_status }));
      const evidence = (object: FieldTwinComposerObjectV1) => [{ ref_type: "FACT", ref_value: object.source_fact_ref ?? object.object_ref }];
      const edges: FieldTwinTraceEdgeV1[] = [
        { edge_kind: "CHECKPOINT_TARGET", from_ref: root.active_lineage.object_ref, to_ref: root.checkpoint.object_ref, evidence_refs: evidence(root.checkpoint) }, { edge_kind: "TERMINAL_TICK_MEMBER", from_ref: root.checkpoint.object_ref, to_ref: root.runtime_tick.object_ref, evidence_refs: evidence(root.runtime_tick) }, { edge_kind: "EVIDENCE_FOR_TICK", from_ref: root.runtime_tick.object_ref, to_ref: root.evidence_window.object_ref, evidence_refs: evidence(root.evidence_window) }, { edge_kind: "TRANSITION_FOR_TICK", from_ref: root.runtime_tick.object_ref, to_ref: root.state_transition.object_ref, evidence_refs: evidence(root.state_transition) }, { edge_kind: "ASSIMILATION_FOR_TICK", from_ref: root.runtime_tick.object_ref, to_ref: root.assimilation_update.object_ref, evidence_refs: evidence(root.assimilation_update) }, { edge_kind: "POSTERIOR_FOR_TICK", from_ref: root.runtime_tick.object_ref, to_ref: root.posterior_state.object_ref, evidence_refs: evidence(root.posterior_state) }, { edge_kind: "FORECAST_FOR_TICK", from_ref: root.runtime_tick.object_ref, to_ref: root.current_tick_forecast_result.object_ref, evidence_refs: evidence(root.current_tick_forecast_result) }, { edge_kind: "HEALTH_FOR_TICK", from_ref: root.runtime_tick.object_ref, to_ref: root.terminal_record_set_health.object_ref, evidence_refs: evidence(root.terminal_record_set_health) }, { edge_kind: "CONFIG_USED_BY", from_ref: root.runtime_config.object_ref, to_ref: root.runtime_tick.object_ref, evidence_refs: evidence(root.runtime_config) },
      ];
      return this.traceComposer.compose({ request_scope: context.scope, response_started_at: context.response_started_at, nodes, exact_edges: edges, unattached_objects: [], missing_diagnostics: [], record_set_validation: root.record_set_validation, health_role_resolutions: [root.terminal_health_role_resolution], active_lineage_authority_validation: root.active_lineage_authority_validation }) as unknown as Record<string, unknown>;
    });
  }

  private async validateActionLifecycleV1(context: PostgresFieldTwinSnapshotContextV1, summary: FieldTwinOptionalCollectionSummaryV1): Promise<void> {
    if (!summary.latest_item_ref || !summary.latest_item_hash) {
      this.actionComposer.compose({ request_scope: context.scope, response_started_at: context.response_started_at, current_human_decision: optionalAttachmentV1(null, "NO_HUMAN_DECISION_IN_SCOPE"), current_approved_plan: optionalAttachmentV1(null, "NO_APPROVED_PLAN_IN_SCOPE"), action_feedback_summary: summary, exact_edges: [], limitations: [] });
      return;
    }
    const feedback = await this.repository.readExactObjectByRef(context, summary.latest_item_ref, "twin_action_feedback_v1");
    if (feedback.object.object_hash !== summary.latest_item_hash) throw new McftFieldTwinReadApiErrorV1("MCFT_ACTION_FEEDBACK_POINTER_INVALID", 409, "HASH");
    const payload = payloadRecordV1(feedback.payload, "MCFT_ACTION_FEEDBACK_POINTER_INVALID");
    const decisionRef = exactTextV1(payload.decision_ref, "MCFT_ACTION_FEEDBACK_POINTER_INVALID");
    const decisionHash = exactTextV1(payload.decision_hash, "MCFT_ACTION_FEEDBACK_POINTER_INVALID") as SemanticHashTextV1;
    const planRef = exactTextV1(payload.approved_plan_evidence_ref, "MCFT_ACTION_FEEDBACK_POINTER_INVALID");
    const planHash = exactTextV1(payload.approved_plan_evidence_hash, "MCFT_ACTION_FEEDBACK_POINTER_INVALID") as SemanticHashTextV1;
    const decision = await this.repository.readExactObjectByRef(context, decisionRef, "twin_decision_record_v1");
    if (decision.object.object_hash !== decisionHash) throw new McftFieldTwinReadApiErrorV1("MCFT_ACTION_FEEDBACK_POINTER_INVALID", 409, "DECISION_HASH");
    const plan = await this.repository.readReplayEvidenceBySourceRef(context, planRef, planHash);
    this.actionComposer.compose({
      request_scope: context.scope,
      response_started_at: context.response_started_at,
      current_human_decision: optionalAttachmentV1(decision.object, "NO_HUMAN_DECISION_IN_SCOPE"),
      current_approved_plan: optionalAttachmentV1(plan.object, "NO_APPROVED_PLAN_IN_SCOPE"),
      action_feedback_summary: summary,
      exact_edges: [
        { edge_kind: "DECISION_BOUND_TO_PLAN", from_ref: decision.object.object_ref, to_ref: plan.object.object_ref, evidence_refs: [{ ref_type: "PLAN_BINDING", ref_value: plan.object.source_fact_ref ?? plan.object.object_ref }] },
        { edge_kind: "PLAN_EXECUTED_BY_FEEDBACK", from_ref: plan.object.object_ref, to_ref: feedback.object.object_ref, evidence_refs: [{ ref_type: "ACTION_FEEDBACK", ref_value: feedback.object.source_fact_ref ?? feedback.object.object_ref }] },
      ],
      limitations: [],
    });
  }

  private async exactItemForSummaryV1(context: PostgresFieldTwinSnapshotContextV1, summary: FieldTwinOptionalCollectionSummaryV1, expectedType: string): Promise<ExactCanonicalObjectReadV1 | null> {
    if (!summary.latest_item_ref || !summary.latest_item_hash) return null;
    const value = await this.repository.readExactObjectByRef(context, summary.latest_item_ref, expectedType);
    if (value.object.object_hash !== summary.latest_item_hash) throw new McftFieldTwinReadApiErrorV1("MCFT_MODEL_GOVERNANCE_ITEM_INVALID", 409, expectedType);
    return value;
  }

  private async validateModelGovernanceV1(context: PostgresFieldTwinSnapshotContextV1): Promise<void> {
    const [candidateSummary, evaluationSummary, activationSummary] = await Promise.all([
      this.collectionSummaryV1(context, "CALIBRATION_CANDIDATE"),
      this.collectionSummaryV1(context, "SHADOW_EVALUATION"),
      this.collectionSummaryV1(context, "MODEL_ACTIVATION"),
    ]);
    let candidate = await this.exactItemForSummaryV1(context, candidateSummary, "twin_calibration_candidate_v1");
    let evaluation = await this.exactItemForSummaryV1(context, evaluationSummary, "twin_shadow_evaluation_v1");
    const activation = await this.exactItemForSummaryV1(context, activationSummary, "twin_model_activation_v1");
    let relation: FieldTwinModelGovernanceActivationRelationV1 | null = null;
    const exactAvailableRefs: string[] = [];
    if (activation) {
      const payload = payloadRecordV1(activation.payload, "MCFT_MODEL_ACTIVATION_CHAIN_INCOMPLETE");
      const candidateRef = exactTextV1(payload.candidate_ref, "MCFT_MODEL_ACTIVATION_CHAIN_INCOMPLETE");
      const evaluationRef = exactTextV1(payload.evaluation_ref, "MCFT_MODEL_ACTIVATION_CHAIN_INCOMPLETE");
      const runtimeConfigRef = exactTextV1(payload.activated_runtime_config_ref ?? payload.runtime_config_ref, "MCFT_MODEL_ACTIVATION_CHAIN_INCOMPLETE");
      const activeLineageRef = exactTextV1(payload.active_lineage_ref, "MCFT_MODEL_ACTIVATION_CHAIN_INCOMPLETE");
      const activeRevisionRef = typeof payload.active_revision_ref === "string" && payload.active_revision_ref ? payload.active_revision_ref : null;
      candidate = await this.repository.readExactObjectByRef(context, candidateRef, "twin_calibration_candidate_v1");
      evaluation = await this.repository.readExactObjectByRef(context, evaluationRef, "twin_shadow_evaluation_v1");
      const runtimeConfig = await this.repository.readExactObjectByRef(context, runtimeConfigRef, "twin_runtime_config_v1");
      const lineage = await this.repository.readExactObjectByRef(context, activeLineageRef, "twin_runtime_lineage_v1");
      if (activeRevisionRef) await this.repository.readExactObjectByRef(context, activeRevisionRef, "twin_revision_run_v1");
      relation = { activation: collectionItemFromExactV1(activation), candidate_ref: candidateRef, evaluation_ref: evaluationRef, activated_runtime_config_ref: runtimeConfigRef, active_lineage_ref: activeLineageRef, active_revision_ref: activeRevisionRef, relation_evidence_refs: [{ ref_type: "MODEL_ACTIVATION", ref_value: activation.object.source_fact_ref ?? activation.object.object_ref }] };
      exactAvailableRefs.push(activation.object.object_ref, candidateRef, evaluationRef, runtimeConfig.object.object_ref, lineage.object.object_ref, ...(activeRevisionRef ? [activeRevisionRef] : []));
    }
    const candidateItems: FieldTwinModelGovernanceCandidateV1[] = candidate ? [{ ...collectionItemFromExactV1(candidate), activation_status: "NOT_ACTIVE", eligible_for_state_input: false, eligible_for_runtime_config_use: false }] : [];
    this.governanceComposer.compose({
      database_profile: "PROFILE_A_RUNTIME",
      request_scope: context.scope,
      response_started_at: context.response_started_at,
      calibration_candidates: candidateItems,
      shadow_evaluations: evaluation ? [collectionItemFromExactV1(evaluation)] : [],
      model_activations: activation ? [collectionItemFromExactV1(activation)] : [],
      calibration_candidate_summary: candidateSummary,
      shadow_evaluation_summary: evaluationSummary,
      model_activation_summary: activationSummary,
      attached_activation_relation: relation,
      exact_available_refs: exactAvailableRefs.length ? exactAvailableRefs : [
        ...candidateItems.map((item) => item.object_ref),
        ...(evaluation ? [evaluation.object.object_ref] : []),
      ],
      limitations: [],
    });
  }

  private async readCollectionV1(request: McftFieldTwinReadRequestV1, kind: FieldTwinCollectionKindV1): Promise<Record<string, unknown>> {
    const signing = signingMaterialV1();
    const decoded = request.cursor ? decodeUntrustedFieldTwinCursorEnvelopeV1(request.cursor).payload : null;
    const limit = request.limit ?? decoded?.page_limit ?? 50;
    const verified = this.verifyCollectionCursorV1(request, kind, limit, signing);
    const collection = collectionReadV1(kind);
    const operation = async (context: PostgresFieldTwinSnapshotContextV1, continuation: FieldTwinCursorPayloadV1 | null) => {
      const fixed = collectionVisibilityContextV1(context, kind);
      if (continuation && (fixed.fixed_root_ref !== continuation.fixed_root_ref || fixed.fixed_root_graph_content_hash !== continuation.fixed_root_graph_content_hash)) throw new McftFieldTwinReadApiErrorV1("MCFT_CURSOR_VISIBILITY_SNAPSHOT_INVALID", 409);
      const items = await this.repository.readCollectionItems(context, collection.spec, Math.min(limit + 1, 201), collectionBoundaryV1(continuation));
      if (kind === "ACTION_FEEDBACK") await this.validateActionLifecycleV1(context, notComputedSummaryV1(collection.spec, (await this.repository.readCollectionSummary(context, collection.spec)).latest_item));
      if (["CALIBRATION_CANDIDATE", "SHADOW_EVALUATION", "MODEL_ACTIVATION"].includes(kind)) await this.validateModelGovernanceV1(context);
      return this.collectionComposer.compose({ endpoint_suffix: collection.endpoint_suffix, collection_kind: kind, request_scope: context.scope, response_started_at: context.response_started_at, canonical_visibility_snapshot: context.canonical_visibility_snapshot, fixed_root_ref: fixed.fixed_root_ref, fixed_root_graph_content_hash: fixed.fixed_root_graph_content_hash, visible_items: items, limit, verified_cursor_payload: continuation, cursor_signing: { key_id: signing.primary_key_id, key: signing.primary_key } }) as unknown as Record<string, unknown>;
    };
    if (!verified) return this.snapshots.withReadOnlyRequestSnapshot(request.scope, (context) => operation(context, null));
    return this.snapshots.withCursorContinuationTransaction({ scope: request.scope, signed_visibility_snapshot: verified.canonical_visibility_snapshot, operation: (context) => operation(context, verified) });
  }
  readStates(request: McftFieldTwinReadRequestV1): Promise<Record<string, unknown>> { return this.readCollectionV1(request, "STATE"); }
  readForecasts(request: McftFieldTwinReadRequestV1): Promise<Record<string, unknown>> { return this.readCollectionV1(request, "FORECAST"); }
  readScenarios(request: McftFieldTwinReadRequestV1): Promise<Record<string, unknown>> { return this.readCollectionV1(request, "SCENARIO"); }
  readResiduals(request: McftFieldTwinReadRequestV1): Promise<Record<string, unknown>> { return this.readCollectionV1(request, "FORECAST_RESIDUAL"); }
  readActionLifecycle(request: McftFieldTwinReadRequestV1): Promise<Record<string, unknown>> { return this.readCollectionV1(request, "ACTION_FEEDBACK"); }
  readModelGovernance(request: McftFieldTwinReadRequestV1): Promise<Record<string, unknown>> {
    if (!request.collection_kind || !["CALIBRATION_CANDIDATE", "SHADOW_EVALUATION", "MODEL_ACTIVATION"].includes(request.collection_kind)) throw new McftFieldTwinReadApiErrorV1("MCFT_CURSOR_COLLECTION_KIND_MISMATCH", 400, "MODEL_GOVERNANCE_KIND_REQUIRED");
    return this.readCollectionV1(request, request.collection_kind);
  }
  async readHealth(request: McftFieldTwinReadRequestV1): Promise<Record<string, unknown>> {
    return this.snapshots.withReadOnlyRequestSnapshot(request.scope, async (context) => {
      const root = await this.repository.resolveCurrentRuntimeRoot(context);
      const latest = await this.repository.readLatestOperationalHealth(context, root);
      return this.healthComposer.compose({ request_scope: context.scope, response_started_at: context.response_started_at, terminal_record_set_health: root.terminal_record_set_health, terminal_role_resolution: root.terminal_health_role_resolution, latest_operational_runtime_health: latest.object, operational_role_resolution: latest.resolution, health_pointer_validation_summary: latest.validation ? [latest.validation] : [] }) as unknown as Record<string, unknown>;
    });
  }
}

export const MCFT_FIELD_TWIN_EMPTY_COLLECTION_FILTER_V1 = FIELD_TWIN_EMPTY_COLLECTION_FILTER_V1;
