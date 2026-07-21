// Purpose: execute S4 Timeline SQL keyset reads and resolve Replay Evidence plus exact A/F Runtime Health roles.
// Boundary: SELECT-only validation over one caller-owned snapshot; no DDL/DML or timestamp-based authority inference.

import {
  ReplayEvidenceFactResolverV1,
  RuntimeHealthRoleResolverV1,
  type FieldTwinRuntimeHealthRoleResolutionV1,
  type FieldTwinScopeV1,
  type FieldTwinTimelineEventV1,
} from "../../domain/field_twin_read_model/index.js";
import { canonicalUtcInstantV1 } from "../../domain/field_twin_read_model/cursor_contracts_v1.js";
import { FIELD_TWIN_TIMELINE_EVENT_RANKS_V1 } from "../../domain/field_twin_read_model/ordering_v1.js";
import {
  PostgresFieldTwinReadRepositoryErrorV1,
  PostgresFieldTwinReadRepositoryV1,
} from "./postgres_field_twin_read_repository_v1.js";
import type { PostgresFieldTwinSnapshotContextV1 } from "./postgres_field_twin_snapshot_repository_v1.js";

type JsonRecord = Record<string, unknown>;
type MembershipV1 = { record_set_id: string; member_refs: readonly string[] };
function fail(code: string, detail?: string): never {
  throw new PostgresFieldTwinReadRepositoryErrorV1(code, detail);
}
const record = (value: unknown, code: string): JsonRecord => {
  if (!value || typeof value !== "object" || Array.isArray(value)) fail(code);
  return value as JsonRecord;
};
const text = (value: unknown, code: string): string => {
  if (typeof value !== "string" || !value.trim()) fail(code);
  return value;
};
const optionalText = (value: unknown): string | null => typeof value === "string" && value.trim() ? value : null;
const instant = (value: unknown, code: string): ReturnType<typeof canonicalUtcInstantV1> => {
  const parsed = value instanceof Date ? value : new Date(String(value ?? ""));
  if (!Number.isFinite(parsed.getTime())) fail(code);
  return canonicalUtcInstantV1(parsed.toISOString());
};
const optionalInstant = (value: unknown, code: string): ReturnType<typeof canonicalUtcInstantV1> | null => value === null || value === undefined || value === "" ? null : instant(value, code);
const scopeValues = (scope: FieldTwinScopeV1): readonly string[] => [scope.tenant_id, scope.project_id, scope.group_id, scope.field_id, scope.season_id, scope.zone_id];
async function assertRelation(context: PostgresFieldTwinSnapshotContextV1, relation: string): Promise<void> {
  const result = await context.client.query<{ exists: boolean }>("SELECT pg_catalog.to_regclass($1) IS NOT NULL AS exists", [relation]);
  if (result.rows[0]?.exists !== true) fail("MCFT_REQUIRED_READ_SCHEMA_UNAVAILABLE", relation);
}

export class PostgresFieldTwinS4TimelineRepositoryV1 {
  private readonly replay = new ReplayEvidenceFactResolverV1();
  private readonly health = new RuntimeHealthRoleResolverV1();

  constructor(private readonly base: PostgresFieldTwinReadRepositoryV1) {}

  private async recordSetMemberships(context: PostgresFieldTwinSnapshotContextV1, refs: readonly string[]): Promise<ReadonlyMap<string, MembershipV1>> {
    if (refs.length === 0) return new Map();
    await assertRelation(context, "public.twin_object_idempotency_index_v1");
    const result = await context.client.query<{ record_set_id: string; member_object_ids: unknown }>(
      `SELECT record_set_id,member_object_ids
         FROM public.twin_object_idempotency_index_v1
        WHERE identity_kind IN ('A0_RECORD_SET','A2_RECORD_SET')
          AND member_object_ids ?| $1::text[]`,
      [refs],
    );
    const map = new Map<string, MembershipV1>();
    for (const row of result.rows) {
      const members = Array.isArray(row.member_object_ids)
        ? row.member_object_ids.map(String)
        : Object.keys(record(row.member_object_ids, "MCFT_RECORD_SET_IDENTITY_INVALID"));
      const checkpoints: string[] = [];
      for (const ref of members) {
        try {
          const exact = await this.base.readExactObjectByRef(context, ref);
          if (exact.object.object_type === "twin_runtime_checkpoint_v1") checkpoints.push(ref);
        } catch { /* exact root validation below is authoritative */ }
      }
      if (checkpoints.length !== 1) fail("MCFT_RECORD_SET_IDENTITY_INVALID", `CHECKPOINT_CARDINALITY:${row.record_set_id}`);
      const root = await this.base.resolveHistoricalRuntimeRoot(context, checkpoints[0]);
      if (root.record_set_validation.record_set_id !== row.record_set_id) fail("MCFT_RECORD_SET_IDENTITY_INVALID", "RECORD_SET_ID");
      const membership: MembershipV1 = {
        record_set_id: row.record_set_id,
        member_refs: Object.freeze(root.record_set_validation.exact_member_refs.map((item) => item.object_ref)),
      };
      for (const ref of membership.member_refs) {
        if (map.has(ref)) fail("MCFT_RECORD_SET_IDENTITY_INVALID", `MULTIPLE_MEMBERSHIP:${ref}`);
        map.set(ref, membership);
      }
    }
    return map;
  }

  async read(context: PostgresFieldTwinSnapshotContextV1, limitPlusOne: number, filter: { from_logical_time: string | null; until_logical_time: string | null }, boundary: { logical_time: string; event_rank: number; object_ref: string } | null): Promise<readonly FieldTwinTimelineEventV1[]> {
    if (!Number.isInteger(limitPlusOne) || limitPlusOne < 2 || limitPlusOne > 201) fail("MCFT_COLLECTION_LIMIT_INVALID");
    const kinds: Record<string, FieldTwinTimelineEventV1["event_kind"]> = {
      twin_evidence_window_v1: "EVIDENCE_WINDOW",
      twin_state_transition_v1: "STATE_TRANSITION",
      twin_assimilation_update_v1: "ASSIMILATION_UPDATE",
      twin_state_estimate_v1: "POSTERIOR_STATE",
      twin_forecast_run_v1: "FORECAST_RESULT",
      twin_forecast_failure_v1: "FORECAST_FAILURE",
      twin_runtime_tick_v1: "RUNTIME_TICK",
      twin_runtime_checkpoint_v1: "CHECKPOINT",
      twin_runtime_health_v1: "RUNTIME_HEALTH",
      twin_scenario_set_v1: "SCENARIO_SET",
      twin_decision_record_v1: "HUMAN_DECISION",
      approved_irrigation_plan_snapshot_v1: "APPROVED_PLAN_EVIDENCE",
      twin_action_feedback_v1: "ACTION_FEEDBACK",
      twin_forecast_residual_v1: "FORECAST_RESIDUAL",
      twin_calibration_candidate_v1: "CALIBRATION_CANDIDATE",
      twin_shadow_evaluation_v1: "SHADOW_EVALUATION",
      twin_model_activation_v1: "MODEL_ACTIVATION",
    };
    const types = Object.keys(kinds);
    const rankCase = types.map((type) => `WHEN '${type}' THEN ${FIELD_TWIN_TIMELINE_EVENT_RANKS_V1[kinds[type]]}`).join(" ");
    const params: unknown[] = [context.canonical_visibility_snapshot.database_visibility_epoch_id, context.canonical_visibility_snapshot.pg_snapshot_token, types, ...scopeValues(context.scope)];
    const predicates = ["logical_time_text IS NOT NULL", "object_ref IS NOT NULL", "event_rank IS NOT NULL"];
    if (filter.from_logical_time) {
      params.push(filter.from_logical_time);
      predicates.push(`logical_time_text::timestamptz >= $${params.length}::timestamptz`);
    }
    if (filter.until_logical_time) {
      params.push(filter.until_logical_time);
      predicates.push(`logical_time_text::timestamptz < $${params.length}::timestamptz`);
    }
    if (boundary) {
      params.push(boundary.logical_time, boundary.event_rank, boundary.object_ref);
      const first = params.length - 2;
      predicates.push(`(logical_time_text::timestamptz,event_rank,object_ref) > ($${first}::timestamptz,$${first + 1}::integer,$${first + 2}::text)`);
    }
    params.push(limitPlusOne);
    const result = await context.client.query<{ fact_id: string; record_json: unknown; event_rank: number; logical_time_text: string; object_ref: string }>(
      `WITH visible_events AS (
         SELECT f.fact_id,f.record_json,
           CASE f.record_json->>'type' ${rankCase} ELSE NULL END AS event_rank,
           CASE WHEN f.record_json->>'type'='approved_irrigation_plan_snapshot_v1'
             THEN f.record_json->'payload'->>'available_to_runtime_at'
             ELSE f.record_json->'payload'->>'logical_time' END AS logical_time_text,
           CASE WHEN f.record_json->>'type'='approved_irrigation_plan_snapshot_v1'
             THEN f.record_json->'payload'->>'source_record_id'
             ELSE f.record_json->'payload'->>'object_id' END AS object_ref
         FROM public.facts f
         JOIN public.twin_fact_visibility_index_v1 visibility ON visibility.fact_id=f.fact_id
         WHERE visibility.visibility_epoch_id=$1
           AND pg_catalog.pg_visible_in_snapshot(visibility.visibility_anchor_xid8,$2::pg_snapshot)
           AND f.record_json->>'type'=ANY($3::text[])
           AND f.record_json->'payload'->>'tenant_id'=$4
           AND f.record_json->'payload'->>'project_id'=$5
           AND f.record_json->'payload'->>'group_id'=$6
           AND f.record_json->'payload'->>'field_id'=$7
           AND f.record_json->'payload'->>'season_id'=$8
           AND f.record_json->'payload'->>'zone_id'=$9)
       SELECT fact_id,record_json,event_rank,logical_time_text,object_ref
         FROM visible_events
        WHERE ${predicates.join(" AND ")}
        ORDER BY logical_time_text::timestamptz ASC,event_rank ASC,object_ref ASC
        LIMIT $${params.length}`,
      params,
    );
    const canonicalRefs = result.rows
      .filter((row) => record(row.record_json, "MCFT_FACT_ENVELOPE_INVALID").type !== "approved_irrigation_plan_snapshot_v1")
      .map((row) => row.object_ref);
    const memberships = await this.recordSetMemberships(context, canonicalRefs);
    const events: FieldTwinTimelineEventV1[] = [];
    for (const row of result.rows) {
      const envelope = record(row.record_json, "MCFT_FACT_ENVELOPE_INVALID");
      const type = text(envelope.type, "MCFT_FACT_ENVELOPE_INVALID:TYPE");
      const kind = kinds[type];
      if (type === "approved_irrigation_plan_snapshot_v1") {
        const replay = this.replay.resolve({ fact_id: row.fact_id, record_json: row.record_json, expected_type: "approved_irrigation_plan_snapshot_v1", expected_source_record_id: row.object_ref });
        const payload = record(envelope.payload, "MCFT_DIRECT_REPLAY_EVIDENCE_INVALID:PAYLOAD");
        const logicalTime = instant(row.logical_time_text, "MCFT_TIMELINE_LOGICAL_TIME_INVALID");
        events.push({
          event_id: `event:${row.fact_id}`, event_kind: kind, event_rank: row.event_rank,
          object_ref: replay.source_record_id, object_type: replay.record_type, object_hash: replay.source_record_hash,
          scope: context.scope, lineage_id: null, revision_id: null, logical_time: logicalTime,
          as_of: null, observed_at: optionalInstant(replay.canonical_payload.observed_at, "MCFT_TIMELINE_OBSERVED_AT_INVALID"),
          available_to_runtime_at: logicalTime, created_at: null, transaction_family: null, health_role: null,
          health_resolution_basis: null, health_resolution_evidence_refs: null, atomic_group_ref: null,
          source_fact_ref: row.fact_id,
          source_refs: [{ ref_type: "SOURCE_RECORD", ref_value: replay.source_record_id }],
          evidence_refs: [{ ref_type: "FACT", ref_value: row.fact_id }],
          attachment_status: "ATTACHED_EXACT", limitations: [],
        });
        if (payload.source_record_id !== replay.source_record_id) fail("MCFT_DIRECT_REPLAY_EVIDENCE_INVALID", "SOURCE_ID");
        continue;
      }
      const exact = await this.base.readExactObjectByRef(context, row.object_ref, type);
      const payload = exact.payload;
      const membership = memberships.get(row.object_ref) ?? null;
      let resolution: FieldTwinRuntimeHealthRoleResolutionV1 | null = null;
      if (kind === "RUNTIME_HEALTH") {
        if (membership) {
          resolution = this.health.resolve({ health_object_ref: row.object_ref, record_set_membership: membership, operational_attempt_relation: null });
        } else {
          const attemptRef = text(payload.payload.attempt_ref, "MCFT_RUNTIME_HEALTH_ROLE_UNRESOLVED:ATTEMPT_REF");
          const attempt = await this.base.readExactObjectByRef(context, attemptRef, "twin_runtime_attempt_v1");
          const failureRef = optionalText(payload.payload.forecast_failure_ref);
          if (failureRef) {
            const failure = await this.base.readExactObjectByRef(context, failureRef, "twin_forecast_failure_v1");
            if (failure.payload.payload.attempt_ref !== attempt.object.object_ref) fail("MCFT_RUNTIME_HEALTH_ROLE_UNRESOLVED", "FORECAST_FAILURE_ATTEMPT");
          }
          resolution = this.health.resolve({
            health_object_ref: row.object_ref,
            record_set_membership: null,
            operational_attempt_relation: { attempt_ref: attempt.object.object_ref, health_ref: row.object_ref, forecast_failure_ref: failureRef },
          });
        }
      }
      events.push({
        event_id: `event:${row.fact_id}`, event_kind: kind, event_rank: row.event_rank,
        object_ref: exact.object.object_ref, object_type: exact.object.object_type, object_hash: exact.object.object_hash,
        scope: context.scope, lineage_id: exact.object.lineage_id, revision_id: exact.object.revision_id,
        logical_time: instant(row.logical_time_text, "MCFT_TIMELINE_LOGICAL_TIME_INVALID"),
        as_of: optionalInstant(payload.as_of, "MCFT_TIMELINE_AS_OF_INVALID"),
        observed_at: optionalInstant(payload.payload.observed_at, "MCFT_TIMELINE_OBSERVED_AT_INVALID"),
        available_to_runtime_at: optionalInstant(payload.payload.available_to_runtime_at, "MCFT_TIMELINE_AVAILABLE_AT_INVALID"),
        created_at: optionalInstant(payload.created_at, "MCFT_TIMELINE_CREATED_AT_INVALID"),
        transaction_family: resolution?.transaction_family ?? null,
        health_role: resolution?.health_role ?? null,
        health_resolution_basis: resolution?.health_resolution_basis ?? null,
        health_resolution_evidence_refs: resolution?.health_resolution_evidence_refs ?? null,
        atomic_group_ref: resolution?.atomic_group_ref ?? membership?.record_set_id ?? null,
        source_fact_ref: exact.object.source_fact_ref,
        source_refs: exact.object.source_refs,
        evidence_refs: exact.object.evidence_refs,
        attachment_status: "ATTACHED_EXACT",
        limitations: (payload.limitations ?? []).map((reason) => ({ reason_code: String(reason), object_ref: exact.object.object_ref, detail: null })),
      });
    }
    return Object.freeze(events);
  }
}
