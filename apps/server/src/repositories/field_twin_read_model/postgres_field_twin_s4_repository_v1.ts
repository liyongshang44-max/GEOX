// Purpose: provide corrected S4 collection, optional-attachment, Replay Evidence, and Timeline reads over the frozen S2 root repository.
// Boundary: SELECT-only PostgreSQL composition; no DDL/DML, root inference, canonical authority substitution, or write-capable dependency.

import {
  AggregateProjectionValidatorV1,
  EvidenceBindingValidatorV1,
  ReplayEvidenceFactResolverV1,
  RuntimeHealthRoleResolverV1,
  type FieldTwinCollectionItemV1,
  type FieldTwinRuntimeHealthRoleResolutionV1,
  type FieldTwinScopeV1,
  type FieldTwinSourceValidationResultV1,
  type FieldTwinTimelineEventV1,
  type SemanticHashTextV1,
} from "../../domain/field_twin_read_model/index.js";
import type { FieldTwinComposerObjectV1 } from "../../domain/field_twin_read_model/composer_contracts_v1.js";
import { canonicalUtcInstantV1 } from "../../domain/field_twin_read_model/cursor_contracts_v1.js";
import { FIELD_TWIN_TIMELINE_EVENT_RANKS_V1 } from "../../domain/field_twin_read_model/ordering_v1.js";
import { resolveMcftCap07S4SourceObligationV1 } from "../../domain/field_twin_read_model/s4_source_obligations_v1.js";
import { canonicalJsonV1 } from "../../domain/twin_runtime/canonical_json_v1.js";
import type { CanonicalObjectEnvelopeV1 } from "../../domain/twin_runtime/canonical_object_contracts_v1.js";
import {
  MCFT_COLLECTION_SOURCE_SPECS_V1,
  PostgresFieldTwinReadRepositoryErrorV1,
  PostgresFieldTwinReadRepositoryV1,
  type McftCollectionSourceSpecV1,
  type ResolvedRuntimeRootV1,
} from "./postgres_field_twin_read_repository_v1.js";
import type { PostgresFieldTwinSnapshotContextV1 } from "./postgres_field_twin_snapshot_repository_v1.js";

export { MCFT_COLLECTION_SOURCE_SPECS_V1 };
export type { McftCollectionSourceSpecV1, ResolvedRuntimeRootV1 };

type JsonRecord = Record<string, unknown>;
type ExactObjectV1 = Awaited<ReturnType<PostgresFieldTwinReadRepositoryV1["readExactObjectByRef"]>>;
export type ResolvedReplayEvidenceObjectV1 = {
  object: FieldTwinComposerObjectV1;
  canonical_payload: Readonly<JsonRecord>;
  validation: FieldTwinSourceValidationResultV1;
};

function fail(code: string, detail?: string): never {
  throw new PostgresFieldTwinReadRepositoryErrorV1(code, detail);
}
function record(value: unknown, code: string): JsonRecord {
  if (!value || typeof value !== "object" || Array.isArray(value)) fail(code);
  return value as JsonRecord;
}
function text(value: unknown, code: string): string {
  if (typeof value !== "string" || !value.trim()) fail(code);
  return value;
}
function optionalText(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value : null;
}
function instant(value: unknown, code: string): ReturnType<typeof canonicalUtcInstantV1> {
  const parsed = value instanceof Date ? value : new Date(String(value ?? ""));
  if (!Number.isFinite(parsed.getTime())) fail(code);
  return canonicalUtcInstantV1(parsed.toISOString());
}
function optionalInstant(value: unknown, code: string): ReturnType<typeof canonicalUtcInstantV1> | null {
  return value === null || value === undefined || value === "" ? null : instant(value, code);
}
function scopeValues(scope: FieldTwinScopeV1): readonly string[] {
  return [scope.tenant_id, scope.project_id, scope.group_id, scope.field_id, scope.season_id, scope.zone_id];
}
function assertScope(value: unknown, scope: FieldTwinScopeV1, code: string): void {
  const candidate = record(value, code);
  for (const key of ["tenant_id", "project_id", "group_id", "field_id", "season_id", "zone_id"] as const) if (candidate[key] !== scope[key]) fail(code, key);
}
function normalize(value: unknown): unknown {
  if (value instanceof Date) return value.toISOString();
  if (Array.isArray(value)) return value.map(normalize);
  if (value && typeof value === "object") return Object.fromEntries(Object.entries(value as JsonRecord).map(([key, item]) => [key, normalize(item)]));
  return value;
}
async function assertRelation(context: PostgresFieldTwinSnapshotContextV1, relation: string): Promise<void> {
  const result = await context.client.query<{ exists: boolean }>("SELECT pg_catalog.to_regclass($1) IS NOT NULL AS exists", [relation]);
  if (result.rows[0]?.exists !== true) fail("MCFT_REQUIRED_READ_SCHEMA_UNAVAILABLE", relation);
}

export class PostgresFieldTwinS4RepositoryV1 {
  private readonly base = new PostgresFieldTwinReadRepositoryV1();
  private readonly replay = new ReplayEvidenceFactResolverV1();
  private readonly projection = new AggregateProjectionValidatorV1();
  private readonly binding = new EvidenceBindingValidatorV1();
  private readonly health = new RuntimeHealthRoleResolverV1();

  resolveCurrentRuntimeRoot(context: PostgresFieldTwinSnapshotContextV1): Promise<ResolvedRuntimeRootV1> { return this.base.resolveCurrentRuntimeRoot(context); }
  resolveHistoricalRuntimeRoot(context: PostgresFieldTwinSnapshotContextV1, checkpointRef: string): Promise<ResolvedRuntimeRootV1> { return this.base.resolveHistoricalRuntimeRoot(context, checkpointRef); }
  readCollectionItems(context: PostgresFieldTwinSnapshotContextV1, spec: McftCollectionSourceSpecV1, limitPlusOne: number, boundary: { logical_time: string; object_ref: string } | null): Promise<readonly FieldTwinCollectionItemV1[]> { return this.base.readCollectionItems(context, spec, limitPlusOne, boundary); }
  readExactObjectByRef(context: PostgresFieldTwinSnapshotContextV1, objectRef: string, expectedType?: string): Promise<ExactObjectV1> { return this.base.readExactObjectByRef(context, objectRef, expectedType); }
  readOptionalScopePointerObject(context: PostgresFieldTwinSnapshotContextV1, input: { relation: string; ref_column: string; hash_column?: string | null; expected_type: string }): ReturnType<PostgresFieldTwinReadRepositoryV1["readOptionalScopePointerObject"]> { return this.base.readOptionalScopePointerObject(context, input); }
  readLatestOperationalHealth(context: PostgresFieldTwinSnapshotContextV1, root: ResolvedRuntimeRootV1): ReturnType<PostgresFieldTwinReadRepositoryV1["readLatestOperationalHealth"]> { return this.base.readLatestOperationalHealth(context, root); }

  async readCollectionSummary(context: PostgresFieldTwinSnapshotContextV1, spec: McftCollectionSourceSpecV1): Promise<{ latest_item: FieldTwinCollectionItemV1 | null }> {
    const items = await this.base.readCollectionItems(context, spec, 2, null);
    return { latest_item: items[0] ?? null };
  }

  private async visibleFactById(context: PostgresFieldTwinSnapshotContextV1, factId: string): Promise<{ fact_id: string; record_json: unknown } | null> {
    const result = await context.client.query<{ fact_id: string; record_json: unknown }>(
      `SELECT f.fact_id,f.record_json FROM public.facts f
       JOIN public.twin_fact_visibility_index_v1 visibility ON visibility.fact_id=f.fact_id
       WHERE visibility.visibility_epoch_id=$1 AND pg_catalog.pg_visible_in_snapshot(visibility.visibility_anchor_xid8,$2::pg_snapshot)
         AND f.fact_id=$3 LIMIT 2`,
      [context.canonical_visibility_snapshot.database_visibility_epoch_id, context.canonical_visibility_snapshot.pg_snapshot_token, factId],
    );
    if ((result.rowCount ?? 0) > 1) fail("MCFT_CANONICAL_FACT_ID_CARDINALITY_INVALID", factId);
    return result.rows[0] ?? null;
  }

  private resolveReplay(context: PostgresFieldTwinSnapshotContextV1, row: { fact_id: string; record_json: unknown }, expectedRef?: string | null, expectedHash?: SemanticHashTextV1 | null): ResolvedReplayEvidenceObjectV1 {
    const resolution = this.replay.resolve({ fact_id: row.fact_id, record_json: row.record_json, expected_type: "approved_irrigation_plan_snapshot_v1", expected_source_record_id: expectedRef ?? undefined, expected_source_record_hash: expectedHash ?? undefined });
    const envelope = record(row.record_json, "MCFT_DIRECT_REPLAY_EVIDENCE_INVALID:ENVELOPE");
    const payload = record(envelope.payload, "MCFT_DIRECT_REPLAY_EVIDENCE_INVALID:PAYLOAD");
    assertScope(payload, context.scope, "MCFT_DIRECT_REPLAY_EVIDENCE_INVALID:SCOPE");
    const object: FieldTwinComposerObjectV1 = Object.freeze({
      object_ref: resolution.source_record_id,
      object_type: resolution.record_type,
      object_hash: resolution.source_record_hash,
      source_fact_ref: resolution.fact_id,
      scope: Object.freeze({ ...context.scope }),
      lineage_id: null,
      revision_id: null,
      logical_time: instant(resolution.available_to_runtime_at, "MCFT_DIRECT_REPLAY_EVIDENCE_INVALID:AVAILABLE_TO_RUNTIME_AT"),
      source_refs: Object.freeze([{ ref_type: "SOURCE_RECORD", ref_value: resolution.source_record_id }]),
      evidence_refs: Object.freeze([{ ref_type: "FACT", ref_value: resolution.fact_id }]),
      validation_profile: "REPLAY_EVIDENCE_FACT_DIRECT",
      validation_status: "PASS",
      attachment_status: "ATTACHED_EXACT",
    });
    return { object, canonical_payload: resolution.canonical_payload, validation: { source_name: "public.facts#record_json.payload.record_type=approved_irrigation_plan_snapshot_v1", profile_family: "REPLAY_EVIDENCE_FACT_DIRECT", validation_status: "PASS", failure_code: null, validated_object_ref: resolution.source_record_id, validated_object_hash: resolution.source_record_hash, evidence_refs: [{ ref_type: "FACT", ref_value: resolution.fact_id }] } };
  }

  async readReplayEvidenceBySourceRef(context: PostgresFieldTwinSnapshotContextV1, sourceRecordRef: string, expectedHash?: SemanticHashTextV1 | null): Promise<ResolvedReplayEvidenceObjectV1> {
    const result = await context.client.query<{ fact_id: string; record_json: unknown }>(
      `SELECT f.fact_id,f.record_json FROM public.facts f
       JOIN public.twin_fact_visibility_index_v1 visibility ON visibility.fact_id=f.fact_id
       WHERE visibility.visibility_epoch_id=$1 AND pg_catalog.pg_visible_in_snapshot(visibility.visibility_anchor_xid8,$2::pg_snapshot)
         AND f.record_json->>'type'='approved_irrigation_plan_snapshot_v1' AND f.record_json->'payload'->>'source_record_id'=$3 LIMIT 2`,
      [context.canonical_visibility_snapshot.database_visibility_epoch_id, context.canonical_visibility_snapshot.pg_snapshot_token, sourceRecordRef],
    );
    if ((result.rowCount ?? 0) !== 1) fail("MCFT_DIRECT_REPLAY_EVIDENCE_INVALID", `SOURCE_REF_CARDINALITY:${sourceRecordRef}:${result.rowCount ?? 0}`);
    return this.resolveReplay(context, result.rows[0], sourceRecordRef, expectedHash ?? null);
  }

  async readDecisionForScenario(context: PostgresFieldTwinSnapshotContextV1, scenarioRef: string, scenarioHash: SemanticHashTextV1): Promise<ExactObjectV1 | null> {
    const relation = "public.twin_decision_record_projection_v1";
    await assertRelation(context, relation);
    const result = await context.client.query<{ row_json: JsonRecord }>(
      `SELECT to_jsonb(source_row) AS row_json FROM ${relation} source_row
       WHERE tenant_id=$1 AND project_id=$2 AND group_id=$3 AND field_id=$4 AND season_id=$5 AND zone_id=$6
         AND scenario_set_ref=$7 AND scenario_set_hash=$8 LIMIT 2`,
      [...scopeValues(context.scope), scenarioRef, scenarioHash],
    );
    if ((result.rowCount ?? 0) > 1) fail("MCFT_DECISION_AUTHORITY_CARDINALITY_INVALID", scenarioRef);
    if (!result.rows[0]) return null;
    const row = normalize(result.rows[0].row_json) as JsonRecord;
    const objectRef = text(row.decision_object_id, "MCFT_AGGREGATE_PROJECTION_CANONICAL_DIVERGENCE:DECISION_ID");
    const sourceFactId = text(row.source_fact_id, "MCFT_AGGREGATE_PROJECTION_CANONICAL_DIVERGENCE:SOURCE_FACT");
    const exact = await this.base.readExactObjectByRef(context, objectRef, "twin_decision_record_v1");
    if (exact.object.source_fact_ref !== sourceFactId) fail("MCFT_AGGREGATE_PROJECTION_CANONICAL_DIVERGENCE", "DECISION_SOURCE_FACT");
    const obligation = resolveMcftCap07S4SourceObligationV1(relation);
    const fact = await this.visibleFactById(context, sourceFactId);
    if (!fact) fail(obligation.failure_code, "SOURCE_FACT_MISSING");
    const validation = this.projection.validate({ obligation, projection_row: row, canonical_context: { record_json: record(fact.record_json, obligation.failure_code), facts: { fact_id: sourceFactId } } });
    return { ...exact, validation };
  }

  async readApprovedPlanForDecision(context: PostgresFieldTwinSnapshotContextV1, decision: CanonicalObjectEnvelopeV1): Promise<ResolvedReplayEvidenceObjectV1 | null> {
    const payload = record(decision.payload, "MCFT_EVIDENCE_BINDING_INVALID:DECISION_PAYLOAD");
    const selectedOptionRef = text(payload.selected_option_ref, "MCFT_EVIDENCE_BINDING_INVALID:SELECTED_OPTION_REF");
    const selectedOptionHash = text(payload.selected_option_hash, "MCFT_EVIDENCE_BINDING_INVALID:SELECTED_OPTION_HASH");
    const requestRef = text(payload.decision_request_evidence_ref, "MCFT_EVIDENCE_BINDING_INVALID:DECISION_REQUEST_REF");
    const requestHash = text(payload.decision_request_evidence_hash, "MCFT_EVIDENCE_BINDING_INVALID:DECISION_REQUEST_HASH");
    const relation = "public.twin_approved_plan_binding_projection_v1";
    await assertRelation(context, relation);
    const result = await context.client.query<{ row_json: JsonRecord }>(
      `SELECT to_jsonb(source_row) AS row_json FROM ${relation} source_row
       WHERE tenant_id=$1 AND project_id=$2 AND group_id=$3 AND field_id=$4 AND season_id=$5 AND zone_id=$6
         AND selected_option_ref=$7 AND selected_option_hash=$8 AND decision_request_ref=$9 AND decision_request_hash=$10 AND active_for_decision IS TRUE LIMIT 2`,
      [...scopeValues(context.scope), selectedOptionRef, selectedOptionHash, requestRef, requestHash],
    );
    if ((result.rowCount ?? 0) > 1) fail("MCFT_EVIDENCE_BINDING_INVALID", "ACTIVE_PLAN_CARDINALITY");
    if (!result.rows[0]) return null;
    const row = normalize(result.rows[0].row_json) as JsonRecord;
    const factId = text(row.source_fact_id, "MCFT_EVIDENCE_BINDING_INVALID:SOURCE_FACT");
    const fact = await this.visibleFactById(context, factId);
    if (!fact) fail("MCFT_EVIDENCE_BINDING_INVALID", "SOURCE_FACT_MISSING");
    const plan = this.resolveReplay(context, fact, text(row.approved_plan_evidence_ref, "MCFT_EVIDENCE_BINDING_INVALID:PLAN_REF"), text(row.approved_plan_evidence_hash, "MCFT_EVIDENCE_BINDING_INVALID:PLAN_HASH") as SemanticHashTextV1);
    for (const key of ["binding_id", "approval_assertion_ref", "approval_assertion_hash", "decision_request_ref", "decision_request_hash", "selected_option_ref", "selected_option_hash", "scenario_amount_mm", "approved_amount_mm", "plan_effective_from", "plan_effective_to", "active_for_decision"] as const) if (canonicalJsonV1(row[key]) !== canonicalJsonV1((plan.canonical_payload as JsonRecord)[key])) fail("MCFT_EVIDENCE_BINDING_INVALID", key);
    this.binding.validate({ declared_refs: [{ ref_type: "DECISION_REQUEST", ref_value: requestRef }, { ref_type: "SELECTED_OPTION", ref_value: selectedOptionRef }], resolved_refs: [{ ref_type: "DECISION_REQUEST", ref_value: text(plan.canonical_payload.decision_request_ref, "MCFT_EVIDENCE_BINDING_INVALID:DECISION_REQUEST_REF") }, { ref_type: "SELECTED_OPTION", ref_value: text(plan.canonical_payload.selected_option_ref, "MCFT_EVIDENCE_BINDING_INVALID:SELECTED_OPTION_REF") }], scope: context.scope, resolved_scope: context.scope });
    return plan;
  }

  private async recordSetMemberships(context: PostgresFieldTwinSnapshotContextV1, refs: readonly string[]): Promise<ReadonlyMap<string, { record_set_id: string; member_refs: readonly string[] }>> {
    if (refs.length === 0) return new Map();
    await assertRelation(context, "public.twin_runtime_record_set_identity_index_v1");
    const result = await context.client.query<{ record_set_id: string; member_object_ids: unknown }>(
      `SELECT record_set_id,member_object_ids FROM public.twin_runtime_record_set_identity_index_v1
       WHERE member_object_ids ?| $1::text[]`, [refs],
    );
    const map = new Map<string, { record_set_id: string; member_refs: readonly string[] }>();
    for (const row of result.rows) {
      const members = Array.isArray(row.member_object_ids) ? row.member_object_ids.map(String) : Object.keys(record(row.member_object_ids, "MCFT_RECORD_SET_IDENTITY_INVALID"));
      const checkpointCandidates: string[] = [];
      for (const ref of members) {
        try { const exact = await this.base.readExactObjectByRef(context, ref); if (exact.object.object_type === "twin_runtime_checkpoint_v1") checkpointCandidates.push(ref); } catch { /* validated below through root resolution */ }
      }
      if (checkpointCandidates.length !== 1) fail("MCFT_RECORD_SET_IDENTITY_INVALID", `CHECKPOINT_CARDINALITY:${row.record_set_id}`);
      const root = await this.base.resolveHistoricalRuntimeRoot(context, checkpointCandidates[0]);
      if (root.record_set_validation.record_set_id !== row.record_set_id) fail("MCFT_RECORD_SET_IDENTITY_INVALID", "RECORD_SET_ID");
      const membership = { record_set_id: row.record_set_id, member_refs: Object.freeze(root.record_set_validation.exact_member_refs.map((item) => item.object_ref)) };
      for (const ref of membership.member_refs) { if (map.has(ref)) fail("MCFT_RECORD_SET_IDENTITY_INVALID", `MULTIPLE_MEMBERSHIP:${ref}`); map.set(ref, membership); }
    }
    return map;
  }

  async readTimelineEvents(context: PostgresFieldTwinSnapshotContextV1, limitPlusOne: number, filter: { from_logical_time: string | null; until_logical_time: string | null }, boundary: { logical_time: string; event_rank: number; object_ref: string } | null): Promise<readonly FieldTwinTimelineEventV1[]> {
    if (!Number.isInteger(limitPlusOne) || limitPlusOne < 2 || limitPlusOne > 201) fail("MCFT_COLLECTION_LIMIT_INVALID");
    const kinds: Record<string, FieldTwinTimelineEventV1["event_kind"]> = { twin_evidence_window_v1: "EVIDENCE_WINDOW", twin_state_transition_v1: "STATE_TRANSITION", twin_assimilation_update_v1: "ASSIMILATION_UPDATE", twin_state_estimate_v1: "POSTERIOR_STATE", twin_forecast_run_v1: "FORECAST_RESULT", twin_forecast_failure_v1: "FORECAST_FAILURE", twin_runtime_tick_v1: "RUNTIME_TICK", twin_runtime_checkpoint_v1: "CHECKPOINT", twin_runtime_health_v1: "RUNTIME_HEALTH", twin_scenario_set_v1: "SCENARIO_SET", twin_decision_record_v1: "HUMAN_DECISION", approved_irrigation_plan_snapshot_v1: "APPROVED_PLAN_EVIDENCE", twin_action_feedback_v1: "ACTION_FEEDBACK", twin_forecast_residual_v1: "FORECAST_RESIDUAL", twin_calibration_candidate_v1: "CALIBRATION_CANDIDATE", twin_shadow_evaluation_v1: "SHADOW_EVALUATION", twin_model_activation_v1: "MODEL_ACTIVATION" };
    const types = Object.keys(kinds);
    const rankCase = types.map((type) => `WHEN '${type}' THEN ${FIELD_TWIN_TIMELINE_EVENT_RANKS_V1[kinds[type]]}`).join(" ");
    const params: unknown[] = [context.canonical_visibility_snapshot.database_visibility_epoch_id, context.canonical_visibility_snapshot.pg_snapshot_token, types, ...scopeValues(context.scope)];
    const predicates = ["logical_time_text IS NOT NULL", "object_ref IS NOT NULL"];
    if (filter.from_logical_time) { params.push(filter.from_logical_time); predicates.push(`logical_time_text::timestamptz >= $${params.length}::timestamptz`); }
    if (filter.until_logical_time) { params.push(filter.until_logical_time); predicates.push(`logical_time_text::timestamptz < $${params.length}::timestamptz`); }
    if (boundary) { params.push(boundary.logical_time, boundary.event_rank, boundary.object_ref); const i = params.length - 2; predicates.push(`(logical_time_text::timestamptz,event_rank,object_ref) > ($${i}::timestamptz,$${i + 1}::integer,$${i + 2}::text)`); }
    params.push(limitPlusOne);
    const result = await context.client.query<{ fact_id: string; record_json: unknown; event_rank: number; logical_time_text: string; object_ref: string }>(
      `WITH visible_events AS (
        SELECT f.fact_id,f.record_json,CASE f.record_json->>'type' ${rankCase} ELSE NULL END AS event_rank,
          CASE WHEN f.record_json->>'type'='approved_irrigation_plan_snapshot_v1' THEN f.record_json->'payload'->>'available_to_runtime_at' ELSE f.record_json->'payload'->>'logical_time' END AS logical_time_text,
          CASE WHEN f.record_json->>'type'='approved_irrigation_plan_snapshot_v1' THEN f.record_json->'payload'->>'source_record_id' ELSE f.record_json->'payload'->>'object_id' END AS object_ref
        FROM public.facts f JOIN public.twin_fact_visibility_index_v1 visibility ON visibility.fact_id=f.fact_id
        WHERE visibility.visibility_epoch_id=$1 AND pg_catalog.pg_visible_in_snapshot(visibility.visibility_anchor_xid8,$2::pg_snapshot)
          AND f.record_json->>'type'=ANY($3::text[])
          AND f.record_json->'payload'->>'tenant_id'=$4 AND f.record_json->'payload'->>'project_id'=$5 AND f.record_json->'payload'->>'group_id'=$6
          AND f.record_json->'payload'->>'field_id'=$7 AND f.record_json->'payload'->>'season_id'=$8 AND f.record_json->'payload'->>'zone_id'=$9)
       SELECT fact_id,record_json,event_rank,logical_time_text,object_ref FROM visible_events WHERE ${predicates.join(" AND ")}
       ORDER BY logical_time_text::timestamptz ASC,event_rank ASC,object_ref ASC LIMIT $${params.length}`, params);
    const canonicalRefs = result.rows.filter((row) => record(row.record_json, "MCFT_FACT_ENVELOPE_INVALID").type !== "approved_irrigation_plan_snapshot_v1").map((row) => row.object_ref);
    const memberships = await this.recordSetMemberships(context, canonicalRefs);
    const events: FieldTwinTimelineEventV1[] = [];
    for (const row of result.rows) {
      const envelope = record(row.record_json, "MCFT_FACT_ENVELOPE_INVALID");
      const type = text(envelope.type, "MCFT_FACT_ENVELOPE_INVALID:TYPE");
      const kind = kinds[type];
      if (type === "approved_irrigation_plan_snapshot_v1") {
        const replay = this.resolveReplay(context, row, row.object_ref, null);
        const logicalTime = instant(row.logical_time_text, "MCFT_TIMELINE_LOGICAL_TIME_INVALID");
        events.push({ event_id: `event:${row.fact_id}`, event_kind: kind, event_rank: row.event_rank, object_ref: replay.object.object_ref, object_type: replay.object.object_type, object_hash: replay.object.object_hash, scope: context.scope, lineage_id: null, revision_id: null, logical_time: logicalTime, as_of: null, observed_at: optionalInstant(replay.canonical_payload.observed_at, "MCFT_TIMELINE_OBSERVED_AT_INVALID"), available_to_runtime_at: logicalTime, created_at: null, transaction_family: null, health_role: null, health_resolution_basis: null, health_resolution_evidence_refs: null, atomic_group_ref: null, source_fact_ref: row.fact_id, source_refs: replay.object.source_refs, evidence_refs: replay.object.evidence_refs, attachment_status: "ATTACHED_EXACT", limitations: [] });
        continue;
      }
      const exact = await this.base.readExactObjectByRef(context, row.object_ref, type);
      const payload = exact.payload;
      const membership = memberships.get(row.object_ref) ?? null;
      let resolution: FieldTwinRuntimeHealthRoleResolutionV1 | null = null;
      if (kind === "RUNTIME_HEALTH") {
        if (membership) resolution = this.health.resolve({ health_object_ref: row.object_ref, record_set_membership: membership, operational_attempt_relation: null });
        else {
          const attemptRef = text(payload.payload.attempt_ref, "MCFT_RUNTIME_HEALTH_ROLE_UNRESOLVED:ATTEMPT_REF");
          const attempt = await this.base.readExactObjectByRef(context, attemptRef, "twin_runtime_attempt_v1");
          const failureRef = optionalText(payload.payload.forecast_failure_ref);
          if (failureRef) { const failure = await this.base.readExactObjectByRef(context, failureRef, "twin_forecast_failure_v1"); if (failure.payload.payload.attempt_ref !== attempt.object.object_ref) fail("MCFT_RUNTIME_HEALTH_ROLE_UNRESOLVED", "FORECAST_FAILURE_ATTEMPT"); }
          resolution = this.health.resolve({ health_object_ref: row.object_ref, record_set_membership: null, operational_attempt_relation: { attempt_ref: attempt.object.object_ref, health_ref: row.object_ref, forecast_failure_ref: failureRef } });
        }
      }
      events.push({ event_id: `event:${row.fact_id}`, event_kind: kind, event_rank: row.event_rank, object_ref: exact.object.object_ref, object_type: exact.object.object_type, object_hash: exact.object.object_hash, scope: context.scope, lineage_id: exact.object.lineage_id, revision_id: exact.object.revision_id, logical_time: instant(row.logical_time_text, "MCFT_TIMELINE_LOGICAL_TIME_INVALID"), as_of: optionalInstant(payload.as_of, "MCFT_TIMELINE_AS_OF_INVALID"), observed_at: optionalInstant(payload.payload.observed_at, "MCFT_TIMELINE_OBSERVED_AT_INVALID"), available_to_runtime_at: optionalInstant(payload.payload.available_to_runtime_at, "MCFT_TIMELINE_AVAILABLE_AT_INVALID"), created_at: optionalInstant(payload.created_at, "MCFT_TIMELINE_CREATED_AT_INVALID"), transaction_family: resolution?.transaction_family ?? null, health_role: resolution?.health_role ?? null, health_resolution_basis: resolution?.health_resolution_basis ?? null, health_resolution_evidence_refs: resolution?.health_resolution_evidence_refs ?? null, atomic_group_ref: resolution?.atomic_group_ref ?? membership?.record_set_id ?? null, source_fact_ref: exact.object.source_fact_ref, source_refs: exact.object.source_refs, evidence_refs: exact.object.evidence_refs, attachment_status: "ATTACHED_EXACT", limitations: (payload.limitations ?? []).map((reason) => ({ reason_code: String(reason), object_ref: exact.object.object_ref, detail: null })) });
    }
    return Object.freeze(events);
  }
}
