// apps/server/src/persistence/twin_runtime/postgres_calibration_governance_persistence_repository_v1.ts
// Purpose: atomically append MCFT-CAP-06 D Candidate or Evaluation canonical objects to public.facts with serializable idempotency, strict projections and facts-based recovery.
// Boundary: exactly one canonical object per D transaction; no Candidate computation, Shadow computation, active-config index, State, checkpoint, approval, route, scheduler or Model Activation mutation.

import type { Pool, PoolClient } from "pg";
import { semanticHashV1 } from "../../domain/twin_runtime/canonical_identity_v1.js";
import type {
  Cap06CalibrationCandidateDraftV1,
  Cap06ShadowEvaluationDraftV1,
} from "../../domain/calibration/envelope_profiles_v1.js";
import {
  buildCap06CalibrationCandidateProjectionRowV1,
  buildCap06ShadowEvaluationProjectionRowsV1,
} from "../../projections/twin_runtime/calibration_governance_projection_v1.js";

export type Cap06CalibrationGovernanceObjectV1 =
  | Cap06CalibrationCandidateDraftV1
  | Cap06ShadowEvaluationDraftV1;

export type Cap06CalibrationGovernancePersistenceStatusV1 =
  | "INSERTED"
  | "EXISTING_IDEMPOTENT_SUCCESS"
  | "EXISTING_RECOVERED";

export type Cap06CalibrationGovernancePersistenceResultV1 = {
  status: Cap06CalibrationGovernancePersistenceStatusV1;
  object: Cap06CalibrationGovernanceObjectV1;
  fact_id: string;
};

export type Cap06CalibrationGovernanceRecoverySummaryV1 = {
  canonical_objects_scanned: number;
  idempotency_guards_rebuilt: number;
  candidate_projections_rebuilt: number;
  evaluation_projections_rebuilt: number;
  candidate_evaluation_links_rebuilt: number;
  evaluation_case_rows_rebuilt: number;
};

type Cap06DIdentityKindV1 = "D_CALIBRATION_CANDIDATE" | "D_SHADOW_EVALUATION";

type ParsedFactV1 = {
  fact_id: string;
  type: string;
  payload: unknown;
};

const CANDIDATE_TYPE_V1 = "twin_calibration_candidate_v1" as const;
const EVALUATION_TYPE_V1 = "twin_shadow_evaluation_v1" as const;

function factIdV1(objectId: string): string {
  return `fact_${objectId}`;
}

function recordJsonV1(object: Cap06CalibrationGovernanceObjectV1): string {
  return JSON.stringify({ type: object.object_type, payload: object });
}

function parseRecordJsonV1(factId: string, value: unknown): ParsedFactV1 {
  const parsed = typeof value === "string" ? JSON.parse(value) : value;
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
    throw new Error("CAP06_D_FACT_RECORD_JSON_INVALID");
  }
  const record = parsed as Record<string, unknown>;
  if (typeof record.type !== "string" || record.type.length === 0) {
    throw new Error("CAP06_D_FACT_RECORD_TYPE_REQUIRED");
  }
  return { fact_id: factId, type: record.type, payload: record.payload };
}

function requiredStringV1(value: unknown, code: string): string {
  if (typeof value !== "string" || value.length === 0) throw new Error(code);
  return value;
}

function requiredBooleanV1(value: unknown, code: string): boolean {
  if (typeof value !== "boolean") throw new Error(code);
  return value;
}

function requiredRecordV1(value: unknown, code: string): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error(code);
  return value as Record<string, unknown>;
}

function requiredStringArrayV1(value: unknown, code: string): string[] {
  if (!Array.isArray(value) || value.some((item) => typeof item !== "string" || item.length === 0)) {
    throw new Error(code);
  }
  return [...value] as string[];
}

function requireExactIsoV1(value: unknown, code: string): string {
  const text = requiredStringV1(value, code);
  if (new Date(text).toISOString() !== text) throw new Error(code);
  return text;
}

function expectedDeterminismHashV1(object: Cap06CalibrationGovernanceObjectV1): string {
  return semanticHashV1({ ...structuredClone(object), determinism_hash: "" });
}

function identityKindV1(object: Cap06CalibrationGovernanceObjectV1): Cap06DIdentityKindV1 {
  if (object.object_type === CANDIDATE_TYPE_V1) return "D_CALIBRATION_CANDIDATE";
  if (object.object_type === EVALUATION_TYPE_V1) return "D_SHADOW_EVALUATION";
  throw new Error("CAP06_D_OBJECT_TYPE_UNSUPPORTED");
}

function validateCommonEnvelopeV1(object: Cap06CalibrationGovernanceObjectV1): void {
  requiredStringV1(object.object_id, "CAP06_D_OBJECT_ID_REQUIRED");
  requiredStringV1(object.idempotency_key, "CAP06_D_IDEMPOTENCY_KEY_REQUIRED");
  requireExactIsoV1(object.logical_time, "CAP06_D_LOGICAL_TIME_REQUIRED");
  requireExactIsoV1(object.as_of, "CAP06_D_AS_OF_REQUIRED");
  requiredStringV1(object.runtime_config_ref, "CAP06_D_RUNTIME_CONFIG_REF_REQUIRED");
  requiredStringV1(object.runtime_config_hash, "CAP06_D_RUNTIME_CONFIG_HASH_REQUIRED");
  requiredStringArrayV1(object.source_refs, "CAP06_D_SOURCE_REFS_REQUIRED");
  requiredStringArrayV1(object.evidence_refs, "CAP06_D_EVIDENCE_REFS_REQUIRED");
  if (object.record_class !== "CANONICAL_MODEL_GOVERNANCE_HISTORY") {
    throw new Error("CAP06_D_RECORD_CLASS_INVALID");
  }
  if (object.lineage_member !== false || object.envelope_profile !== "NON_LINEAGE_CONTEXT") {
    throw new Error("CAP06_D_NON_LINEAGE_PROFILE_REQUIRED");
  }
  for (const [key, value] of Object.entries(object.scope)) {
    requiredStringV1(value, `CAP06_D_SCOPE_${key.toUpperCase()}_REQUIRED`);
  }
  if (object.determinism_hash !== expectedDeterminismHashV1(object)) {
    throw new Error("CAP06_D_DETERMINISM_HASH_MISMATCH");
  }
}

function validateCandidateV1(object: Cap06CalibrationCandidateDraftV1): void {
  validateCommonEnvelopeV1(object);
  if (object.schema_version !== "v1") throw new Error("CAP06_D_CANDIDATE_SCHEMA_INVALID");
  if (!object.idempotency_key.startsWith("CALIBRATION_CANDIDATE:")) {
    throw new Error("CAP06_D_CANDIDATE_IDEMPOTENCY_PREFIX_INVALID");
  }
  requiredStringV1(object.context_lineage_ref, "CAP06_D_CANDIDATE_LINEAGE_REQUIRED");
  requiredStringV1(object.context_revision_ref, "CAP06_D_CANDIDATE_REVISION_REQUIRED");
  const payload = requiredRecordV1(object.payload, "CAP06_D_CANDIDATE_PAYLOAD_REQUIRED");
  const status = requiredStringV1(payload.candidate_status, "CAP06_D_CANDIDATE_STATUS_REQUIRED");
  if (!new Set(["BOUNDED_PARAMETER_DELTA_CANDIDATE", "NO_OP_BASE_PARAMETER_RETAINED"]).has(status)) {
    throw new Error("CAP06_D_CANDIDATE_STATUS_INVALID");
  }
  const residualRefs = requiredStringArrayV1(payload.residual_refs, "CAP06_D_CANDIDATE_RESIDUAL_REFS_REQUIRED");
  if (residualRefs.length !== 16 || new Set(residualRefs).size !== 16) {
    throw new Error("CAP06_D_CANDIDATE_EXACTLY_16_RESIDUALS_REQUIRED");
  }
  if (object.source_refs.length !== 17 || object.source_refs.slice(0, 16).some((ref, index) => ref !== residualRefs[index])) {
    throw new Error("CAP06_D_CANDIDATE_SOURCE_REFS_INVALID");
  }
  if (object.source_refs[16] !== object.runtime_config_ref) {
    throw new Error("CAP06_D_CANDIDATE_BASE_CONFIG_SOURCE_REF_REQUIRED");
  }
  if (object.evidence_refs.length !== 16 || new Set(object.evidence_refs).size !== 16) {
    throw new Error("CAP06_D_CANDIDATE_EXACTLY_16_OBSERVATIONS_REQUIRED");
  }
  requiredStringV1(payload.calibration_run_id, "CAP06_D_CALIBRATION_RUN_ID_REQUIRED");
  requiredStringV1(payload.case_input_set_hash, "CAP06_D_CASE_INPUT_SET_HASH_REQUIRED");
  requiredStringV1(payload.candidate_parameter_value, "CAP06_D_CANDIDATE_PARAMETER_REQUIRED");
  if (requiredStringV1(payload.activation_status, "CAP06_D_ACTIVATION_STATUS_REQUIRED") !== "NOT_ACTIVE") {
    throw new Error("CAP06_D_CANDIDATE_PREMATURE_ACTIVATION");
  }
  if (requiredBooleanV1(payload.eligible_for_state_input, "CAP06_D_STATE_ELIGIBILITY_REQUIRED") !== false
    || requiredBooleanV1(payload.eligible_for_runtime_config_use, "CAP06_D_CONFIG_ELIGIBILITY_REQUIRED") !== false
    || requiredBooleanV1(payload.eligible_for_human_activation_review, "CAP06_D_CANDIDATE_REVIEW_FLAG_REQUIRED") !== false) {
    throw new Error("CAP06_D_CANDIDATE_PREMATURE_ELIGIBILITY");
  }
}

function validateEvaluationV1(object: Cap06ShadowEvaluationDraftV1): void {
  validateCommonEnvelopeV1(object);
  if (object.schema_version !== "v1") throw new Error("CAP06_D_EVALUATION_SCHEMA_INVALID");
  if (!object.idempotency_key.startsWith("SHADOW_EVALUATION:")) {
    throw new Error("CAP06_D_EVALUATION_IDEMPOTENCY_PREFIX_INVALID");
  }
  const payload = requiredRecordV1(object.payload, "CAP06_D_EVALUATION_PAYLOAD_REQUIRED");
  if (requiredStringV1(payload.evaluation_kind, "CAP06_D_EVALUATION_KIND_REQUIRED")
    !== "PAIRED_HISTORICAL_REPLAY_SHADOW_EVALUATION") {
    throw new Error("CAP06_D_EVALUATION_KIND_INVALID");
  }
  const candidateRef = requiredStringV1(payload.candidate_ref, "CAP06_D_EVALUATION_CANDIDATE_REF_REQUIRED");
  if (object.source_refs.length !== 9 || object.source_refs[0] !== candidateRef) {
    throw new Error("CAP06_D_EVALUATION_SOURCE_REFS_INVALID");
  }
  if (object.evidence_refs.length !== 8 || new Set(object.evidence_refs).size !== 8) {
    throw new Error("CAP06_D_EVALUATION_EXACTLY_8_OBSERVATIONS_REQUIRED");
  }
  const caseResults = payload.case_results;
  if (!Array.isArray(caseResults) || caseResults.length !== 8) {
    throw new Error("CAP06_D_EVALUATION_EXACTLY_8_CASES_REQUIRED");
  }
  requiredStringV1(payload.candidate_hash, "CAP06_D_EVALUATION_CANDIDATE_HASH_REQUIRED");
  requiredStringV1(payload.case_results_hash, "CAP06_D_CASE_RESULTS_HASH_REQUIRED");
  if (requiredBooleanV1(payload.model_activation_created, "CAP06_D_MODEL_ACTIVATION_FLAG_REQUIRED") !== false
    || requiredBooleanV1(payload.active_config_switch_performed, "CAP06_D_ACTIVE_CONFIG_SWITCH_FLAG_REQUIRED") !== false
    || requiredBooleanV1(payload.approval_created, "CAP06_D_APPROVAL_FLAG_REQUIRED") !== false
    || requiredBooleanV1(payload.activation_authorized, "CAP06_D_ACTIVATION_AUTHORITY_FLAG_REQUIRED") !== false) {
    throw new Error("CAP06_D_EVALUATION_PREMATURE_AUTHORITY");
  }
}

function validateObjectV1(object: Cap06CalibrationGovernanceObjectV1): void {
  if (object.object_type === CANDIDATE_TYPE_V1) validateCandidateV1(object);
  else if (object.object_type === EVALUATION_TYPE_V1) validateEvaluationV1(object);
  else throw new Error("CAP06_D_OBJECT_TYPE_UNSUPPORTED");
}

function parseCanonicalObjectV1(fact: ParsedFactV1): Cap06CalibrationGovernanceObjectV1 {
  const object = fact.payload as Cap06CalibrationGovernanceObjectV1;
  if (!object || typeof object !== "object") throw new Error("CAP06_D_CANONICAL_FACT_PAYLOAD_MISSING");
  if (fact.type !== object.object_type) throw new Error("CAP06_D_CANONICAL_FACT_TYPE_MISMATCH");
  validateObjectV1(object);
  return object;
}

function objectIdentityBasisV1(object: Cap06CalibrationGovernanceObjectV1): Record<string, unknown> {
  return {
    transaction_id: "D_MODEL_GOVERNANCE_STEP_COMMIT",
    object_type: object.object_type,
    object_id: object.object_id,
    idempotency_key: object.idempotency_key,
    scope: structuredClone(object.scope),
    logical_time: object.logical_time,
    as_of: object.as_of,
    runtime_config_ref: object.runtime_config_ref,
    runtime_config_hash: object.runtime_config_hash,
  };
}

function isPgUniqueViolationV1(error: unknown): boolean {
  return Boolean(error && typeof error === "object" && (error as { code?: unknown }).code === "23505");
}

export class PostgresCalibrationGovernancePersistenceRepositoryV1 {
  constructor(private readonly pool: Pool) {}

  async readCanonicalObject(objectId: string): Promise<Cap06CalibrationGovernanceObjectV1 | null> {
    const client = await this.pool.connect();
    try {
      return await this.readCanonicalObjectWithClientV1(client, objectId);
    } finally {
      client.release();
    }
  }

  private async readCanonicalObjectWithClientV1(
    client: PoolClient,
    objectId: string,
  ): Promise<Cap06CalibrationGovernanceObjectV1 | null> {
    const result = await client.query(
      `SELECT fact_id,record_json FROM facts
       WHERE record_json->'payload'->>'object_id'=$1
         AND record_json->>'type' IN ('twin_calibration_candidate_v1','twin_shadow_evaluation_v1')
       LIMIT 2`,
      [objectId],
    );
    if (result.rows.length === 0) return null;
    if (result.rows.length !== 1) throw new Error("CAP06_D_CANONICAL_OBJECT_ID_NOT_UNIQUE");
    return parseCanonicalObjectV1(parseRecordJsonV1(result.rows[0].fact_id, result.rows[0].record_json));
  }

  async lookupByIdempotencyKey(idempotencyKey: string): Promise<Cap06CalibrationGovernanceObjectV1 | null> {
    const guard = await this.pool.query(
      `SELECT record_set_id FROM twin_object_idempotency_index_v1
       WHERE identity_kind IN ('D_CALIBRATION_CANDIDATE','D_SHADOW_EVALUATION')
         AND idempotency_key=$1`,
      [idempotencyKey],
    );
    if (guard.rows.length === 0) return null;
    if (guard.rows.length !== 1) throw new Error("CAP06_D_IDEMPOTENCY_KEY_NOT_UNIQUE");
    return this.readCanonicalObject(guard.rows[0].record_set_id);
  }

  async commitCanonicalObject(input: {
    object: Cap06CalibrationGovernanceObjectV1;
    fault_injection?: (stage: string) => void;
  }): Promise<Cap06CalibrationGovernancePersistenceResultV1> {
    validateObjectV1(input.object);
    const client = await this.pool.connect();
    const inject = (stage: string) => input.fault_injection?.(stage);
    try {
      await client.query("BEGIN");
      await client.query("SELECT pg_advisory_xact_lock(hashtextextended($1,0))", [input.object.idempotency_key]);
      const existingGuard = await client.query(
        `SELECT identity_kind,record_set_id,determinism_hash
         FROM twin_object_idempotency_index_v1
         WHERE idempotency_key=$1 FOR UPDATE`,
        [input.object.idempotency_key],
      );
      if (existingGuard.rows.length > 0) {
        if (existingGuard.rows.length !== 1
          || existingGuard.rows[0].identity_kind !== identityKindV1(input.object)
          || existingGuard.rows[0].record_set_id !== input.object.object_id
          || existingGuard.rows[0].determinism_hash !== input.object.determinism_hash) {
          throw new Error("CAP06_D_IDEMPOTENCY_CONFLICT");
        }
        const existing = await this.readCanonicalObjectWithClientV1(client, input.object.object_id);
        if (!existing || existing.determinism_hash !== input.object.determinism_hash) {
          throw new Error("CAP06_D_IDEMPOTENT_OBJECT_INCOMPLETE");
        }
        await this.verifyEvaluationCandidateWithClientV1(client, existing);
        await this.upsertProjectionWithClientV1(client, existing, factIdV1(existing.object_id));
        await client.query("COMMIT");
        return {
          status: "EXISTING_IDEMPOTENT_SUCCESS",
          object: existing,
          fact_id: factIdV1(existing.object_id),
        };
      }

      const canonicalExisting = await this.readCanonicalObjectWithClientV1(client, input.object.object_id);
      if (canonicalExisting) {
        if (canonicalExisting.idempotency_key !== input.object.idempotency_key
          || canonicalExisting.determinism_hash !== input.object.determinism_hash
          || canonicalExisting.object_type !== input.object.object_type) {
          throw new Error("CAP06_D_CANONICAL_OBJECT_CONFLICT");
        }
        await this.verifyEvaluationCandidateWithClientV1(client, canonicalExisting);
        await this.insertIdempotencyGuardWithClientV1(client, canonicalExisting);
        await this.upsertProjectionWithClientV1(client, canonicalExisting, factIdV1(canonicalExisting.object_id));
        await client.query("COMMIT");
        return {
          status: "EXISTING_RECOVERED",
          object: canonicalExisting,
          fact_id: factIdV1(canonicalExisting.object_id),
        };
      }

      await this.verifyEvaluationCandidateWithClientV1(client, input.object);
      inject("before_fact");
      const factId = factIdV1(input.object.object_id);
      await client.query(
        `INSERT INTO facts (fact_id,occurred_at,source,record_json)
         VALUES ($1,$2::timestamptz,'mcft_cap06_d_model_governance_v1',$3::jsonb)`,
        [factId, input.object.logical_time, recordJsonV1(input.object)],
      );
      inject("before_projection");
      await this.upsertProjectionWithClientV1(client, input.object, factId);
      inject("before_idempotency_guard");
      await this.insertIdempotencyGuardWithClientV1(client, input.object);
      inject("before_commit");
      await client.query("COMMIT");
      return { status: "INSERTED", object: input.object, fact_id: factId };
    } catch (error) {
      await client.query("ROLLBACK");
      if (isPgUniqueViolationV1(error)) throw new Error("CAP06_D_PERSISTENCE_UNIQUENESS_CONFLICT");
      throw error;
    } finally {
      client.release();
    }
  }

  private async verifyEvaluationCandidateWithClientV1(
    client: PoolClient,
    object: Cap06CalibrationGovernanceObjectV1,
  ): Promise<void> {
    if (object.object_type !== EVALUATION_TYPE_V1) return;
    const payload = requiredRecordV1(object.payload, "CAP06_D_EVALUATION_PAYLOAD_REQUIRED");
    const candidateRef = requiredStringV1(payload.candidate_ref, "CAP06_D_EVALUATION_CANDIDATE_REF_REQUIRED");
    const candidateHash = requiredStringV1(payload.candidate_hash, "CAP06_D_EVALUATION_CANDIDATE_HASH_REQUIRED");
    const candidate = await this.readCanonicalObjectWithClientV1(client, candidateRef);
    if (!candidate || candidate.object_type !== CANDIDATE_TYPE_V1) {
      throw new Error("CAP06_D_EVALUATION_CANDIDATE_NOT_CANONICAL");
    }
    if (candidate.determinism_hash !== candidateHash) {
      throw new Error("CAP06_D_EVALUATION_CANDIDATE_HASH_MISMATCH");
    }
    if (candidate.runtime_config_ref !== object.runtime_config_ref
      || candidate.runtime_config_hash !== object.runtime_config_hash) {
      throw new Error("CAP06_D_EVALUATION_BASE_CONFIG_MISMATCH");
    }
  }

  private async insertIdempotencyGuardWithClientV1(
    client: PoolClient,
    object: Cap06CalibrationGovernanceObjectV1,
  ): Promise<void> {
    await client.query(
      `INSERT INTO twin_object_idempotency_index_v1
       (identity_kind,idempotency_key,record_set_id,determinism_hash,identity_basis,member_object_ids,member_determinism_hashes)
       VALUES ($1,$2,$3,$4,$5::jsonb,$6::jsonb,$7::jsonb)`,
      [
        identityKindV1(object),
        object.idempotency_key,
        object.object_id,
        object.determinism_hash,
        JSON.stringify(objectIdentityBasisV1(object)),
        JSON.stringify({ [object.object_type]: object.object_id }),
        JSON.stringify({ [object.object_id]: object.determinism_hash }),
      ],
    );
  }

  private async assertProjectionIdentityV1(input: {
    client: PoolClient;
    table: string;
    idColumn: string;
    idValue: string;
    determinismHash: string;
    sourceFactId: string;
  }): Promise<void> {
    const result = await input.client.query(
      `SELECT determinism_hash,source_fact_id FROM ${input.table} WHERE ${input.idColumn}=$1`,
      [input.idValue],
    );
    if (result.rows.length !== 1
      || result.rows[0].determinism_hash !== input.determinismHash
      || result.rows[0].source_fact_id !== input.sourceFactId) {
      throw new Error("CAP06_D_PROJECTION_DIVERGENCE");
    }
  }

  private async upsertProjectionWithClientV1(
    client: PoolClient,
    object: Cap06CalibrationGovernanceObjectV1,
    factId: string,
  ): Promise<void> {
    if (object.object_type === CANDIDATE_TYPE_V1) {
      const row = buildCap06CalibrationCandidateProjectionRowV1(object, factId);
      await client.query(
        `INSERT INTO twin_calibration_candidate_projection_v1
         (candidate_object_id,tenant_id,project_id,group_id,field_id,season_id,zone_id,logical_time,as_of,
          runtime_config_ref,runtime_config_hash,context_lineage_ref,context_revision_ref,candidate_status,calibration_run_id,
          base_parameter_value,candidate_parameter_value,parameter_delta,activation_status,eligible_for_state_input,
          eligible_for_runtime_config_use,eligible_for_human_activation_review,determinism_hash,canonical_payload,source_fact_id)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8::timestamptz,$9::timestamptz,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21,$22,$23,$24::jsonb,$25)
         ON CONFLICT (candidate_object_id) DO NOTHING`,
        [
          row.candidate_object_id,row.tenant_id,row.project_id,row.group_id,row.field_id,row.season_id,row.zone_id,
          row.logical_time,row.as_of,row.runtime_config_ref,row.runtime_config_hash,row.context_lineage_ref,row.context_revision_ref,
          row.candidate_status,row.calibration_run_id,row.base_parameter_value,row.candidate_parameter_value,row.parameter_delta,
          row.activation_status,row.eligible_for_state_input,row.eligible_for_runtime_config_use,
          row.eligible_for_human_activation_review,row.determinism_hash,JSON.stringify(row.canonical_payload),row.source_fact_id,
        ],
      );
      await this.assertProjectionIdentityV1({
        client,
        table: "twin_calibration_candidate_projection_v1",
        idColumn: "candidate_object_id",
        idValue: row.candidate_object_id,
        determinismHash: row.determinism_hash,
        sourceFactId: row.source_fact_id,
      });
      return;
    }

    const rows = buildCap06ShadowEvaluationProjectionRowsV1(object, factId);
    const row = rows.evaluation;
    await client.query(
      `INSERT INTO twin_shadow_evaluation_projection_v1
       (evaluation_object_id,tenant_id,project_id,group_id,field_id,season_id,zone_id,logical_time,as_of,
        runtime_config_ref,runtime_config_hash,candidate_ref,candidate_hash,evaluation_kind,evaluation_disposition,
        eligible_for_human_activation_review,holdout_window_ref_membership_hash,holdout_purpose,holdout_generalization_claim,
        case_results_hash,model_activation_created,active_config_switch_performed,approval_created,activation_authorized,
        determinism_hash,canonical_payload,source_fact_id)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8::timestamptz,$9::timestamptz,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21,$22,$23,$24,$25,$26::jsonb,$27)
       ON CONFLICT (evaluation_object_id) DO NOTHING`,
      [
        row.evaluation_object_id,row.tenant_id,row.project_id,row.group_id,row.field_id,row.season_id,row.zone_id,
        row.logical_time,row.as_of,row.runtime_config_ref,row.runtime_config_hash,row.candidate_ref,row.candidate_hash,
        row.evaluation_kind,row.evaluation_disposition,row.eligible_for_human_activation_review,
        row.holdout_window_ref_membership_hash,row.holdout_purpose,row.holdout_generalization_claim,row.case_results_hash,
        row.model_activation_created,row.active_config_switch_performed,row.approval_created,row.activation_authorized,
        row.determinism_hash,JSON.stringify(row.canonical_payload),row.source_fact_id,
      ],
    );
    await this.assertProjectionIdentityV1({
      client,
      table: "twin_shadow_evaluation_projection_v1",
      idColumn: "evaluation_object_id",
      idValue: row.evaluation_object_id,
      determinismHash: row.determinism_hash,
      sourceFactId: row.source_fact_id,
    });

    await client.query(
      `INSERT INTO twin_candidate_evaluation_index_v1
       (candidate_ref,evaluation_ref,evaluation_hash,evaluation_disposition,source_fact_id)
       VALUES ($1,$2,$3,$4,$5)
       ON CONFLICT (candidate_ref,evaluation_ref) DO NOTHING`,
      [
        rows.candidate_index.candidate_ref,
        rows.candidate_index.evaluation_ref,
        rows.candidate_index.evaluation_hash,
        rows.candidate_index.evaluation_disposition,
        rows.candidate_index.source_fact_id,
      ],
    );
    const link = await client.query(
      `SELECT evaluation_hash,evaluation_disposition,source_fact_id
       FROM twin_candidate_evaluation_index_v1
       WHERE candidate_ref=$1 AND evaluation_ref=$2`,
      [rows.candidate_index.candidate_ref, rows.candidate_index.evaluation_ref],
    );
    if (link.rows.length !== 1
      || link.rows[0].evaluation_hash !== rows.candidate_index.evaluation_hash
      || link.rows[0].evaluation_disposition !== rows.candidate_index.evaluation_disposition
      || link.rows[0].source_fact_id !== rows.candidate_index.source_fact_id) {
      throw new Error("CAP06_D_CANDIDATE_EVALUATION_INDEX_DIVERGENCE");
    }

    for (const caseRow of rows.cases) {
      await client.query(
        `INSERT INTO twin_shadow_evaluation_case_projection_v1
         (evaluation_ref,case_index,residual_ref,residual_hash,source_forecast_ref,source_forecast_hash,
          source_forecast_point_ref,source_posterior_ref,source_runtime_config_ref,observation_ref,
          forecast_target_time,observation_available_to_runtime_at,base_parameter_value,candidate_parameter_value,
          base_prediction_vwc,candidate_prediction_vwc,actual_observation_vwc,base_residual_vwc,candidate_residual_vwc,
          base_invariant_status,candidate_invariant_status,base_mass_balance_status,candidate_mass_balance_status,source_fact_id)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11::timestamptz,$12::timestamptz,$13,$14,$15,$16,$17,$18,$19,$20,$21,$22,$23,$24)
         ON CONFLICT (evaluation_ref,case_index) DO NOTHING`,
        [
          caseRow.evaluation_ref,caseRow.case_index,caseRow.residual_ref,caseRow.residual_hash,
          caseRow.source_forecast_ref,caseRow.source_forecast_hash,caseRow.source_forecast_point_ref,
          caseRow.source_posterior_ref,caseRow.source_runtime_config_ref,caseRow.observation_ref,
          caseRow.forecast_target_time,caseRow.observation_available_to_runtime_at,caseRow.base_parameter_value,
          caseRow.candidate_parameter_value,caseRow.base_prediction_vwc,caseRow.candidate_prediction_vwc,
          caseRow.actual_observation_vwc,caseRow.base_residual_vwc,caseRow.candidate_residual_vwc,
          caseRow.base_invariant_status,caseRow.candidate_invariant_status,caseRow.base_mass_balance_status,
          caseRow.candidate_mass_balance_status,caseRow.source_fact_id,
        ],
      );
      const persistedCase = await client.query(
        `SELECT residual_hash,source_fact_id FROM twin_shadow_evaluation_case_projection_v1
         WHERE evaluation_ref=$1 AND case_index=$2`,
        [caseRow.evaluation_ref, caseRow.case_index],
      );
      if (persistedCase.rows.length !== 1
        || persistedCase.rows[0].residual_hash !== caseRow.residual_hash
        || persistedCase.rows[0].source_fact_id !== caseRow.source_fact_id) {
        throw new Error("CAP06_D_EVALUATION_CASE_PROJECTION_DIVERGENCE");
      }
    }
  }

  async rebuildAllSupportState(): Promise<Cap06CalibrationGovernanceRecoverySummaryV1> {
    const client = await this.pool.connect();
    try {
      await client.query("BEGIN");
      await client.query("DELETE FROM twin_shadow_evaluation_case_projection_v1");
      await client.query("DELETE FROM twin_candidate_evaluation_index_v1");
      await client.query("DELETE FROM twin_shadow_evaluation_projection_v1");
      await client.query("DELETE FROM twin_calibration_candidate_projection_v1");
      await client.query(
        `DELETE FROM twin_object_idempotency_index_v1
         WHERE identity_kind IN ('D_CALIBRATION_CANDIDATE','D_SHADOW_EVALUATION')`,
      );

      const canonicalFacts = await client.query(
        `SELECT fact_id,record_json FROM facts
         WHERE record_json->>'type' IN ('twin_calibration_candidate_v1','twin_shadow_evaluation_v1')
         ORDER BY CASE record_json->>'type' WHEN 'twin_calibration_candidate_v1' THEN 0 ELSE 1 END, fact_id`,
      );
      const objects = canonicalFacts.rows.map((row) =>
        parseCanonicalObjectV1(parseRecordJsonV1(row.fact_id, row.record_json)));
      let candidates = 0;
      let evaluations = 0;
      let links = 0;
      let cases = 0;
      for (let index = 0; index < objects.length; index += 1) {
        const object = objects[index];
        const factId = canonicalFacts.rows[index].fact_id as string;
        await this.verifyEvaluationCandidateWithClientV1(client, object);
        await this.insertIdempotencyGuardWithClientV1(client, object);
        await this.upsertProjectionWithClientV1(client, object, factId);
        if (object.object_type === CANDIDATE_TYPE_V1) candidates += 1;
        else {
          evaluations += 1;
          links += 1;
          cases += 8;
        }
      }
      await client.query("COMMIT");
      return {
        canonical_objects_scanned: objects.length,
        idempotency_guards_rebuilt: objects.length,
        candidate_projections_rebuilt: candidates,
        evaluation_projections_rebuilt: evaluations,
        candidate_evaluation_links_rebuilt: links,
        evaluation_case_rows_rebuilt: cases,
      };
    } catch (error) {
      await client.query("ROLLBACK");
      if (isPgUniqueViolationV1(error)) throw new Error("CAP06_D_RECOVERY_CANONICAL_DIVERGENCE");
      throw error;
    } finally {
      client.release();
    }
  }
}
