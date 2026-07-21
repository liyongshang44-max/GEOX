// Purpose: resolve S4 Decision and Approved Plan Replay Evidence attachments from exact visible facts.
// Boundary: SELECT-only validation over a caller-owned snapshot; no DDL/DML or write-capable dependency.

import {
  AggregateProjectionValidatorV1,
  EvidenceBindingValidatorV1,
  ReplayEvidenceFactResolverV1,
  type FieldTwinScopeV1,
  type FieldTwinSourceValidationResultV1,
  type SemanticHashTextV1,
} from "../../domain/field_twin_read_model/index.js";
import type { FieldTwinComposerObjectV1 } from "../../domain/field_twin_read_model/composer_contracts_v1.js";
import { canonicalUtcInstantV1 } from "../../domain/field_twin_read_model/cursor_contracts_v1.js";
import { resolveMcftCap07S4SourceObligationV1 } from "../../domain/field_twin_read_model/s4_source_obligations_v1.js";
import { canonicalJsonV1 } from "../../domain/twin_runtime/canonical_json_v1.js";
import type { CanonicalObjectEnvelopeV1 } from "../../domain/twin_runtime/canonical_object_contracts_v1.js";
import {
  PostgresFieldTwinReadRepositoryErrorV1,
  PostgresFieldTwinReadRepositoryV1,
} from "./postgres_field_twin_read_repository_v1.js";
import type { PostgresFieldTwinSnapshotContextV1 } from "./postgres_field_twin_snapshot_repository_v1.js";

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
const record = (value: unknown, code: string): JsonRecord => {
  if (!value || typeof value !== "object" || Array.isArray(value)) fail(code);
  return value as JsonRecord;
};
const text = (value: unknown, code: string): string => {
  if (typeof value !== "string" || !value.trim()) fail(code);
  return value;
};
const scopeValues = (scope: FieldTwinScopeV1): readonly string[] => [scope.tenant_id, scope.project_id, scope.group_id, scope.field_id, scope.season_id, scope.zone_id];
const normalize = (value: unknown): unknown => {
  if (value instanceof Date) return value.toISOString();
  if (Array.isArray(value)) return value.map(normalize);
  if (value && typeof value === "object") return Object.fromEntries(Object.entries(value as JsonRecord).map(([key, item]) => [key, normalize(item)]));
  return value;
};
function assertScope(value: unknown, scope: FieldTwinScopeV1, code: string): void {
  const candidate = record(value, code);
  for (const key of ["tenant_id", "project_id", "group_id", "field_id", "season_id", "zone_id"] as const) if (candidate[key] !== scope[key]) fail(code, key);
}
async function assertRelation(context: PostgresFieldTwinSnapshotContextV1, relation: string): Promise<void> {
  const result = await context.client.query<{ exists: boolean }>("SELECT pg_catalog.to_regclass($1) IS NOT NULL AS exists", [relation]);
  if (result.rows[0]?.exists !== true) fail("MCFT_REQUIRED_READ_SCHEMA_UNAVAILABLE", relation);
}

export class PostgresFieldTwinS4ReplayRepositoryV1 {
  private readonly replay = new ReplayEvidenceFactResolverV1();
  private readonly projection = new AggregateProjectionValidatorV1();
  private readonly binding = new EvidenceBindingValidatorV1();

  constructor(private readonly base: PostgresFieldTwinReadRepositoryV1) {}

  private async visibleFactById(context: PostgresFieldTwinSnapshotContextV1, factId: string): Promise<{ fact_id: string; record_json: unknown } | null> {
    const result = await context.client.query<{ fact_id: string; record_json: unknown }>(
      `SELECT f.fact_id,f.record_json FROM public.facts f
       JOIN public.twin_fact_visibility_index_v1 visibility ON visibility.fact_id=f.fact_id
       WHERE visibility.visibility_epoch_id=$1
         AND pg_catalog.pg_visible_in_snapshot(visibility.visibility_anchor_xid8,$2::pg_snapshot)
         AND f.fact_id=$3 LIMIT 2`,
      [context.canonical_visibility_snapshot.database_visibility_epoch_id, context.canonical_visibility_snapshot.pg_snapshot_token, factId],
    );
    if ((result.rowCount ?? 0) > 1) fail("MCFT_CANONICAL_FACT_ID_CARDINALITY_INVALID", factId);
    return result.rows[0] ?? null;
  }

  private resolveReplay(context: PostgresFieldTwinSnapshotContextV1, row: { fact_id: string; record_json: unknown }, expectedRef?: string | null, expectedHash?: SemanticHashTextV1 | null): ResolvedReplayEvidenceObjectV1 {
    const resolution = this.replay.resolve({
      fact_id: row.fact_id,
      record_json: row.record_json,
      expected_type: "approved_irrigation_plan_snapshot_v1",
      expected_source_record_id: expectedRef ?? undefined,
      expected_source_record_hash: expectedHash ?? undefined,
    });
    const envelope = record(row.record_json, "MCFT_DIRECT_REPLAY_EVIDENCE_INVALID:ENVELOPE");
    assertScope(record(envelope.payload, "MCFT_DIRECT_REPLAY_EVIDENCE_INVALID:PAYLOAD"), context.scope, "MCFT_DIRECT_REPLAY_EVIDENCE_INVALID:SCOPE");
    const object: FieldTwinComposerObjectV1 = Object.freeze({
      object_ref: resolution.source_record_id,
      object_type: resolution.record_type,
      object_hash: resolution.source_record_hash,
      source_fact_ref: resolution.fact_id,
      scope: Object.freeze({ ...context.scope }),
      lineage_id: null,
      revision_id: null,
      logical_time: canonicalUtcInstantV1(resolution.available_to_runtime_at),
      source_refs: Object.freeze([{ ref_type: "SOURCE_RECORD", ref_value: resolution.source_record_id }]),
      evidence_refs: Object.freeze([{ ref_type: "FACT", ref_value: resolution.fact_id }]),
      validation_profile: "REPLAY_EVIDENCE_FACT_DIRECT",
      validation_status: "PASS",
      attachment_status: "ATTACHED_EXACT",
    });
    return {
      object,
      canonical_payload: resolution.canonical_payload,
      validation: {
        source_name: "public.facts#record_json.payload.record_type=approved_irrigation_plan_snapshot_v1",
        profile_family: "REPLAY_EVIDENCE_FACT_DIRECT",
        validation_status: "PASS",
        failure_code: null,
        validated_object_ref: resolution.source_record_id,
        validated_object_hash: resolution.source_record_hash,
        evidence_refs: [{ ref_type: "FACT", ref_value: resolution.fact_id }],
      },
    };
  }

  async readBySourceRef(context: PostgresFieldTwinSnapshotContextV1, sourceRecordRef: string, expectedHash?: SemanticHashTextV1 | null): Promise<ResolvedReplayEvidenceObjectV1> {
    const result = await context.client.query<{ fact_id: string; record_json: unknown }>(
      `SELECT f.fact_id,f.record_json FROM public.facts f
       JOIN public.twin_fact_visibility_index_v1 visibility ON visibility.fact_id=f.fact_id
       WHERE visibility.visibility_epoch_id=$1
         AND pg_catalog.pg_visible_in_snapshot(visibility.visibility_anchor_xid8,$2::pg_snapshot)
         AND f.record_json->>'type'='approved_irrigation_plan_snapshot_v1'
         AND f.record_json->'payload'->>'source_record_id'=$3 LIMIT 2`,
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
         AND selected_option_ref=$7 AND selected_option_hash=$8
         AND decision_request_ref=$9 AND decision_request_hash=$10
         AND active_for_decision IS TRUE LIMIT 2`,
      [...scopeValues(context.scope), selectedOptionRef, selectedOptionHash, requestRef, requestHash],
    );
    if ((result.rowCount ?? 0) > 1) fail("MCFT_EVIDENCE_BINDING_INVALID", "ACTIVE_PLAN_CARDINALITY");
    if (!result.rows[0]) return null;
    const row = normalize(result.rows[0].row_json) as JsonRecord;
    const factId = text(row.source_fact_id, "MCFT_EVIDENCE_BINDING_INVALID:SOURCE_FACT");
    const fact = await this.visibleFactById(context, factId);
    if (!fact) fail("MCFT_EVIDENCE_BINDING_INVALID", "SOURCE_FACT_MISSING");
    const plan = this.resolveReplay(
      context,
      fact,
      text(row.approved_plan_evidence_ref, "MCFT_EVIDENCE_BINDING_INVALID:PLAN_REF"),
      text(row.approved_plan_evidence_hash, "MCFT_EVIDENCE_BINDING_INVALID:PLAN_HASH") as SemanticHashTextV1,
    );
    for (const key of ["binding_id", "approval_assertion_ref", "approval_assertion_hash", "decision_request_ref", "decision_request_hash", "selected_option_ref", "selected_option_hash", "scenario_amount_mm", "approved_amount_mm", "plan_effective_from", "plan_effective_to", "active_for_decision"] as const) {
      if (canonicalJsonV1(row[key]) !== canonicalJsonV1(plan.canonical_payload[key])) fail("MCFT_EVIDENCE_BINDING_INVALID", key);
    }
    this.binding.validate({
      declared_refs: [{ ref_type: "DECISION_REQUEST", ref_value: requestRef }, { ref_type: "SELECTED_OPTION", ref_value: selectedOptionRef }],
      resolved_refs: [
        { ref_type: "DECISION_REQUEST", ref_value: text(plan.canonical_payload.decision_request_ref, "MCFT_EVIDENCE_BINDING_INVALID:DECISION_REQUEST_REF") },
        { ref_type: "SELECTED_OPTION", ref_value: text(plan.canonical_payload.selected_option_ref, "MCFT_EVIDENCE_BINDING_INVALID:SELECTED_OPTION_REF") },
      ],
      scope: context.scope,
      resolved_scope: context.scope,
    });
    return plan;
  }
}
