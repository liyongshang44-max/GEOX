// Purpose: resolve exact MCFT-CAP-07 Runtime roots and bounded validated collections inside one caller-owned read-only snapshot.
// Boundary: SELECT-only PostgreSQL access and exact validation; no transaction ownership, DDL/DML, route behavior, persistence, recommendation, approval, AO-ACT, dispatch, or activation authority.

import type { PoolClient } from "pg";
import {
  ActiveLineageAuthorityValidatorV1,
  AggregateProjectionValidatorV1,
  CanonicalTwinFactResolverV1,
  OperationalPointerValidatorV1,
  RuntimeHealthRoleResolverV1,
  type FieldTwinCanonicalObjectRefV1,
  type FieldTwinCollectionItemV1,
  type FieldTwinCollectionKindV1,
  type FieldTwinRecordSetValidationV1,
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
import { computeA0RecordSetDeterminismHashV1, computeMemberDeterminismHashV1 } from "../../domain/twin_runtime/canonical_identity_v1.js";
import type { CanonicalObjectEnvelopeV1 } from "../../domain/twin_runtime/canonical_object_contracts_v1.js";
import { computeContinuationRecordSetDeterminismHashV1, type ContinuationAggregateIdentityInputV1 } from "../../domain/twin_runtime/continuation_record_set_identity_v1.js";
import { computeAssimilatedContinuationRecordSetDeterminismHashV1, type AssimilatedContinuationAggregateIdentityInputV1 } from "../../domain/twin_runtime/assimilated_continuation_record_set_identity_v1.js";
import { computeAssimilatedContinuationRecordSetDeterminismHashV2, type AssimilatedContinuationAggregateIdentityInputV2 } from "../../domain/twin_runtime/assimilated_continuation_record_set_identity_v2.js";
import { ASSIMILATED_CONTINUATION_RECORD_SET_CONTRACT_ID_V1 } from "../../domain/twin_runtime/assimilated_continuation_contracts_v1.js";
import { ASSIMILATED_CONTINUATION_RECORD_SET_CONTRACT_ID_V2 } from "../../domain/twin_runtime/assimilated_continuation_contracts_v2.js";
import { canonicalJsonV1 } from "../../domain/twin_runtime/canonical_json_v1.js";
import type { PostgresFieldTwinSnapshotContextV1 } from "./postgres_field_twin_snapshot_repository_v1.js";

export class PostgresFieldTwinReadRepositoryErrorV1 extends Error {
  constructor(readonly code: string, detail?: string) {
    super(detail ? `${code}:${detail}` : code);
    this.name = "PostgresFieldTwinReadRepositoryErrorV1";
  }
}

export type McftCollectionSourceSpecV1 = {
  collection_kind: FieldTwinCollectionKindV1;
  endpoint_suffix: string;
  source_name: string;
  source_kind: "CANONICAL_AGGREGATE_PROJECTION" | "CANONICAL_TWIN_FACT_DIRECT";
  relation_name: string | null;
  object_id_column: string | null;
  expected_object_type: string;
};

export const MCFT_COLLECTION_SOURCE_SPECS_V1: Readonly<Record<FieldTwinCollectionKindV1, McftCollectionSourceSpecV1>> = Object.freeze({
  STATE: { collection_kind: "STATE", endpoint_suffix: "/states", source_name: "public.twin_state_history_projection_v1", source_kind: "CANONICAL_AGGREGATE_PROJECTION", relation_name: "public.twin_state_history_projection_v1", object_id_column: "state_object_id", expected_object_type: "twin_state_estimate_v1" },
  FORECAST: { collection_kind: "FORECAST", endpoint_suffix: "/forecasts", source_name: "public.twin_forecast_run_projection_v1", source_kind: "CANONICAL_AGGREGATE_PROJECTION", relation_name: "public.twin_forecast_run_projection_v1", object_id_column: "forecast_object_id", expected_object_type: "twin_forecast_run_v1" },
  SCENARIO: { collection_kind: "SCENARIO", endpoint_suffix: "/scenarios", source_name: "public.twin_scenario_set_projection_v1", source_kind: "CANONICAL_AGGREGATE_PROJECTION", relation_name: "public.twin_scenario_set_projection_v1", object_id_column: "scenario_set_id", expected_object_type: "twin_scenario_set_v1" },
  ACTION_FEEDBACK: { collection_kind: "ACTION_FEEDBACK", endpoint_suffix: "/action-lifecycle", source_name: "public.twin_action_feedback_projection_v1", source_kind: "CANONICAL_AGGREGATE_PROJECTION", relation_name: "public.twin_action_feedback_projection_v1", object_id_column: "action_feedback_object_id", expected_object_type: "twin_action_feedback_v1" },
  FORECAST_RESIDUAL: { collection_kind: "FORECAST_RESIDUAL", endpoint_suffix: "/residuals", source_name: "public.twin_forecast_residual_projection_v1", source_kind: "CANONICAL_AGGREGATE_PROJECTION", relation_name: "public.twin_forecast_residual_projection_v1", object_id_column: "residual_object_id", expected_object_type: "twin_forecast_residual_v1" },
  CALIBRATION_CANDIDATE: { collection_kind: "CALIBRATION_CANDIDATE", endpoint_suffix: "/model-governance", source_name: "public.twin_calibration_candidate_projection_v1", source_kind: "CANONICAL_AGGREGATE_PROJECTION", relation_name: "public.twin_calibration_candidate_projection_v1", object_id_column: "candidate_object_id", expected_object_type: "twin_calibration_candidate_v1" },
  SHADOW_EVALUATION: { collection_kind: "SHADOW_EVALUATION", endpoint_suffix: "/model-governance", source_name: "public.twin_shadow_evaluation_projection_v1", source_kind: "CANONICAL_AGGREGATE_PROJECTION", relation_name: "public.twin_shadow_evaluation_projection_v1", object_id_column: "evaluation_object_id", expected_object_type: "twin_shadow_evaluation_v1" },
  MODEL_ACTIVATION: { collection_kind: "MODEL_ACTIVATION", endpoint_suffix: "/model-governance", source_name: "public.facts#record_json.type=twin_model_activation_v1", source_kind: "CANONICAL_TWIN_FACT_DIRECT", relation_name: null, object_id_column: null, expected_object_type: "twin_model_activation_v1" },
});

type JsonRecord = Record<string, unknown>;
type VisibleCanonicalFactV1 = { fact_id: string; record_json: JsonRecord; object: CanonicalObjectEnvelopeV1 };
type RecordSetIndexRowV1 = {
  identity_kind: string;
  idempotency_key: string;
  record_set_id: string;
  determinism_hash: string;
  identity_basis: JsonRecord | null;
  member_object_ids: unknown;
  member_determinism_hashes: unknown;
};

export type ResolvedRuntimeRootV1 = {
  root_ref: string;
  active_lineage: FieldTwinComposerObjectV1;
  active_lineage_authority_validation: FieldTwinSourceValidationResultV1 | null;
  checkpoint: FieldTwinComposerObjectV1;
  runtime_tick: FieldTwinComposerObjectV1;
  evidence_window: FieldTwinComposerObjectV1;
  state_transition: FieldTwinComposerObjectV1;
  assimilation_update: FieldTwinComposerObjectV1;
  posterior_state: FieldTwinComposerObjectV1;
  terminal_record_set_health: FieldTwinComposerObjectV1;
  terminal_health_role_resolution: FieldTwinRuntimeHealthRoleResolutionV1;
  runtime_config: FieldTwinComposerObjectV1;
  current_tick_forecast_result: FieldTwinComposerObjectV1;
  record_set_validation: FieldTwinRecordSetValidationV1;
  validation_summary: readonly FieldTwinSourceValidationResultV1[];
  canonical_objects_by_ref: ReadonlyMap<string, FieldTwinComposerObjectV1>;
  canonical_payloads_by_ref: ReadonlyMap<string, CanonicalObjectEnvelopeV1>;
};

function fail(code: string, detail?: string): never {
  throw new PostgresFieldTwinReadRepositoryErrorV1(code, detail);
}

function asRecord(value: unknown, code: string): JsonRecord {
  if (!value || typeof value !== "object" || Array.isArray(value)) fail(code);
  return value as JsonRecord;
}

function exactText(value: unknown, code: string): string {
  if (typeof value !== "string" || !value.trim()) fail(code);
  return value;
}

function optionalText(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value : null;
}

function exactStringArray(value: unknown, code: string): string[] {
  if (!Array.isArray(value) || value.some((item) => typeof item !== "string" || !item)) fail(code);
  return [...value];
}

function exactStringMap(value: unknown, code: string): Record<string, string> {
  const record = asRecord(value, code);
  for (const [key, item] of Object.entries(record)) if (!key || typeof item !== "string" || !item) fail(code);
  return record as Record<string, string>;
}

function scopeValues(scope: FieldTwinScopeV1): readonly string[] {
  return [scope.tenant_id, scope.project_id, scope.group_id, scope.field_id, scope.season_id, scope.zone_id];
}

function assertScope(object: CanonicalObjectEnvelopeV1, scope: FieldTwinScopeV1, code = "MCFT_CANONICAL_SCOPE_MISMATCH"): void {
  for (const key of ["tenant_id", "project_id", "group_id", "field_id", "season_id", "zone_id"] as const) {
    if (object[key] !== scope[key]) fail(code, key);
  }
}

function normalizeInstant(value: unknown, code: string): ReturnType<typeof canonicalUtcInstantV1> {
  const parsed = value instanceof Date ? value : new Date(String(value ?? ""));
  if (!Number.isFinite(parsed.getTime())) fail(code);
  return canonicalUtcInstantV1(parsed.toISOString());
}

function normalizeProjectionValue(value: unknown): unknown {
  if (value instanceof Date) return value.toISOString();
  if (Array.isArray(value)) return value.map(normalizeProjectionValue);
  if (value && typeof value === "object") return Object.fromEntries(Object.entries(value as JsonRecord).map(([key, item]) => [key, normalizeProjectionValue(item)]));
  if (typeof value === "string" && /^\d{4}-\d{2}-\d{2}T/.test(value)) {
    const parsed = new Date(value);
    if (Number.isFinite(parsed.getTime())) return parsed.toISOString();
  }
  return value;
}

function canonicalObjectRef(object: CanonicalObjectEnvelopeV1, factId: string): FieldTwinCanonicalObjectRefV1 {
  return { object_ref: object.object_id, object_type: object.object_type, object_hash: object.determinism_hash as SemanticHashTextV1, source_fact_ref: factId };
}

function composerObject(object: CanonicalObjectEnvelopeV1, factId: string, profile: FieldTwinComposerObjectV1["validation_profile"] = "CANONICAL_TWIN_FACT_DIRECT"): FieldTwinComposerObjectV1 {
  return Object.freeze({
    ...canonicalObjectRef(object, factId),
    scope: Object.freeze({ tenant_id: object.tenant_id, project_id: object.project_id, group_id: exactText(object.group_id, "MCFT_SCOPE_INVALID:group_id"), field_id: object.field_id, season_id: exactText(object.season_id, "MCFT_SCOPE_INVALID:season_id"), zone_id: exactText(object.zone_id, "MCFT_SCOPE_INVALID:zone_id") }),
    lineage_id: optionalText(object.lineage_id),
    revision_id: optionalText(object.revision_id),
    logical_time: normalizeInstant(object.logical_time, "MCFT_CANONICAL_LOGICAL_TIME_INVALID"),
    source_refs: Object.freeze((object.source_refs ?? []).map((value) => ({ ref_type: "SOURCE", ref_value: String(value) }))),
    evidence_refs: Object.freeze((object.evidence_refs ?? []).map((value) => ({ ref_type: "EVIDENCE", ref_value: String(value) }))),
    validation_profile: profile,
    validation_status: "PASS" as const,
    attachment_status: "ATTACHED_EXACT" as const,
  });
}

function parseVisibleFactRow(row: { fact_id: string; record_json: unknown }, scope: FieldTwinScopeV1): VisibleCanonicalFactV1 {
  const envelope = asRecord(row.record_json, "MCFT_FACT_ENVELOPE_INVALID");
  const object = asRecord(envelope.payload, "MCFT_FACT_ENVELOPE_INVALID:payload") as unknown as CanonicalObjectEnvelopeV1;
  if (envelope.type !== object.object_type) fail("MCFT_FACT_ENVELOPE_TYPE_MISMATCH", row.fact_id);
  assertScope(object, scope);
  const recomputed = computeMemberDeterminismHashV1(object as unknown as JsonRecord);
  if (recomputed !== object.determinism_hash) fail("MCFT_DIRECT_CANONICAL_TWIN_FACT_INVALID", `${row.fact_id}:DETERMINISM_HASH`);
  return { fact_id: row.fact_id, record_json: envelope, object };
}

async function assertRelation(client: PoolClient, relation: string): Promise<void> {
  const result = await client.query<{ exists: boolean }>("SELECT pg_catalog.to_regclass($1) IS NOT NULL AS exists", [relation]);
  if (result.rows[0]?.exists !== true) fail("MCFT_REQUIRED_READ_SCHEMA_UNAVAILABLE", relation);
}

export class PostgresFieldTwinReadRepositoryV1 {
  private readonly canonicalResolver = new CanonicalTwinFactResolverV1();
  private readonly projectionValidator = new AggregateProjectionValidatorV1();
  private readonly pointerValidator = new OperationalPointerValidatorV1();
  private readonly lineageValidator = new ActiveLineageAuthorityValidatorV1();
  private readonly healthRoleResolver = new RuntimeHealthRoleResolverV1();

  private async readVisibleObjectByRef(context: PostgresFieldTwinSnapshotContextV1, objectRef: string): Promise<VisibleCanonicalFactV1 | null> {
    const result = await context.client.query<{ fact_id: string; record_json: unknown }>(
      `SELECT f.fact_id, f.record_json
         FROM public.facts AS f
         JOIN public.twin_fact_visibility_index_v1 AS visibility ON visibility.fact_id = f.fact_id
        WHERE visibility.visibility_epoch_id = $1
          AND pg_catalog.pg_visible_in_snapshot(visibility.visibility_anchor_xid8, $2::pg_snapshot)
          AND f.record_json->'payload'->>'object_id' = $3
        LIMIT 2`,
      [context.canonical_visibility_snapshot.database_visibility_epoch_id, context.canonical_visibility_snapshot.pg_snapshot_token, objectRef],
    );
    if ((result.rowCount ?? 0) > 1) fail("MCFT_CANONICAL_OBJECT_ID_CARDINALITY_INVALID", objectRef);
    return result.rows[0] ? parseVisibleFactRow(result.rows[0], context.scope) : null;
  }

  private async readVisibleLineageByIdentity(context: PostgresFieldTwinSnapshotContextV1, lineageId: string): Promise<VisibleCanonicalFactV1> {
    const result = await context.client.query<{ fact_id: string; record_json: unknown }>(
      `SELECT f.fact_id,f.record_json
         FROM public.facts AS f
         JOIN public.twin_fact_visibility_index_v1 AS visibility ON visibility.fact_id=f.fact_id
        WHERE visibility.visibility_epoch_id=$1
          AND pg_catalog.pg_visible_in_snapshot(visibility.visibility_anchor_xid8,$2::pg_snapshot)
          AND f.record_json->>'type'='twin_runtime_lineage_v1'
          AND f.record_json->'payload'->>'lineage_id'=$3
        LIMIT 2`,
      [context.canonical_visibility_snapshot.database_visibility_epoch_id, context.canonical_visibility_snapshot.pg_snapshot_token, lineageId],
    );
    if ((result.rowCount ?? 0) !== 1) fail("MCFT_ACTIVE_LINEAGE_AUTHORITY_INVALID", `LINEAGE_ID:${lineageId}:${result.rowCount ?? 0}`);
    return parseVisibleFactRow(result.rows[0], context.scope);
  }

  private async validateCanonicalLineageAuthority(context: PostgresFieldTwinSnapshotContextV1, lineage: VisibleCanonicalFactV1, authorityRefHint?: string | null): Promise<FieldTwinSourceValidationResultV1> {
    const lineageKind = exactText(lineage.object.payload.lineage_kind, "MCFT_ACTIVE_LINEAGE_AUTHORITY_INVALID:LINEAGE_KIND");
    let authorityRef = authorityRefHint ?? optionalText(lineage.object.payload.activation_authority_ref);
    if (lineageKind === "INITIAL") {
      authorityRef = authorityRef ?? lineage.object.object_id;
      this.lineageValidator.validateInitial({ active_lineage_ref: lineage.object.object_id, activation_authority_ref: authorityRef, lineage_object_ref: lineage.object.object_id, lineage_kind: lineageKind, expected_previous_active_lineage: null });
    } else {
      authorityRef = authorityRef ?? optionalText(lineage.object.payload.promotion_ref);
      if (!authorityRef) fail("MCFT_REVISION_PROMOTION_CHAIN_INVALID", "PROMOTION_REF");
      const promotion = await this.requirePointerTarget(context, authorityRef, "twin_lineage_promotion_v1");
      const revisionRunRef = exactText(promotion.object.payload.revision_run_ref, "MCFT_REVISION_PROMOTION_CHAIN_INVALID:REVISION_RUN");
      const revision = await this.requirePointerTarget(context, revisionRunRef, "twin_revision_run_v1");
      this.lineageValidator.validateRevision({ active_lineage_ref: lineage.object.object_id, promotion_candidate_lineage_ref: exactText(promotion.object.payload.candidate_lineage_ref ?? promotion.object.payload.candidate_lineage_object_ref, "MCFT_REVISION_PROMOTION_CHAIN_INVALID:CANDIDATE"), candidate_lineage_kind: lineageKind, promotion_revision_run_ref: revisionRunRef, revision_run_ref: revision.object.object_id, revision_terminal_status: exactText(revision.object.payload.status ?? revision.object.payload.terminal_status, "MCFT_REVISION_PROMOTION_CHAIN_INVALID:STATUS"), validated_chain_refs: [lineage.object.object_id, authorityRef, revisionRunRef] });
    }
    return { source_name: "public.twin_active_lineage_index_v1", profile_family: "OPERATIONAL_POINTER_INDEX", validation_status: "PASS", failure_code: null, validated_object_ref: lineage.object.object_id, validated_object_hash: lineage.object.determinism_hash as SemanticHashTextV1, evidence_refs: [{ ref_type: "FACT", ref_value: lineage.fact_id }, { ref_type: "ACTIVATION_AUTHORITY", ref_value: authorityRef }] };
  }

  private async requireVisibleObject(context: PostgresFieldTwinSnapshotContextV1, objectRef: string, expectedType?: string, missingCode = "MCFT_EXACT_RESOURCE_NOT_FOUND"): Promise<VisibleCanonicalFactV1> {
    const fact = await this.readVisibleObjectByRef(context, objectRef);
    if (!fact) fail(missingCode, objectRef);
    if (expectedType && fact.object.object_type !== expectedType) fail("MCFT_CANONICAL_OBJECT_TYPE_MISMATCH", `${objectRef}:${expectedType}:${fact.object.object_type}`);
    return fact;
  }

  private requirePointerTarget(context: PostgresFieldTwinSnapshotContextV1, objectRef: string, expectedType: string): Promise<VisibleCanonicalFactV1> {
    return this.requireVisibleObject(context, objectRef, expectedType, "MCFT_OPERATIONAL_POINTER_TARGET_MISSING");
  }

  private async readScopePointer(context: PostgresFieldTwinSnapshotContextV1, relation: string): Promise<JsonRecord | null> {
    await assertRelation(context.client, relation);
    const result = await context.client.query<{ row_json: JsonRecord }>(
      `SELECT to_jsonb(pointer_row) AS row_json
         FROM ${relation} AS pointer_row
        WHERE tenant_id=$1 AND project_id=$2 AND group_id=$3 AND field_id=$4 AND season_id=$5 AND zone_id=$6
        LIMIT 2`,
      scopeValues(context.scope),
    );
    if ((result.rowCount ?? 0) > 1) fail("MCFT_POINTER_CARDINALITY_INVALID", relation);
    return result.rows[0]?.row_json ?? null;
  }

  private validatePointer(pointer: JsonRecord, refColumn: string, hashColumn: string | null, target: VisibleCanonicalFactV1, scope: FieldTwinScopeV1): FieldTwinSourceValidationResultV1 {
    this.pointerValidator.validate({
      pointer_ref: exactText(pointer[refColumn], `MCFT_OPERATIONAL_POINTER_INVALID:${refColumn}`),
      pointer_hash: hashColumn && pointer[hashColumn] != null ? exactText(pointer[hashColumn], `MCFT_OPERATIONAL_POINTER_INVALID:${hashColumn}`) as SemanticHashTextV1 : null,
      canonical_ref: target.object.object_id,
      canonical_hash: target.object.determinism_hash as SemanticHashTextV1,
      scope,
      canonical_scope: { tenant_id: target.object.tenant_id, project_id: target.object.project_id, group_id: exactText(target.object.group_id, "MCFT_SCOPE_INVALID"), field_id: target.object.field_id, season_id: exactText(target.object.season_id, "MCFT_SCOPE_INVALID"), zone_id: exactText(target.object.zone_id, "MCFT_SCOPE_INVALID") },
    });
    return { source_name: "operational_pointer", profile_family: "OPERATIONAL_POINTER_INDEX", validation_status: "PASS", failure_code: null, validated_object_ref: target.object.object_id, validated_object_hash: target.object.determinism_hash as SemanticHashTextV1, evidence_refs: [{ ref_type: "FACT", ref_value: target.fact_id }] };
  }

  private validateDirectCanonicalFact(fact: VisibleCanonicalFactV1): FieldTwinSourceValidationResultV1 {
    const supported = new Set(["twin_runtime_lineage_v1", "twin_revision_run_v1", "twin_lineage_promotion_v1", "twin_runtime_tick_v1", "twin_evidence_window_v1", "twin_state_transition_v1", "twin_assimilation_update_v1", "twin_runtime_attempt_v1", "twin_forecast_failure_v1", "twin_runtime_checkpoint_v1", "twin_runtime_health_v1", "twin_runtime_config_v1", "twin_model_activation_v1"]);
    if (supported.has(fact.object.object_type)) {
      this.canonicalResolver.resolve({ fact_id: fact.fact_id, record_json: fact.record_json, expected_type: fact.object.object_type as never, expected_object_ref: fact.object.object_id, expected_scope: { tenant_id: fact.object.tenant_id, project_id: fact.object.project_id, group_id: exactText(fact.object.group_id, "MCFT_SCOPE_INVALID"), field_id: fact.object.field_id, season_id: exactText(fact.object.season_id, "MCFT_SCOPE_INVALID"), zone_id: exactText(fact.object.zone_id, "MCFT_SCOPE_INVALID") }, expected_hash: fact.object.determinism_hash as SemanticHashTextV1 });
    }
    return { source_name: `public.facts#record_json.type=${fact.object.object_type}`, profile_family: "CANONICAL_TWIN_FACT_DIRECT", validation_status: "PASS", failure_code: null, validated_object_ref: fact.object.object_id, validated_object_hash: fact.object.determinism_hash as SemanticHashTextV1, evidence_refs: [{ ref_type: "FACT", ref_value: fact.fact_id }] };
  }

  private async resolveActiveLineage(context: PostgresFieldTwinSnapshotContextV1): Promise<{ fact: VisibleCanonicalFactV1; validation: FieldTwinSourceValidationResultV1 }> {
    const pointer = await this.readScopePointer(context, "public.twin_active_lineage_index_v1");
    if (!pointer) fail("MCFT_RUNTIME_NOT_ESTABLISHED");
    const lineageRef = exactText(pointer.active_lineage_ref, "MCFT_ACTIVE_LINEAGE_AUTHORITY_INVALID:REF");
    const lineage = await this.requirePointerTarget(context, lineageRef, "twin_runtime_lineage_v1");
    const authorityRef = exactText(pointer.activation_authority_ref, "MCFT_ACTIVE_LINEAGE_AUTHORITY_INVALID:AUTHORITY_REF");
    const validation = await this.validateCanonicalLineageAuthority(context, lineage, authorityRef);
    return { fact: lineage, validation };
  }

  private recomputeRecordSetHash(index: RecordSetIndexRowV1, members: readonly VisibleCanonicalFactV1[]): string {
    if (index.identity_kind === "A0_RECORD_SET") return computeA0RecordSetDeterminismHashV1({ a0_record_set_id: index.record_set_id, members: members.map((item) => item.object as unknown as JsonRecord) });
    if (index.identity_kind !== "A2_RECORD_SET") fail("MCFT_RECORD_SET_IDENTITY_INVALID", `IDENTITY_KIND:${index.identity_kind}`);
    const identityBasis = asRecord(index.identity_basis, "MCFT_RECORD_SET_IDENTITY_INVALID:IDENTITY_BASIS");
    const aggregate = asRecord(identityBasis.aggregate_identity_input, "MCFT_RECORD_SET_IDENTITY_INVALID:AGGREGATE_IDENTITY_INPUT");
    const contractId = optionalText(identityBasis.record_set_contract_id) ?? optionalText(aggregate.record_set_contract_id);
    if (contractId === ASSIMILATED_CONTINUATION_RECORD_SET_CONTRACT_ID_V1) return computeAssimilatedContinuationRecordSetDeterminismHashV1(aggregate as unknown as AssimilatedContinuationAggregateIdentityInputV1);
    if (contractId === ASSIMILATED_CONTINUATION_RECORD_SET_CONTRACT_ID_V2) return computeAssimilatedContinuationRecordSetDeterminismHashV2(aggregate as unknown as AssimilatedContinuationAggregateIdentityInputV2);
    return computeContinuationRecordSetDeterminismHashV1(aggregate as unknown as ContinuationAggregateIdentityInputV1);
  }

  private async resolveRecordSet(context: PostgresFieldTwinSnapshotContextV1, checkpointRef: string): Promise<{ index: RecordSetIndexRowV1; members: readonly VisibleCanonicalFactV1[]; validation: FieldTwinRecordSetValidationV1 }> {
    await assertRelation(context.client, "public.twin_object_idempotency_index_v1");
    const result = await context.client.query<RecordSetIndexRowV1>(
      `SELECT identity_kind,idempotency_key,record_set_id,determinism_hash,identity_basis,member_object_ids,member_determinism_hashes
         FROM public.twin_object_idempotency_index_v1
        WHERE identity_kind IN ('A0_RECORD_SET','A2_RECORD_SET')
          AND member_object_ids @> $1::jsonb
        LIMIT 2`,
      [JSON.stringify([checkpointRef])],
    );
    if ((result.rowCount ?? 0) !== 1) fail("MCFT_RECORD_SET_IDENTITY_INVALID", `CHECKPOINT_MEMBERSHIP:${result.rowCount ?? 0}`);
    const index = result.rows[0];
    const memberIds = exactStringArray(index.member_object_ids, "MCFT_RECORD_SET_IDENTITY_INVALID:MEMBER_IDS");
    const declaredHashes = exactStringMap(index.member_determinism_hashes, "MCFT_RECORD_SET_IDENTITY_INVALID:MEMBER_HASHES");
    if (memberIds.length === 0 || new Set(memberIds).size !== memberIds.length || Object.keys(declaredHashes).length !== memberIds.length) fail("MCFT_RECORD_SET_IDENTITY_INVALID", "MEMBER_CARDINALITY");
    const factsResult = await context.client.query<{ fact_id: string; record_json: unknown }>(
      `SELECT f.fact_id,f.record_json
         FROM public.facts AS f
         JOIN public.twin_fact_visibility_index_v1 AS visibility ON visibility.fact_id=f.fact_id
        WHERE visibility.visibility_epoch_id=$1
          AND pg_catalog.pg_visible_in_snapshot(visibility.visibility_anchor_xid8,$2::pg_snapshot)
          AND f.record_json->'payload'->>'object_id'=ANY($3::text[])
        ORDER BY f.record_json->'payload'->>'object_id' ASC`,
      [context.canonical_visibility_snapshot.database_visibility_epoch_id, context.canonical_visibility_snapshot.pg_snapshot_token, memberIds],
    );
    if ((factsResult.rowCount ?? 0) !== memberIds.length) fail("MCFT_RECORD_SET_IDENTITY_INVALID", "VISIBLE_MEMBER_COUNT");
    const members = factsResult.rows.map((row) => parseVisibleFactRow(row, context.scope));
    const actualIds = members.map((item) => item.object.object_id).sort();
    if (canonicalJsonV1(actualIds) !== canonicalJsonV1([...memberIds].sort())) fail("MCFT_RECORD_SET_IDENTITY_INVALID", "MEMBER_IDS");
    for (const member of members) if (declaredHashes[member.object.object_id] !== member.object.determinism_hash) fail("MCFT_RECORD_SET_IDENTITY_INVALID", `MEMBER_HASH:${member.object.object_id}`);
    const recomputed = this.recomputeRecordSetHash(index, members);
    if (recomputed !== index.determinism_hash) fail("MCFT_RECORD_SET_IDENTITY_INVALID", "AGGREGATE_HASH");
    const refs = members.map((member) => canonicalObjectRef(member.object, member.fact_id)).sort((a, b) => a.object_ref.localeCompare(b.object_ref));
    return { index, members, validation: { validation_status: "PASS", record_set_id: index.record_set_id, identity_kind: index.identity_kind, aggregate_determinism_hash: index.determinism_hash as SemanticHashTextV1, recomputed_aggregate_determinism_hash: recomputed as SemanticHashTextV1, exact_member_count: refs.length, exact_member_refs: refs, failure_code: null } };
  }

  private exactMemberByType(members: readonly VisibleCanonicalFactV1[], objectType: string): VisibleCanonicalFactV1 {
    const matches = members.filter((member) => member.object.object_type === objectType);
    if (matches.length !== 1) fail("MCFT_RUNTIME_MANDATORY_ROOT_INVALID", `${objectType}:${matches.length}`);
    return matches[0];
  }

  private async resolveRootFromCheckpoint(context: PostgresFieldTwinSnapshotContextV1, checkpointRef: string, active?: { fact: VisibleCanonicalFactV1; validation: FieldTwinSourceValidationResultV1 }): Promise<ResolvedRuntimeRootV1> {
    const checkpoint = await this.requireVisibleObject(context, checkpointRef, "twin_runtime_checkpoint_v1");
    const recordSet = await this.resolveRecordSet(context, checkpointRef);
    const tick = this.exactMemberByType(recordSet.members, "twin_runtime_tick_v1");
    const evidenceWindow = this.exactMemberByType(recordSet.members, "twin_evidence_window_v1");
    const stateTransition = this.exactMemberByType(recordSet.members, "twin_state_transition_v1");
    const assimilation = this.exactMemberByType(recordSet.members, "twin_assimilation_update_v1");
    const posterior = this.exactMemberByType(recordSet.members, "twin_state_estimate_v1");
    const forecast = this.exactMemberByType(recordSet.members, "twin_forecast_run_v1");
    const health = this.exactMemberByType(recordSet.members, "twin_runtime_health_v1");
    if (!recordSet.members.some((member) => member.object.object_id === checkpointRef)) fail("MCFT_RUNTIME_CHECKPOINT_NOT_RECORD_SET_MEMBER");
    const tickPayload = tick.object.payload;
    const checkpointPayload = checkpoint.object.payload;
    const exactRefChecks: Array<[unknown, string, string]> = [
      [checkpointPayload.last_completed_tick_ref, tick.object.object_id, "CHECKPOINT_TICK"],
      [tickPayload.checkpoint_ref, checkpoint.object.object_id, "TICK_CHECKPOINT"],
      [tickPayload.evidence_window_ref, evidenceWindow.object.object_id, "EVIDENCE_WINDOW"],
      [tickPayload.state_transition_ref, stateTransition.object.object_id, "STATE_TRANSITION"],
      [tickPayload.assimilation_update_ref, assimilation.object.object_id, "ASSIMILATION_UPDATE"],
      [tickPayload.posterior_state_ref, posterior.object.object_id, "POSTERIOR_STATE"],
      [tickPayload.forecast_result_ref, forecast.object.object_id, "FORECAST_RESULT"],
      [checkpointPayload.last_posterior_state_ref, posterior.object.object_id, "CHECKPOINT_POSTERIOR"],
      [checkpointPayload.forecast_result_ref, forecast.object.object_id, "CHECKPOINT_FORECAST"],
    ];
    for (const [actual, expected, label] of exactRefChecks) if (actual !== expected) fail("MCFT_RUNTIME_GRAPH_REFERENCE_MISMATCH", label);
    const runtimeConfigRefs = new Set(recordSet.members.map((member) => optionalText(member.object.runtime_config_ref)).filter((value): value is string => value !== null));
    const runtimeConfigHashes = new Set(recordSet.members.map((member) => optionalText(member.object.runtime_config_hash)).filter((value): value is string => value !== null));
    if (runtimeConfigRefs.size !== 1 || runtimeConfigHashes.size !== 1) fail("MCFT_RUNTIME_CONFIG_REFERENCE_MISMATCH");
    const runtimeConfigRef = [...runtimeConfigRefs][0];
    const runtimeConfigHash = [...runtimeConfigHashes][0];
    const runtimeConfig = await this.requireVisibleObject(context, runtimeConfigRef, "twin_runtime_config_v1", "MCFT_RUNTIME_GRAPH_INCOMPLETE");
    if (runtimeConfig.object.determinism_hash !== runtimeConfigHash) fail("MCFT_RUNTIME_CONFIG_HASH_MISMATCH");
    const lineageIdentity = optionalText(checkpoint.object.lineage_id) ?? optionalText(tick.object.lineage_id);
    if (!lineageIdentity) fail("MCFT_ACTIVE_LINEAGE_AUTHORITY_INVALID", "ROOT_LINEAGE_MISSING");
    const lineage = active?.fact ?? (recordSet.members.find((member) => member.object.object_type === "twin_runtime_lineage_v1") ?? await this.readVisibleLineageByIdentity(context, lineageIdentity));
    if (optionalText(lineage.object.lineage_id) !== lineageIdentity) fail("MCFT_ACTIVE_LINEAGE_AUTHORITY_INVALID", "ROOT_LINEAGE_ID");
    const lineageAuthorityValidation = active?.validation ?? await this.validateCanonicalLineageAuthority(context, lineage);
    const terminalResolution = this.healthRoleResolver.resolve({ health_object_ref: health.object.object_id, record_set_membership: { record_set_id: recordSet.index.record_set_id, member_refs: recordSet.members.map((member) => member.object.object_id) }, operational_attempt_relation: null });
    const validations = [this.validateDirectCanonicalFact(lineage), this.validateDirectCanonicalFact(checkpoint), this.validateDirectCanonicalFact(tick), this.validateDirectCanonicalFact(evidenceWindow), this.validateDirectCanonicalFact(stateTransition), this.validateDirectCanonicalFact(assimilation), this.validateDirectCanonicalFact(forecast), this.validateDirectCanonicalFact(health), this.validateDirectCanonicalFact(runtimeConfig)];
    if (active) validations.unshift(active.validation);
    const allFacts = [lineage, checkpoint, tick, evidenceWindow, stateTransition, assimilation, posterior, forecast, health, runtimeConfig];
    const composerMap = new Map(allFacts.map((fact) => [fact.object.object_id, composerObject(fact.object, fact.fact_id)]));
    const payloadMap = new Map(allFacts.map((fact) => [fact.object.object_id, fact.object]));
    return {
      root_ref: checkpoint.object.object_id,
      active_lineage: composerMap.get(lineage.object.object_id)!, active_lineage_authority_validation: lineageAuthorityValidation,
      checkpoint: composerMap.get(checkpoint.object.object_id)!, runtime_tick: composerMap.get(tick.object.object_id)!, evidence_window: composerMap.get(evidenceWindow.object.object_id)!, state_transition: composerMap.get(stateTransition.object.object_id)!, assimilation_update: composerMap.get(assimilation.object.object_id)!, posterior_state: composerMap.get(posterior.object.object_id)!, terminal_record_set_health: composerMap.get(health.object.object_id)!, terminal_health_role_resolution: terminalResolution, runtime_config: composerMap.get(runtimeConfig.object.object_id)!, current_tick_forecast_result: composerMap.get(forecast.object.object_id)!, record_set_validation: recordSet.validation, validation_summary: Object.freeze(validations), canonical_objects_by_ref: composerMap, canonical_payloads_by_ref: payloadMap,
    };
  }

  async resolveCurrentRuntimeRoot(context: PostgresFieldTwinSnapshotContextV1): Promise<ResolvedRuntimeRootV1> {
    const active = await this.resolveActiveLineage(context);
    const checkpointPointer = await this.readScopePointer(context, "public.twin_runtime_checkpoint_latest_index_v1");
    if (!checkpointPointer) fail("MCFT_RUNTIME_GRAPH_INCOMPLETE", "CHECKPOINT_POINTER_MISSING");
    const checkpointRef = exactText(checkpointPointer.checkpoint_object_id, "MCFT_OPERATIONAL_POINTER_INVALID:checkpoint_object_id");
    const checkpoint = await this.requirePointerTarget(context, checkpointRef, "twin_runtime_checkpoint_v1");
    const pointerValidation = this.validatePointer(checkpointPointer, "checkpoint_object_id", "determinism_hash", checkpoint, context.scope);
    if (optionalText(checkpointPointer.lineage_id) !== optionalText(active.fact.object.lineage_id)) fail("MCFT_RUNTIME_CHECKPOINT_LINEAGE_MISMATCH");
    const root = await this.resolveRootFromCheckpoint(context, checkpointRef, active);
    return { ...root, validation_summary: Object.freeze([pointerValidation, ...root.validation_summary]) };
  }

  resolveHistoricalRuntimeRoot(context: PostgresFieldTwinSnapshotContextV1, checkpointRef: string): Promise<ResolvedRuntimeRootV1> {
    return this.resolveRootFromCheckpoint(context, checkpointRef);
  }

  private async readValidatedProjectionItems(context: PostgresFieldTwinSnapshotContextV1, spec: McftCollectionSourceSpecV1, limitPlusOne: number, boundary: { logical_time: string; object_ref: string } | null): Promise<readonly FieldTwinCollectionItemV1[]> {
    if (!spec.relation_name || !spec.object_id_column) fail("MCFT_COLLECTION_KIND_INVALID", spec.collection_kind);
    await assertRelation(context.client, spec.relation_name);
    const params: unknown[] = [...scopeValues(context.scope)];
    let boundarySql = "";
    if (boundary) {
      params.push(boundary.logical_time, boundary.object_ref);
      boundarySql = ` AND (logical_time < $7::timestamptz OR (logical_time = $7::timestamptz AND ${spec.object_id_column} > $8))`;
    }
    params.push(limitPlusOne);
    const limitIndex = params.length;
    const result = await context.client.query<{ row_json: JsonRecord }>(
      `SELECT to_jsonb(source_row) AS row_json
         FROM ${spec.relation_name} AS source_row
        WHERE tenant_id=$1 AND project_id=$2 AND group_id=$3 AND field_id=$4 AND season_id=$5 AND zone_id=$6
          ${boundarySql}
        ORDER BY logical_time DESC, ${spec.object_id_column} ASC
        LIMIT $${limitIndex}`,
      params,
    );
    const obligation = resolveMcftCap07S4SourceObligationV1(spec.source_name);
    const items: FieldTwinCollectionItemV1[] = [];
    for (const rawRow of result.rows) {
      const row = normalizeProjectionValue(rawRow.row_json) as JsonRecord;
      const objectRef = exactText(row[spec.object_id_column], `${obligation.failure_code}:IDENTITY`);
      const sourceFactId = exactText(row.source_fact_id, `${obligation.failure_code}:SOURCE_FACT`);
      const fact = await this.requireVisibleObject(context, objectRef, spec.expected_object_type);
      if (fact.fact_id !== sourceFactId) fail(obligation.failure_code, "SOURCE_FACT_ID");
      this.projectionValidator.validate({ obligation, projection_row: row, canonical_context: { record_json: fact.record_json, facts: { fact_id: fact.fact_id } } });
      items.push({ object_ref: fact.object.object_id, object_type: fact.object.object_type, object_hash: fact.object.determinism_hash as SemanticHashTextV1, logical_time: normalizeInstant(fact.object.logical_time, "MCFT_COLLECTION_LOGICAL_TIME_INVALID"), attachment_status: "ATTACHED_EXACT" });
    }
    return items;
  }

  private async readDirectCanonicalItems(context: PostgresFieldTwinSnapshotContextV1, spec: McftCollectionSourceSpecV1, limitPlusOne: number, boundary: { logical_time: string; object_ref: string } | null): Promise<readonly FieldTwinCollectionItemV1[]> {
    const params: unknown[] = [context.canonical_visibility_snapshot.database_visibility_epoch_id, context.canonical_visibility_snapshot.pg_snapshot_token, spec.expected_object_type, ...scopeValues(context.scope)];
    let boundarySql = "";
    if (boundary) {
      params.push(boundary.logical_time, boundary.object_ref);
      boundarySql = ` AND ((f.record_json->'payload'->>'logical_time')::timestamptz < $10::timestamptz OR ((f.record_json->'payload'->>'logical_time')::timestamptz = $10::timestamptz AND f.record_json->'payload'->>'object_id' > $11))`;
    }
    params.push(limitPlusOne);
    const limitIndex = params.length;
    const result = await context.client.query<{ fact_id: string; record_json: unknown }>(
      `SELECT f.fact_id,f.record_json
         FROM public.facts AS f
         JOIN public.twin_fact_visibility_index_v1 AS visibility ON visibility.fact_id=f.fact_id
        WHERE visibility.visibility_epoch_id=$1
          AND pg_catalog.pg_visible_in_snapshot(visibility.visibility_anchor_xid8,$2::pg_snapshot)
          AND f.record_json->>'type'=$3
          AND f.record_json->'payload'->>'tenant_id'=$4 AND f.record_json->'payload'->>'project_id'=$5 AND f.record_json->'payload'->>'group_id'=$6
          AND f.record_json->'payload'->>'field_id'=$7 AND f.record_json->'payload'->>'season_id'=$8 AND f.record_json->'payload'->>'zone_id'=$9
          ${boundarySql}
        ORDER BY (f.record_json->'payload'->>'logical_time')::timestamptz DESC, f.record_json->'payload'->>'object_id' ASC
        LIMIT $${limitIndex}`,
      params,
    );
    return result.rows.map((row) => {
      const fact = parseVisibleFactRow(row, context.scope);
      this.validateDirectCanonicalFact(fact);
      return { object_ref: fact.object.object_id, object_type: fact.object.object_type, object_hash: fact.object.determinism_hash as SemanticHashTextV1, logical_time: normalizeInstant(fact.object.logical_time, "MCFT_COLLECTION_LOGICAL_TIME_INVALID"), attachment_status: "ATTACHED_EXACT" as const };
    });
  }

  readCollectionItems(context: PostgresFieldTwinSnapshotContextV1, spec: McftCollectionSourceSpecV1, limitPlusOne: number, boundary: { logical_time: string; object_ref: string } | null): Promise<readonly FieldTwinCollectionItemV1[]> {
    if (!Number.isInteger(limitPlusOne) || limitPlusOne < 2 || limitPlusOne > 201) fail("MCFT_COLLECTION_LIMIT_INVALID");
    return spec.source_kind === "CANONICAL_AGGREGATE_PROJECTION" ? this.readValidatedProjectionItems(context, spec, limitPlusOne, boundary) : this.readDirectCanonicalItems(context, spec, limitPlusOne, boundary);
  }

  async readCollectionSummary(context: PostgresFieldTwinSnapshotContextV1, spec: McftCollectionSourceSpecV1): Promise<{ total_count: number; latest_item: FieldTwinCollectionItemV1 | null }> {
    const items = await this.readCollectionItems(context, spec, 2, null);
    let totalCount = 0;
    if (spec.source_kind === "CANONICAL_AGGREGATE_PROJECTION") {
      if (!spec.relation_name) fail("MCFT_COLLECTION_KIND_INVALID");
      const result = await context.client.query<{ count: string }>(`SELECT pg_catalog.count(*)::text AS count FROM ${spec.relation_name} WHERE tenant_id=$1 AND project_id=$2 AND group_id=$3 AND field_id=$4 AND season_id=$5 AND zone_id=$6`, scopeValues(context.scope));
      totalCount = Number(result.rows[0]?.count ?? 0);
    } else {
      const result = await context.client.query<{ count: string }>(`SELECT pg_catalog.count(*)::text AS count FROM public.facts AS f JOIN public.twin_fact_visibility_index_v1 AS visibility ON visibility.fact_id=f.fact_id WHERE visibility.visibility_epoch_id=$1 AND pg_catalog.pg_visible_in_snapshot(visibility.visibility_anchor_xid8,$2::pg_snapshot) AND f.record_json->>'type'=$3 AND f.record_json->'payload'->>'tenant_id'=$4 AND f.record_json->'payload'->>'project_id'=$5 AND f.record_json->'payload'->>'group_id'=$6 AND f.record_json->'payload'->>'field_id'=$7 AND f.record_json->'payload'->>'season_id'=$8 AND f.record_json->'payload'->>'zone_id'=$9`, [context.canonical_visibility_snapshot.database_visibility_epoch_id, context.canonical_visibility_snapshot.pg_snapshot_token, spec.expected_object_type, ...scopeValues(context.scope)]);
      totalCount = Number(result.rows[0]?.count ?? 0);
    }
    if (!Number.isSafeInteger(totalCount) || totalCount < 0) fail("MCFT_RUNTIME_COLLECTION_CARDINALITY_INVALID", spec.collection_kind);
    return { total_count: totalCount, latest_item: items[0] ?? null };
  }

  async readExactObjectByRef(context: PostgresFieldTwinSnapshotContextV1, objectRef: string, expectedType?: string): Promise<{ object: FieldTwinComposerObjectV1; payload: CanonicalObjectEnvelopeV1; validation: FieldTwinSourceValidationResultV1 }> {
    const fact = await this.requireVisibleObject(context, objectRef, expectedType, "MCFT_RUNTIME_GRAPH_INCOMPLETE");
    const validation = this.validateDirectCanonicalFact(fact);
    return { object: composerObject(fact.object, fact.fact_id), payload: fact.object, validation };
  }

  async readOptionalScopePointerObject(context: PostgresFieldTwinSnapshotContextV1, input: { relation: string; ref_column: string; hash_column?: string | null; expected_type: string }): Promise<{ object: FieldTwinComposerObjectV1; payload: CanonicalObjectEnvelopeV1; validation: FieldTwinSourceValidationResultV1 } | null> {
    const pointer = await this.readScopePointer(context, input.relation);
    if (!pointer) return null;
    const ref = exactText(pointer[input.ref_column], `MCFT_OPERATIONAL_POINTER_INVALID:${input.ref_column}`);
    const fact = await this.requirePointerTarget(context, ref, input.expected_type);
    const validation = this.validatePointer(pointer, input.ref_column, input.hash_column ?? null, fact, context.scope);
    return { object: composerObject(fact.object, fact.fact_id), payload: fact.object, validation };
  }

  async readLatestOperationalHealth(context: PostgresFieldTwinSnapshotContextV1, root: ResolvedRuntimeRootV1): Promise<{ object: FieldTwinComposerObjectV1 | null; resolution: FieldTwinRuntimeHealthRoleResolutionV1 | null; validation: FieldTwinSourceValidationResultV1 | null }> {
    const pointer = await this.readScopePointer(context, "public.twin_runtime_health_latest_index_v1");
    if (!pointer) return { object: null, resolution: null, validation: null };
    const ref = exactText(pointer.health_object_id, "MCFT_OPERATIONAL_POINTER_INVALID:health_object_id");
    const fact = await this.requirePointerTarget(context, ref, "twin_runtime_health_v1");
    const validation = this.validatePointer(pointer, "health_object_id", "determinism_hash", fact, context.scope);
    if (ref === root.terminal_record_set_health.object_ref) return { object: root.terminal_record_set_health, resolution: root.terminal_health_role_resolution, validation };
    const attemptRef = exactText(fact.object.payload.attempt_ref, "MCFT_RUNTIME_HEALTH_ROLE_UNRESOLVED:ATTEMPT_REF");
    const attempt = await this.requirePointerTarget(context, attemptRef, "twin_runtime_attempt_v1");
    const failureRef = optionalText(fact.object.payload.forecast_failure_ref);
    if (failureRef) {
      const failure = await this.requirePointerTarget(context, failureRef, "twin_forecast_failure_v1");
      if (failure.object.payload.attempt_ref !== attemptRef) fail("MCFT_RUNTIME_HEALTH_ROLE_UNRESOLVED", "FORECAST_FAILURE_ATTEMPT");
    }
    const resolution = this.healthRoleResolver.resolve({ health_object_ref: ref, record_set_membership: null, operational_attempt_relation: { attempt_ref: attempt.object.object_id, health_ref: ref, forecast_failure_ref: failureRef } });
    return { object: composerObject(fact.object, fact.fact_id), resolution, validation };
  }

  async readTimelineEvents(context: PostgresFieldTwinSnapshotContextV1, limitPlusOne: number, filter: { from_logical_time: string | null; until_logical_time: string | null }, boundary: { logical_time: string; event_rank: number; object_ref: string } | null): Promise<readonly FieldTwinTimelineEventV1[]> {
    if (!Number.isInteger(limitPlusOne) || limitPlusOne < 2 || limitPlusOne > 201) fail("MCFT_COLLECTION_LIMIT_INVALID");
    const typeRanks: Record<string, FieldTwinTimelineEventV1["event_kind"]> = {
      twin_evidence_window_v1: "EVIDENCE_WINDOW", twin_state_transition_v1: "STATE_TRANSITION", twin_assimilation_update_v1: "ASSIMILATION_UPDATE", twin_state_estimate_v1: "POSTERIOR_STATE", twin_forecast_run_v1: "FORECAST_RESULT", twin_forecast_failure_v1: "FORECAST_FAILURE", twin_runtime_tick_v1: "RUNTIME_TICK", twin_runtime_checkpoint_v1: "CHECKPOINT", twin_runtime_health_v1: "RUNTIME_HEALTH", twin_scenario_set_v1: "SCENARIO_SET", twin_decision_record_v1: "HUMAN_DECISION", approved_irrigation_plan_snapshot_v1: "APPROVED_PLAN_EVIDENCE", twin_action_feedback_v1: "ACTION_FEEDBACK", twin_forecast_residual_v1: "FORECAST_RESIDUAL", twin_calibration_candidate_v1: "CALIBRATION_CANDIDATE", twin_shadow_evaluation_v1: "SHADOW_EVALUATION", twin_model_activation_v1: "MODEL_ACTIVATION",
    };
    const types = Object.keys(typeRanks);
    const all = await context.client.query<{ fact_id: string; record_json: unknown }>(
      `SELECT f.fact_id,f.record_json
         FROM public.facts AS f
         JOIN public.twin_fact_visibility_index_v1 AS visibility ON visibility.fact_id=f.fact_id
        WHERE visibility.visibility_epoch_id=$1
          AND pg_catalog.pg_visible_in_snapshot(visibility.visibility_anchor_xid8,$2::pg_snapshot)
          AND f.record_json->>'type'=ANY($3::text[])
          AND f.record_json->'payload'->>'tenant_id'=$4 AND f.record_json->'payload'->>'project_id'=$5 AND f.record_json->'payload'->>'group_id'=$6
          AND f.record_json->'payload'->>'field_id'=$7 AND f.record_json->'payload'->>'season_id'=$8 AND f.record_json->'payload'->>'zone_id'=$9
        ORDER BY (f.record_json->'payload'->>'logical_time')::timestamptz ASC, f.record_json->'payload'->>'object_id' ASC
        LIMIT 201`,
      [context.canonical_visibility_snapshot.database_visibility_epoch_id, context.canonical_visibility_snapshot.pg_snapshot_token, types, ...scopeValues(context.scope)],
    );
    const events: FieldTwinTimelineEventV1[] = [];
    for (const row of all.rows) {
      const envelope = asRecord(row.record_json, "MCFT_FACT_ENVELOPE_INVALID");
      const type = exactText(envelope.type, "MCFT_FACT_ENVELOPE_INVALID:TYPE");
      const kind = typeRanks[type];
      if (!kind) continue;
      const fact = parseVisibleFactRow(row, context.scope);
      const logicalTime = normalizeInstant(fact.object.logical_time, "MCFT_TIMELINE_LOGICAL_TIME_INVALID");
      if (filter.from_logical_time && logicalTime < filter.from_logical_time) continue;
      if (filter.until_logical_time && logicalTime >= filter.until_logical_time) continue;
      const rank = FIELD_TWIN_TIMELINE_EVENT_RANKS_V1[kind];
      if (boundary) {
        const after = logicalTime > boundary.logical_time || (logicalTime === boundary.logical_time && (rank > boundary.event_rank || (rank === boundary.event_rank && fact.object.object_id > boundary.object_ref)));
        if (!after) continue;
      }
      events.push({ event_id: `event:${row.fact_id}`, event_kind: kind, event_rank: rank, object_ref: fact.object.object_id, object_type: fact.object.object_type, object_hash: fact.object.determinism_hash as SemanticHashTextV1, scope: context.scope, lineage_id: optionalText(fact.object.lineage_id), revision_id: optionalText(fact.object.revision_id), logical_time: logicalTime, as_of: normalizeInstant(fact.object.as_of, "MCFT_TIMELINE_AS_OF_INVALID"), observed_at: null, available_to_runtime_at: null, created_at: normalizeInstant(fact.object.created_at, "MCFT_TIMELINE_CREATED_AT_INVALID"), transaction_family: null, health_role: null, health_resolution_basis: null, health_resolution_evidence_refs: null, atomic_group_ref: null, source_fact_ref: row.fact_id, source_refs: [{ ref_type: "FACT", ref_value: row.fact_id }], evidence_refs: [{ ref_type: "FACT", ref_value: row.fact_id }], attachment_status: "ATTACHED_EXACT", limitations: fact.object.limitations.map((reason) => ({ reason_code: reason, object_ref: fact.object.object_id, detail: null })) });
    }
    return events.sort((left, right) => left.logical_time.localeCompare(right.logical_time) || left.event_rank - right.event_rank || left.object_ref.localeCompare(right.object_ref)).slice(0, limitPlusOne);
  }
}
