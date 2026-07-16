// apps/server/src/persistence/calibration/postgres_calibration_governance_repository_v1.ts
// Purpose: atomically append MCFT-CAP-06 Calibration Candidate or Shadow Evaluation canonical history to public.facts with deterministic idempotency, rebuildable projections, concurrency serialization, readback, and facts-based recovery.
// Boundary: D_MODEL_GOVERNANCE_STEP_COMMIT persistence only; no calibration math, shadow compute, active-config mutation, Model Activation, State, checkpoint, approval, route, scheduler, filesystem, environment, or network authority.

import type { Pool, PoolClient } from "pg";
import { semanticHashV1 } from "../../domain/twin_runtime/canonical_identity_v1.js";
import {
  CAP06_CANDIDATE_APPENDING_STATUSES_V1,
  CAP06_SHADOW_DISPOSITIONS_V1,
} from "../../domain/calibration/contracts_v1.js";
import type {
  Cap06CalibrationCandidateDraftV1,
  Cap06ShadowEvaluationDraftV1,
} from "../../domain/calibration/envelope_profiles_v1.js";
import {
  buildCap06CandidateProjectionRowV1,
  buildCap06EvaluationProjectionRowsV1,
} from "../../projections/calibration/calibration_governance_projection_v1.js";

export type Cap06GovernanceObjectV1 =
  | Cap06CalibrationCandidateDraftV1
  | Cap06ShadowEvaluationDraftV1;

export type Cap06GovernancePersistenceStatusV1 =
  | "INSERTED"
  | "EXISTING_IDEMPOTENT_SUCCESS"
  | "EXISTING_RECOVERED";

export type Cap06GovernancePersistenceResultV1 = {
  status: Cap06GovernancePersistenceStatusV1;
  object: Cap06GovernanceObjectV1;
  fact_id: string;
};

export type Cap06GovernanceRecoverySummaryV1 = {
  canonical_objects_scanned: number;
  idempotency_guards_rebuilt: number;
  candidate_projections_rebuilt: number;
  evaluation_projections_rebuilt: number;
  candidate_evaluation_rows_rebuilt: number;
  evaluation_case_rows_rebuilt: number;
};

type Cap06IdentityKindV1 = "D_CALIBRATION_CANDIDATE" | "D_SHADOW_EVALUATION";

type ParsedFactV1 = {
  fact_id: string;
  type: string;
  payload: unknown;
};

const CANDIDATE_TYPE_V1 = "twin_calibration_candidate_v1" as const;
const EVALUATION_TYPE_V1 = "twin_shadow_evaluation_v1" as const;

function requiredStringV1(value: unknown, code: string): string {
  if (typeof value !== "string" || !value.trim()) throw new Error(code);
  return value;
}

function requiredRecordV1(value: unknown, code: string): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error(code);
  return value as Record<string, unknown>;
}

function requiredStringArrayV1(value: unknown, code: string): string[] {
  if (!Array.isArray(value) || value.length === 0) throw new Error(code);
  const values = value.map((item) => requiredStringV1(item, code));
  if (new Set(values).size !== values.length) throw new Error(`${code}_DUPLICATE`);
  return values;
}

function canonicalInstantV1(value: unknown, code: string): string {
  const text = requiredStringV1(value, code);
  const parsed = Date.parse(text);
  if (!Number.isFinite(parsed) || new Date(parsed).toISOString() !== text) throw new Error(code);
  return text;
}

function factIdV1(objectId: string): string {
  return `fact_${requiredStringV1(objectId, "CAP06_PERSISTENCE_OBJECT_ID_REQUIRED")}`;
}

function recordJsonV1(object: Cap06GovernanceObjectV1): string {
  return JSON.stringify({ type: object.object_type, payload: object });
}

function parseRecordJsonV1(factId: string, value: unknown): ParsedFactV1 {
  const parsed = typeof value === "string" ? JSON.parse(value) : value;
  const record = requiredRecordV1(parsed, "CAP06_FACT_RECORD_JSON_INVALID");
  return {
    fact_id: requiredStringV1(factId, "CAP06_FACT_ID_REQUIRED"),
    type: requiredStringV1(record.type, "CAP06_FACT_RECORD_TYPE_REQUIRED"),
    payload: record.payload,
  };
}

function identityKindV1(object: Cap06GovernanceObjectV1): Cap06IdentityKindV1 {
  if (object.object_type === CANDIDATE_TYPE_V1) return "D_CALIBRATION_CANDIDATE";
  if (object.object_type === EVALUATION_TYPE_V1) return "D_SHADOW_EVALUATION";
  throw new Error("CAP06_PERSISTENCE_OBJECT_TYPE_UNSUPPORTED");
}

function identityBasisV1(object: Cap06GovernanceObjectV1): Record<string, unknown> {
  return {
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

function validateDeterminismV1(object: Cap06GovernanceObjectV1): void {
  const semantic = structuredClone(object) as Cap06GovernanceObjectV1;
  semantic.determinism_hash = "";
  if (object.determinism_hash !== semanticHashV1(semantic)) {
    throw new Error("CAP06_CANONICAL_DETERMINISM_HASH_MISMATCH");
  }
}

function validateCommonV1(object: Cap06GovernanceObjectV1): void {
  requiredStringV1(object.object_id, "CAP06_CANONICAL_OBJECT_ID_REQUIRED");
  if (object.schema_version !== "v1") throw new Error("CAP06_CANONICAL_SCHEMA_VERSION_INVALID");
  if (object.record_class !== "CANONICAL_MODEL_GOVERNANCE_HISTORY") {
    throw new Error("CAP06_CANONICAL_RECORD_CLASS_INVALID");
  }
  if (object.lineage_member !== false || object.envelope_profile !== "NON_LINEAGE_CONTEXT") {
    throw new Error("CAP06_CANONICAL_NON_LINEAGE_PROFILE_INVALID");
  }
  const scope = requiredRecordV1(object.scope, "CAP06_CANONICAL_SCOPE_REQUIRED");
  for (const key of ["tenant_id", "project_id", "group_id", "field_id", "season_id", "zone_id"] as const) {
    requiredStringV1(scope[key], `CAP06_CANONICAL_SCOPE_${key.toUpperCase()}_REQUIRED`);
  }
  canonicalInstantV1(object.logical_time, "CAP06_CANONICAL_LOGICAL_TIME_INVALID");
  canonicalInstantV1(object.as_of, "CAP06_CANONICAL_AS_OF_INVALID");
  requiredStringArrayV1(object.source_refs, "CAP06_CANONICAL_SOURCE_REFS_REQUIRED");
  requiredStringArrayV1(object.evidence_refs, "CAP06_CANONICAL_EVIDENCE_REFS_REQUIRED");
  requiredStringV1(object.runtime_config_ref, "CAP06_CANONICAL_RUNTIME_CONFIG_REF_REQUIRED");
  requiredStringV1(object.runtime_config_hash, "CAP06_CANONICAL_RUNTIME_CONFIG_HASH_REQUIRED");
  requiredStringV1(object.idempotency_key, "CAP06_CANONICAL_IDEMPOTENCY_KEY_REQUIRED");
  requiredStringV1(object.determinism_hash, "CAP06_CANONICAL_DETERMINISM_HASH_REQUIRED");
  validateDeterminismV1(object);
}

function validateCandidateV1(object: Cap06CalibrationCandidateDraftV1): void {
  validateCommonV1(object);
  if (!object.idempotency_key.startsWith("CALIBRATION_CANDIDATE:")) {
    throw new Error("CAP06_CANDIDATE_IDEMPOTENCY_PREFIX_INVALID");
  }
  requiredStringV1(object.context_lineage_ref, "CAP06_CANDIDATE_CONTEXT_LINEAGE_REQUIRED");
  requiredStringV1(object.context_revision_ref, "CAP06_CANDIDATE_CONTEXT_REVISION_REQUIRED");
  const payload = requiredRecordV1(object.payload, "CAP06_CANDIDATE_PAYLOAD_REQUIRED");
  if (!CAP06_CANDIDATE_APPENDING_STATUSES_V1.includes(payload.candidate_status as never)) {
    throw new Error("CAP06_CANDIDATE_STATUS_NOT_CANONICALIZABLE");
  }
  const residualRefs = requiredStringArrayV1(payload.residual_refs, "CAP06_CANDIDATE_RESIDUAL_REFS_REQUIRED");
  if (residualRefs.length !== 16) throw new Error("CAP06_CANDIDATE_RESIDUAL_COUNT_INVALID");
  const expectedSources = [...residualRefs, object.runtime_config_ref];
  if (semanticHashV1(object.source_refs) !== semanticHashV1(expectedSources)) {
    throw new Error("CAP06_CANDIDATE_SOURCE_REFS_MISMATCH");
  }
  if (object.evidence_refs.length !== 16) throw new Error("CAP06_CANDIDATE_EVIDENCE_COUNT_INVALID");
  if (payload.activation_status !== "NOT_ACTIVE"
    || payload.eligible_for_state_input !== false
    || payload.eligible_for_runtime_config_use !== false
    || payload.eligible_for_human_activation_review !== false) {
    throw new Error("CAP06_CANDIDATE_NON_ACTIVATION_BOUNDARY_VIOLATION");
  }
}

function validateEvaluationV1(object: Cap06ShadowEvaluationDraftV1): void {
  validateCommonV1(object);
  if (!object.idempotency_key.startsWith("SHADOW_EVALUATION:")) {
    throw new Error("CAP06_EVALUATION_IDEMPOTENCY_PREFIX_INVALID");
  }
  const payload = requiredRecordV1(object.payload, "CAP06_EVALUATION_PAYLOAD_REQUIRED");
  const candidateRef = requiredStringV1(payload.candidate_ref, "CAP06_EVALUATION_CANDIDATE_REF_REQUIRED");
  requiredStringV1(payload.candidate_hash, "CAP06_EVALUATION_CANDIDATE_HASH_REQUIRED");
  const datasetRefs = requiredStringArrayV1(
    payload.evaluation_dataset_refs,
    "CAP06_EVALUATION_DATASET_REFS_REQUIRED",
  );
  if (datasetRefs.length !== 8) throw new Error("CAP06_EVALUATION_DATASET_COUNT_INVALID");
  const expectedSources = [candidateRef, ...datasetRefs];
  if (semanticHashV1(object.source_refs) !== semanticHashV1(expectedSources)) {
    throw new Error("CAP06_EVALUATION_SOURCE_REFS_MISMATCH");
  }
  if (object.evidence_refs.length !== 8) throw new Error("CAP06_EVALUATION_EVIDENCE_COUNT_INVALID");
  if (!CAP06_SHADOW_DISPOSITIONS_V1.includes(payload.evaluation_disposition as never)) {
    throw new Error("CAP06_EVALUATION_DISPOSITION_INVALID");
  }
  if (!Array.isArray(payload.case_results) || payload.case_results.length !== 8) {
    throw new Error("CAP06_EVALUATION_CASE_RESULTS_COUNT_INVALID");
  }
  if (payload.model_activation_created !== false
    || payload.active_config_switch_performed !== false
    || payload.approval_created !== false
    || payload.activation_authorized !== false) {
    throw new Error("CAP06_EVALUATION_NON_ACTIVATION_BOUNDARY_VIOLATION");
  }
}

function validateObjectV1(object: Cap06GovernanceObjectV1): void {
  if (object.object_type === CANDIDATE_TYPE_V1) validateCandidateV1(object);
  else if (object.object_type === EVALUATION_TYPE_V1) validateEvaluationV1(object);
  else throw new Error("CAP06_PERSISTENCE_OBJECT_TYPE_UNSUPPORTED");
}

function parseCanonicalObjectV1(fact: ParsedFactV1): Cap06GovernanceObjectV1 {
  const object = fact.payload as Cap06GovernanceObjectV1;
  if (!object || typeof object !== "object") throw new Error("CAP06_CANONICAL_FACT_PAYLOAD_MISSING");
  if (fact.type !== object.object_type) throw new Error("CAP06_CANONICAL_FACT_TYPE_MISMATCH");
  validateObjectV1(object);
  return object;
}

async function acquireIdentityLocksV1(
  client: PoolClient,
  object: Cap06GovernanceObjectV1,
): Promise<void> {
  const keys = [object.idempotency_key, object.object_id].sort();
  for (const key of keys) {
    await client.query("SELECT pg_advisory_xact_lock(hashtextextended($1,0))", [key]);
  }
}

export class PostgresCalibrationGovernanceRepositoryV1 {
  constructor(private readonly pool: Pool) {}

  async readCanonicalObject(objectId: string): Promise<Cap06GovernanceObjectV1 | null> {
    const client = await this.pool.connect();
    try {
      return await this.readCanonicalObjectWithClientV1(client, objectId);
    } finally {
      client.release();
    }
  }

  async lookupByIdempotencyKey(idempotencyKey: string): Promise<Cap06GovernanceObjectV1 | null> {
    const guard = await this.pool.query(
      `SELECT record_set_id
       FROM twin_object_idempotency_index_v1
       WHERE identity_kind IN ('D_CALIBRATION_CANDIDATE','D_SHADOW_EVALUATION')
         AND idempotency_key=$1`,
      [requiredStringV1(idempotencyKey, "CAP06_IDEMPOTENCY_LOOKUP_KEY_REQUIRED")],
    );
    if (guard.rows.length === 0) return null;
    if (guard.rows.length !== 1) throw new Error("CAP06_IDEMPOTENCY_KEY_NOT_UNIQUE");
    return this.readCanonicalObject(guard.rows[0].record_set_id);
  }

  async commitCanonicalObject(input: {
    object: Cap06GovernanceObjectV1;
    fault_injection?: (stage: string) => void;
  }): Promise<Cap06GovernancePersistenceResultV1> {
    validateObjectV1(input.object);
    const client = await this.pool.connect();
    const inject = (stage: string): void => input.fault_injection?.(stage);
    try {
      await client.query("BEGIN");
      await acquireIdentityLocksV1(client, input.object);
      const existingGuard = await client.query(
        `SELECT identity_kind,record_set_id,determinism_hash
         FROM twin_object_idempotency_index_v1
         WHERE idempotency_key=$1
         FOR UPDATE`,
        [input.object.idempotency_key],
      );
      if (existingGuard.rows.length > 0) {
        if (existingGuard.rows.length !== 1
          || existingGuard.rows[0].identity_kind !== identityKindV1(input.object)
          || existingGuard.rows[0].record_set_id !== input.object.object_id
          || existingGuard.rows[0].determinism_hash !== input.object.determinism_hash) {
          throw new Error("CAP06_IDEMPOTENCY_CONFLICT");
        }
        const existing = await this.readCanonicalObjectWithClientV1(client, input.object.object_id);
        if (!existing || existing.determinism_hash !== input.object.determinism_hash) {
          throw new Error("CAP06_IDEMPOTENT_OBJECT_INCOMPLETE");
        }
        await this.ensureProjectionWithClientV1(client, existing, factIdV1(existing.object_id));
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
          throw new Error("CAP06_CANONICAL_OBJECT_CONFLICT");
        }
        await this.insertIdempotencyGuardWithClientV1(client, canonicalExisting);
        await this.ensureProjectionWithClientV1(
          client,
          canonicalExisting,
          factIdV1(canonicalExisting.object_id),
        );
        await client.query("COMMIT");
        return {
          status: "EXISTING_RECOVERED",
          object: canonicalExisting,
          fact_id: factIdV1(canonicalExisting.object_id),
        };
      }

      inject("before_fact");
      const factId = factIdV1(input.object.object_id);
      await client.query(
        `INSERT INTO facts (fact_id,occurred_at,source,record_json)
         VALUES ($1,$2::timestamptz,'system',$3::jsonb)`,
        [factId, input.object.logical_time, recordJsonV1(input.object)],
      );
      inject("before_projection");
      await this.ensureProjectionWithClientV1(client, input.object, factId);
      inject("before_idempotency_guard");
      await this.insertIdempotencyGuardWithClientV1(client, input.object);
      inject("before_commit");
      await client.query("COMMIT");
      return { status: "INSERTED", object: input.object, fact_id: factId };
    } catch (error) {
      await client.query("ROLLBACK");
      if (isPgUniqueViolationV1(error)) throw new Error("CAP06_PERSISTENCE_UNIQUENESS_CONFLICT");
      throw error;
    } finally {
      client.release();
    }
  }

  async rebuildFromFacts(): Promise<Cap06GovernanceRecoverySummaryV1> {
    const client = await this.pool.connect();
    try {
      await client.query("BEGIN");
      await client.query(
        "SELECT pg_advisory_xact_lock(hashtextextended('MCFT_CAP_06_S3_REBUILD',0))",
      );
      const facts = await client.query(
        `SELECT fact_id,record_json
         FROM facts
         WHERE record_json->>'type' IN ('twin_calibration_candidate_v1','twin_shadow_evaluation_v1')
         ORDER BY fact_id ASC`,
      );
      const canonical = facts.rows.map((row) =>
        parseCanonicalObjectV1(parseRecordJsonV1(row.fact_id, row.record_json)));

      await client.query("DELETE FROM twin_shadow_evaluation_case_projection_v1");
      await client.query("DELETE FROM twin_candidate_evaluation_index_v1");
      await client.query("DELETE FROM twin_shadow_evaluation_projection_v1");
      await client.query("DELETE FROM twin_calibration_candidate_projection_v1");
      await client.query(
        `DELETE FROM twin_object_idempotency_index_v1
         WHERE identity_kind IN ('D_CALIBRATION_CANDIDATE','D_SHADOW_EVALUATION')`,
      );

      let candidateCount = 0;
      let evaluationCount = 0;
      let candidateEvaluationCount = 0;
      let caseCount = 0;
      for (const object of canonical) {
        const factId = factIdV1(object.object_id);
        await this.ensureProjectionWithClientV1(client, object, factId);
        await this.insertIdempotencyGuardWithClientV1(client, object);
        if (object.object_type === CANDIDATE_TYPE_V1) candidateCount += 1;
        else {
          evaluationCount += 1;
          candidateEvaluationCount += 1;
          caseCount += 8;
        }
      }
      await client.query("COMMIT");
      return {
        canonical_objects_scanned: canonical.length,
        idempotency_guards_rebuilt: canonical.length,
        candidate_projections_rebuilt: candidateCount,
        evaluation_projections_rebuilt: evaluationCount,
        candidate_evaluation_rows_rebuilt: candidateEvaluationCount,
        evaluation_case_rows_rebuilt: caseCount,
      };
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    } finally {
      client.release();
    }
  }

  private async readCanonicalObjectWithClientV1(
    client: PoolClient,
    objectId: string,
  ): Promise<Cap06GovernanceObjectV1 | null> {
    const result = await client.query(
      `SELECT fact_id,record_json
       FROM facts
       WHERE record_json->'payload'->>'object_id'=$1
         AND record_json->>'type' IN ('twin_calibration_candidate_v1','twin_shadow_evaluation_v1')
       LIMIT 2`,
      [requiredStringV1(objectId, "CAP06_CANONICAL_READ_OBJECT_ID_REQUIRED")],
    );
    if (result.rows.length === 0) return null;
    if (result.rows.length !== 1) throw new Error("CAP06_CANONICAL_OBJECT_ID_NOT_UNIQUE");
    return parseCanonicalObjectV1(
      parseRecordJsonV1(result.rows[0].fact_id, result.rows[0].record_json),
    );
  }

  private async insertIdempotencyGuardWithClientV1(
    client: PoolClient,
    object: Cap06GovernanceObjectV1,
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
        JSON.stringify(identityBasisV1(object)),
        JSON.stringify({ [object.object_type]: object.object_id }),
        JSON.stringify({ [object.object_id]: object.determinism_hash }),
      ],
    );
  }

  private async ensureProjectionWithClientV1(
    client: PoolClient,
    object: Cap06GovernanceObjectV1,
    factId: string,
  ): Promise<void> {
    if (object.object_type === CANDIDATE_TYPE_V1) {
      const row = buildCap06CandidateProjectionRowV1(object, factId);
      await client.query(
        `INSERT INTO twin_calibration_candidate_projection_v1
         (candidate_object_id,tenant_id,project_id,group_id,field_id,season_id,zone_id,logical_time,as_of,
          candidate_status,base_config_ref,base_config_hash,context_lineage_ref,context_revision_ref,parameter_key,
          base_parameter_value,candidate_parameter_value,parameter_delta,activation_status,eligible_for_state_input,
          eligible_for_runtime_config_use,eligible_for_human_activation_review,determinism_hash,canonical_payload,source_fact_id)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8::timestamptz,$9::timestamptz,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21,$22,$23,$24::jsonb,$25)
         ON CONFLICT (candidate_object_id) DO NOTHING`,
        [
          row.candidate_object_id,row.tenant_id,row.project_id,row.group_id,row.field_id,row.season_id,row.zone_id,
          row.logical_time,row.as_of,row.candidate_status,row.base_config_ref,row.base_config_hash,row.context_lineage_ref,
          row.context_revision_ref,row.parameter_key,row.base_parameter_value,row.candidate_parameter_value,row.parameter_delta,
          row.activation_status,row.eligible_for_state_input,row.eligible_for_runtime_config_use,
          row.eligible_for_human_activation_review,row.determinism_hash,JSON.stringify(row.canonical_payload),row.source_fact_id,
        ],
      );
      const existing = await client.query(
        `SELECT determinism_hash,canonical_payload,source_fact_id
         FROM twin_calibration_candidate_projection_v1
         WHERE candidate_object_id=$1`,
        [row.candidate_object_id],
      );
      if (existing.rows.length !== 1
        || existing.rows[0].determinism_hash !== row.determinism_hash
        || existing.rows[0].source_fact_id !== row.source_fact_id
        || semanticHashV1(existing.rows[0].canonical_payload) !== semanticHashV1(row.canonical_payload)) {
        throw new Error("CAP06_CANDIDATE_PROJECTION_DIVERGENCE");
      }
      return;
    }

    const rows = buildCap06EvaluationProjectionRowsV1(object, factId);
    const evaluation = rows.evaluation;
    await client.query(
      `INSERT INTO twin_shadow_evaluation_projection_v1
       (evaluation_object_id,tenant_id,project_id,group_id,field_id,season_id,zone_id,logical_time,as_of,candidate_ref,
        candidate_hash,evaluation_dataset_hash,evaluation_policy_hash,shadow_replay_engine_id,
        calibration_metric_numeric_policy_hash,evaluation_disposition,eligible_for_human_activation_review,
        determinism_hash,canonical_payload,source_fact_id)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8::timestamptz,$9::timestamptz,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19::jsonb,$20)
       ON CONFLICT (evaluation_object_id) DO NOTHING`,
      [
        evaluation.evaluation_object_id,evaluation.tenant_id,evaluation.project_id,evaluation.group_id,evaluation.field_id,
        evaluation.season_id,evaluation.zone_id,evaluation.logical_time,evaluation.as_of,evaluation.candidate_ref,
        evaluation.candidate_hash,evaluation.evaluation_dataset_hash,evaluation.evaluation_policy_hash,
        evaluation.shadow_replay_engine_id,evaluation.calibration_metric_numeric_policy_hash,
        evaluation.evaluation_disposition,evaluation.eligible_for_human_activation_review,evaluation.determinism_hash,
        JSON.stringify(evaluation.canonical_payload),evaluation.source_fact_id,
      ],
    );
    const existingEvaluation = await client.query(
      `SELECT determinism_hash,canonical_payload,source_fact_id
       FROM twin_shadow_evaluation_projection_v1
       WHERE evaluation_object_id=$1`,
      [evaluation.evaluation_object_id],
    );
    if (existingEvaluation.rows.length !== 1
      || existingEvaluation.rows[0].determinism_hash !== evaluation.determinism_hash
      || existingEvaluation.rows[0].source_fact_id !== evaluation.source_fact_id
      || semanticHashV1(existingEvaluation.rows[0].canonical_payload) !== semanticHashV1(evaluation.canonical_payload)) {
      throw new Error("CAP06_EVALUATION_PROJECTION_DIVERGENCE");
    }

    const index = rows.candidate_index;
    await client.query(
      `INSERT INTO twin_candidate_evaluation_index_v1
       (candidate_ref,evaluation_object_id,evaluation_dataset_hash,evaluation_policy_hash,shadow_replay_engine_id,
        calibration_metric_numeric_policy_hash,evaluation_disposition,source_fact_id)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8)
       ON CONFLICT (candidate_ref,evaluation_object_id) DO NOTHING`,
      [
        index.candidate_ref,index.evaluation_object_id,index.evaluation_dataset_hash,index.evaluation_policy_hash,
        index.shadow_replay_engine_id,index.calibration_metric_numeric_policy_hash,index.evaluation_disposition,index.source_fact_id,
      ],
    );
    const existingIndex = await client.query(
      `SELECT evaluation_dataset_hash,evaluation_policy_hash,shadow_replay_engine_id,
              calibration_metric_numeric_policy_hash,evaluation_disposition,source_fact_id
       FROM twin_candidate_evaluation_index_v1
       WHERE candidate_ref=$1 AND evaluation_object_id=$2`,
      [index.candidate_ref, index.evaluation_object_id],
    );
    if (existingIndex.rows.length !== 1
      || existingIndex.rows[0].evaluation_dataset_hash !== index.evaluation_dataset_hash
      || existingIndex.rows[0].evaluation_policy_hash !== index.evaluation_policy_hash
      || existingIndex.rows[0].shadow_replay_engine_id !== index.shadow_replay_engine_id
      || existingIndex.rows[0].calibration_metric_numeric_policy_hash !== index.calibration_metric_numeric_policy_hash
      || existingIndex.rows[0].evaluation_disposition !== index.evaluation_disposition
      || existingIndex.rows[0].source_fact_id !== index.source_fact_id) {
      throw new Error("CAP06_CANDIDATE_EVALUATION_INDEX_DIVERGENCE");
    }

    for (const caseRow of rows.case_results) {
      await client.query(
        `INSERT INTO twin_shadow_evaluation_case_projection_v1
         (evaluation_object_id,case_index,residual_ref,residual_hash,source_forecast_ref,source_forecast_hash,
          source_forecast_point_ref,source_posterior_ref,source_runtime_config_ref,forecast_target_time,observation_ref,
          observation_available_to_runtime_at,base_parameter_value,candidate_parameter_value,base_prediction_vwc,
          candidate_prediction_vwc,actual_observation_vwc,base_residual_vwc,candidate_residual_vwc,base_mass_balance_hash,
          candidate_mass_balance_hash,base_invariant_status,candidate_invariant_status,canonical_case_result,source_fact_id)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10::timestamptz,$11,$12::timestamptz,$13,$14,$15,$16,$17,$18,$19,$20,$21,$22,$23,$24::jsonb,$25)
         ON CONFLICT (evaluation_object_id,case_index) DO NOTHING`,
        [
          caseRow.evaluation_object_id,caseRow.case_index,caseRow.residual_ref,caseRow.residual_hash,
          caseRow.source_forecast_ref,caseRow.source_forecast_hash,caseRow.source_forecast_point_ref,
          caseRow.source_posterior_ref,caseRow.source_runtime_config_ref,caseRow.forecast_target_time,
          caseRow.observation_ref,caseRow.observation_available_to_runtime_at,caseRow.base_parameter_value,
          caseRow.candidate_parameter_value,caseRow.base_prediction_vwc,caseRow.candidate_prediction_vwc,
          caseRow.actual_observation_vwc,caseRow.base_residual_vwc,caseRow.candidate_residual_vwc,
          caseRow.base_mass_balance_hash,caseRow.candidate_mass_balance_hash,caseRow.base_invariant_status,
          caseRow.candidate_invariant_status,JSON.stringify(caseRow.canonical_case_result),caseRow.source_fact_id,
        ],
      );
      const existingCase = await client.query(
        `SELECT residual_ref,residual_hash,canonical_case_result,source_fact_id
         FROM twin_shadow_evaluation_case_projection_v1
         WHERE evaluation_object_id=$1 AND case_index=$2`,
        [caseRow.evaluation_object_id, caseRow.case_index],
      );
      if (existingCase.rows.length !== 1
        || existingCase.rows[0].residual_ref !== caseRow.residual_ref
        || existingCase.rows[0].residual_hash !== caseRow.residual_hash
        || existingCase.rows[0].source_fact_id !== caseRow.source_fact_id
        || semanticHashV1(existingCase.rows[0].canonical_case_result)
          !== semanticHashV1(caseRow.canonical_case_result)) {
        throw new Error("CAP06_EVALUATION_CASE_PROJECTION_DIVERGENCE");
      }
    }
  }
}
