// apps/server/src/persistence/twin_runtime/postgres_feedback_persistence_repository_v1.ts
// Purpose: atomically append MCFT-CAP-05 G/H/C canonical objects to public.facts with idempotency guards, rebuildable projections, canonical readback and facts-based recovery.
// Boundary: persistence and projection mutation only; no Decision creation, approval exercise, receipt normalization, Forecast math, State mutation, route, scheduler, clock, filesystem, environment or network authority.

import type { Pool, PoolClient } from "pg";
import {
  CAP05_ACTION_FEEDBACK_OBJECT_TYPE_V1,
  CAP05_DECISION_OBJECT_TYPE_V1,
  validateCap05ActionFeedbackV1,
  validateCap05DecisionV1,
  type Cap05ActionFeedbackEnvelopeV1,
  type Cap05DecisionEnvelopeV1,
  type Cap05NonLineageEnvelopeV1,
} from "../../domain/twin_runtime/feedback_canonical_contracts_v1.js";
import { PostgresApprovalPlanRecoveryRepositoryV1 } from "./postgres_approval_plan_recovery_repository_v1.js";
import {
  CAP05_FORECAST_RESIDUAL_OBJECT_TYPE_V1,
  validateCap05ForecastResidualV1,
  type Cap05ForecastResidualEnvelopeV1,
} from "../../domain/twin_runtime/forecast_observation_residual_v1.js";
import {
  buildCap05FeedbackCycleProjectionV1,
  type Cap05FeedbackCycleProjectionV1,
} from "../../domain/twin_runtime/feedback_cycle_projection_v1.js";
import {
  buildCap05ActionFeedbackProjectionRowsV1,
  buildCap05ApprovedPlanBindingProjectionRowV1,
  buildCap05DecisionProjectionRowV1,
  buildCap05FeedbackCycleProjectionRowV1,
  buildCap05ForecastResidualProjectionRowV1,
  type Cap05ApprovedPlanEvidenceV1,
} from "../../projections/twin_runtime/feedback_persistence_projection_v1.js";

export type Cap05PersistedObjectV1 =
  | Cap05DecisionEnvelopeV1
  | Cap05ActionFeedbackEnvelopeV1
  | Cap05ForecastResidualEnvelopeV1;

export type Cap05PersistenceStatusV1 = "INSERTED" | "EXISTING_IDEMPOTENT_SUCCESS" | "EXISTING_RECOVERED";

export type Cap05PersistenceResultV1 = {
  status: Cap05PersistenceStatusV1;
  object: Cap05PersistedObjectV1;
  fact_id: string;
};

export type Cap05RecoverySummaryV1 = {
  canonical_objects_scanned: number;
  idempotency_guards_rebuilt: number;
  decision_projections_rebuilt: number;
  action_feedback_projections_rebuilt: number;
  action_feedback_evidence_rows_rebuilt: number;
  forecast_residual_projections_rebuilt: number;
  approved_plan_bindings_rebuilt: number;
  feedback_cycles_rebuilt: number;
};

type Cap05IdentityKindV1 = "G_DECISION_RECORD" | "H_ACTION_FEEDBACK" | "C_FORECAST_RESIDUAL";

type ParsedFactV1 = {
  fact_id: string;
  type: string;
  payload: unknown;
};

function factIdV1(objectId: string): string {
  return `fact_${objectId}`;
}

function recordJsonV1(object: Cap05PersistedObjectV1): string {
  return JSON.stringify({ type: object.object_type, payload: object });
}

function parseRecordJsonV1(factId: string, value: unknown): ParsedFactV1 {
  const parsed = typeof value === "string" ? JSON.parse(value) : value;
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) throw new Error("CAP05_FACT_RECORD_JSON_INVALID");
  const record = parsed as Record<string, unknown>;
  if (typeof record.type !== "string" || !record.type) throw new Error("CAP05_FACT_RECORD_TYPE_REQUIRED");
  return { fact_id: factId, type: record.type, payload: record.payload };
}

function identityKindV1(object: Cap05PersistedObjectV1): Cap05IdentityKindV1 {
  if (object.object_type === CAP05_DECISION_OBJECT_TYPE_V1) return "G_DECISION_RECORD";
  if (object.object_type === CAP05_ACTION_FEEDBACK_OBJECT_TYPE_V1) return "H_ACTION_FEEDBACK";
  if (object.object_type === CAP05_FORECAST_RESIDUAL_OBJECT_TYPE_V1) return "C_FORECAST_RESIDUAL";
  throw new Error("CAP05_PERSISTENCE_OBJECT_TYPE_UNSUPPORTED");
}

function validateObjectV1(object: Cap05PersistedObjectV1): void {
  if (object.object_type === CAP05_DECISION_OBJECT_TYPE_V1) validateCap05DecisionV1(object);
  else if (object.object_type === CAP05_ACTION_FEEDBACK_OBJECT_TYPE_V1) validateCap05ActionFeedbackV1(object);
  else if (object.object_type === CAP05_FORECAST_RESIDUAL_OBJECT_TYPE_V1) validateCap05ForecastResidualV1(object);
  else throw new Error("CAP05_PERSISTENCE_OBJECT_TYPE_UNSUPPORTED");
}

function parseCanonicalObjectV1(fact: ParsedFactV1): Cap05PersistedObjectV1 {
  const object = fact.payload as Cap05PersistedObjectV1;
  if (!object || typeof object !== "object") throw new Error("CAP05_CANONICAL_FACT_PAYLOAD_MISSING");
  if (fact.type !== object.object_type) throw new Error("CAP05_CANONICAL_FACT_TYPE_MISMATCH");
  validateObjectV1(object);
  return object;
}

function isPgUniqueViolationV1(error: unknown): boolean {
  return Boolean(error && typeof error === "object" && (error as { code?: unknown }).code === "23505");
}

function requiredStringV1(value: unknown, code: string): string {
  if (typeof value !== "string" || !value.trim()) throw new Error(code);
  return value;
}

function optionalStringV1(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value : null;
}

function objectIdentityBasisV1(object: Cap05PersistedObjectV1): Record<string, unknown> {
  return {
    object_type: object.object_type,
    object_id: object.object_id,
    idempotency_key: object.idempotency_key,
    scope: {
      tenant_id: object.tenant_id,
      project_id: object.project_id,
      group_id: object.group_id,
      field_id: object.field_id,
      season_id: object.season_id,
      zone_id: object.zone_id,
    },
    logical_time: object.logical_time,
    as_of: object.as_of,
    context_lineage_ref: object.context_lineage_ref,
    context_revision_ref: object.context_revision_ref,
  };
}

export class PostgresFeedbackPersistenceRepositoryV1 {
  constructor(private readonly pool: Pool) {}

  async readCanonicalObject(objectId: string): Promise<Cap05PersistedObjectV1 | null> {
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
  ): Promise<Cap05PersistedObjectV1 | null> {
    const result = await client.query(
      `SELECT fact_id,record_json FROM facts
       WHERE record_json->'payload'->>'object_id'=$1
       LIMIT 2`,
      [objectId],
    );
    if (result.rows.length === 0) return null;
    if (result.rows.length !== 1) throw new Error("CAP05_CANONICAL_OBJECT_ID_NOT_UNIQUE");
    return parseCanonicalObjectV1(parseRecordJsonV1(result.rows[0].fact_id, result.rows[0].record_json));
  }

  async lookupByIdempotencyKey(idempotencyKey: string): Promise<Cap05PersistedObjectV1 | null> {
    const guard = await this.pool.query(
      `SELECT record_set_id FROM twin_object_idempotency_index_v1
       WHERE identity_kind IN ('G_DECISION_RECORD','H_ACTION_FEEDBACK','C_FORECAST_RESIDUAL')
         AND idempotency_key=$1`,
      [idempotencyKey],
    );
    if (guard.rows.length === 0) return null;
    if (guard.rows.length !== 1) throw new Error("CAP05_IDEMPOTENCY_KEY_NOT_UNIQUE");
    return this.readCanonicalObject(guard.rows[0].record_set_id);
  }

  async commitCanonicalObject(input: {
    object: Cap05PersistedObjectV1;
    fault_injection?: (stage: string) => void;
  }): Promise<Cap05PersistenceResultV1> {
    validateObjectV1(input.object);
    const client = await this.pool.connect();
    const inject = (stage: string) => input.fault_injection?.(stage);
    try {
      await client.query("BEGIN");
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
          throw new Error("CAP05_IDEMPOTENCY_CONFLICT");
        }
        const existing = await this.readCanonicalObjectWithClientV1(client, input.object.object_id);
        if (!existing || existing.determinism_hash !== input.object.determinism_hash) throw new Error("CAP05_IDEMPOTENT_OBJECT_INCOMPLETE");
        await this.upsertProjectionWithClientV1(client, existing, factIdV1(existing.object_id));
        await client.query("COMMIT");
        return { status: "EXISTING_IDEMPOTENT_SUCCESS", object: existing, fact_id: factIdV1(existing.object_id) };
      }

      const canonicalExisting = await this.readCanonicalObjectWithClientV1(client, input.object.object_id);
      if (canonicalExisting) {
        if (canonicalExisting.idempotency_key !== input.object.idempotency_key
          || canonicalExisting.determinism_hash !== input.object.determinism_hash
          || canonicalExisting.object_type !== input.object.object_type) {
          throw new Error("CAP05_CANONICAL_OBJECT_CONFLICT");
        }
        await this.insertIdempotencyGuardWithClientV1(client, canonicalExisting);
        await this.upsertProjectionWithClientV1(client, canonicalExisting, factIdV1(canonicalExisting.object_id));
        await client.query("COMMIT");
        return { status: "EXISTING_RECOVERED", object: canonicalExisting, fact_id: factIdV1(canonicalExisting.object_id) };
      }

      inject("before_fact");
      const factId = factIdV1(input.object.object_id);
      await client.query(
        `INSERT INTO facts (fact_id,occurred_at,source,record_json)
         VALUES ($1,$2::timestamptz,'system',$3::jsonb)`,
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
      if (isPgUniqueViolationV1(error)) throw new Error("CAP05_PERSISTENCE_UNIQUENESS_CONFLICT");
      throw error;
    } finally {
      client.release();
    }
  }

  private async insertIdempotencyGuardWithClientV1(
    client: PoolClient,
    object: Cap05PersistedObjectV1,
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

  private async upsertProjectionWithClientV1(
    client: PoolClient,
    object: Cap05PersistedObjectV1,
    factId: string,
  ): Promise<void> {
    if (object.object_type === CAP05_DECISION_OBJECT_TYPE_V1) {
      const row = buildCap05DecisionProjectionRowV1(object, factId);
      await client.query(
        `INSERT INTO twin_decision_record_projection_v1
         (decision_object_id,tenant_id,project_id,group_id,field_id,season_id,zone_id,logical_time,as_of,
          scenario_set_ref,scenario_set_hash,selected_option_ref,selected_option_hash,selected_option_id,
          decision_request_evidence_ref,decision_request_evidence_hash,actor_ref,determinism_hash,canonical_payload,source_fact_id)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8::timestamptz,$9::timestamptz,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19::jsonb,$20)
         ON CONFLICT (decision_object_id) DO UPDATE SET
           determinism_hash=EXCLUDED.determinism_hash,canonical_payload=EXCLUDED.canonical_payload,source_fact_id=EXCLUDED.source_fact_id`,
        [
          row.decision_object_id,row.tenant_id,row.project_id,row.group_id,row.field_id,row.season_id,row.zone_id,row.logical_time,row.as_of,
          row.scenario_set_ref,row.scenario_set_hash,row.selected_option_ref,row.selected_option_hash,row.selected_option_id,
          row.decision_request_evidence_ref,row.decision_request_evidence_hash,row.actor_ref,row.determinism_hash,JSON.stringify(row.canonical_payload),row.source_fact_id,
        ],
      );
      return;
    }
    if (object.object_type === CAP05_ACTION_FEEDBACK_OBJECT_TYPE_V1) {
      const rows = buildCap05ActionFeedbackProjectionRowsV1(object, factId);
      const row = rows.feedback;
      await client.query(
        `INSERT INTO twin_action_feedback_projection_v1
         (action_feedback_object_id,tenant_id,project_id,group_id,field_id,season_id,zone_id,logical_time,as_of,
          decision_ref,decision_hash,approved_plan_evidence_ref,approved_plan_evidence_hash,dispatch_disposition,event_id,
          source_record_id,binding_id,origin_source_id,execution_status,validation_status,source_quality,eligible_for_state_input,
          actual_amount_mm,spatial_coverage_fraction,target_scope_equivalent_irrigation_mm,execution_start,execution_end,
          available_to_runtime_at,determinism_hash,canonical_payload,source_fact_id)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8::timestamptz,$9::timestamptz,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21,$22,$23,$24,$25,$26::timestamptz,$27::timestamptz,$28::timestamptz,$29,$30::jsonb,$31)
         ON CONFLICT (action_feedback_object_id) DO UPDATE SET
           determinism_hash=EXCLUDED.determinism_hash,canonical_payload=EXCLUDED.canonical_payload,source_fact_id=EXCLUDED.source_fact_id`,
        [
          row.action_feedback_object_id,row.tenant_id,row.project_id,row.group_id,row.field_id,row.season_id,row.zone_id,row.logical_time,row.as_of,
          row.decision_ref,row.decision_hash,row.approved_plan_evidence_ref,row.approved_plan_evidence_hash,row.dispatch_disposition,row.event_id,
          row.source_record_id,row.binding_id,row.origin_source_id,row.execution_status,row.validation_status,row.source_quality,row.eligible_for_state_input,
          row.actual_amount_mm,row.spatial_coverage_fraction,row.target_scope_equivalent_irrigation_mm,row.execution_start,row.execution_end,
          row.available_to_runtime_at,row.determinism_hash,JSON.stringify(row.canonical_payload),row.source_fact_id,
        ],
      );
      await client.query("DELETE FROM twin_action_feedback_evidence_index_v1 WHERE action_feedback_object_id=$1", [object.object_id]);
      for (const evidence of rows.evidence) {
        await client.query(
          `INSERT INTO twin_action_feedback_evidence_index_v1
           (action_feedback_object_id,evidence_kind,evidence_ref,evidence_hash,source_fact_id)
           VALUES ($1,$2,$3,$4,$5)`,
          [evidence.action_feedback_object_id,evidence.evidence_kind,evidence.evidence_ref,evidence.evidence_hash,evidence.source_fact_id],
        );
      }
      return;
    }
    const row = buildCap05ForecastResidualProjectionRowV1(object, factId);
    await client.query(
      `INSERT INTO twin_forecast_residual_projection_v1
       (residual_object_id,tenant_id,project_id,group_id,field_id,season_id,zone_id,logical_time,as_of,
        forecast_run_ref,forecast_run_hash,forecast_point_ref,forecast_point_hash,actual_observation_ref,actual_observation_hash,
        predicted_observation_value,predicted_observation_variance,actual_observation_value,actual_observation_variance,
        representativeness_variance,residual_value,normalized_residual,assimilation_update_ref,assimilation_update_hash,
        determinism_hash,canonical_payload,source_fact_id)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8::timestamptz,$9::timestamptz,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21,$22,$23,$24,$25,$26::jsonb,$27)
       ON CONFLICT (residual_object_id) DO UPDATE SET
         determinism_hash=EXCLUDED.determinism_hash,canonical_payload=EXCLUDED.canonical_payload,source_fact_id=EXCLUDED.source_fact_id`,
      [
        row.residual_object_id,row.tenant_id,row.project_id,row.group_id,row.field_id,row.season_id,row.zone_id,row.logical_time,row.as_of,
        row.forecast_run_ref,row.forecast_run_hash,row.forecast_point_ref,row.forecast_point_hash,row.actual_observation_ref,row.actual_observation_hash,
        row.predicted_observation_value,row.predicted_observation_variance,row.actual_observation_value,row.actual_observation_variance,
        row.representativeness_variance,row.residual_value,row.normalized_residual,row.assimilation_update_ref,row.assimilation_update_hash,
        row.determinism_hash,JSON.stringify(row.canonical_payload),row.source_fact_id,
      ],
    );
  }

  async rebuildAllSupportState(): Promise<Cap05RecoverySummaryV1> {
    const client = await this.pool.connect();
    try {
      await client.query("BEGIN");
      await client.query("DELETE FROM twin_action_feedback_cycle_projection_v1");
      await client.query("DELETE FROM twin_action_feedback_evidence_index_v1");
      await client.query("DELETE FROM twin_action_feedback_projection_v1");
      await client.query("DELETE FROM twin_decision_record_projection_v1");
      await client.query("DELETE FROM twin_forecast_residual_projection_v1");
      await client.query("DELETE FROM twin_approved_plan_binding_projection_v1");
      await client.query(
        `DELETE FROM twin_object_idempotency_index_v1
         WHERE identity_kind IN ('G_DECISION_RECORD','H_ACTION_FEEDBACK','C_FORECAST_RESIDUAL')`,
      );

      const canonicalFacts = await client.query(
        `SELECT fact_id,record_json FROM facts
         WHERE record_json->>'type' IN ('twin_decision_record_v1','twin_action_feedback_v1','twin_forecast_residual_v1')
         ORDER BY fact_id`,
      );
      const objects: Cap05PersistedObjectV1[] = [];
      let evidenceRows = 0;
      for (const row of canonicalFacts.rows) {
        const object = parseCanonicalObjectV1(parseRecordJsonV1(row.fact_id, row.record_json));
        objects.push(object);
        await this.insertIdempotencyGuardWithClientV1(client, object);
        await this.upsertProjectionWithClientV1(client, object, row.fact_id);
        if (object.object_type === CAP05_ACTION_FEEDBACK_OBJECT_TYPE_V1) {
          evidenceRows += buildCap05ActionFeedbackProjectionRowsV1(object, row.fact_id).evidence.length;
        }
      }

      const planRecovery = await new PostgresApprovalPlanRecoveryRepositoryV1()
      .rebuildAllBindingsWithClientV1(client);

      const cycles = await this.rebuildCompleteFeedbackCyclesWithClientV1(client, objects);
      await client.query("COMMIT");
      return {
        canonical_objects_scanned: objects.length,
        idempotency_guards_rebuilt: objects.length,
        decision_projections_rebuilt: objects.filter((object) => object.object_type === CAP05_DECISION_OBJECT_TYPE_V1).length,
        action_feedback_projections_rebuilt: objects.filter((object) => object.object_type === CAP05_ACTION_FEEDBACK_OBJECT_TYPE_V1).length,
        action_feedback_evidence_rows_rebuilt: evidenceRows,
        forecast_residual_projections_rebuilt: objects.filter((object) => object.object_type === CAP05_FORECAST_RESIDUAL_OBJECT_TYPE_V1).length,
        approved_plan_bindings_rebuilt: planRecovery.approved_plan_bindings_rebuilt,
        feedback_cycles_rebuilt: cycles,
      };
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    } finally {
      client.release();
    }
  }

  private async rebuildCompleteFeedbackCyclesWithClientV1(
    client: PoolClient,
    objects: readonly Cap05PersistedObjectV1[],
  ): Promise<number> {
    const decisions = new Map(objects.filter((object): object is Cap05DecisionEnvelopeV1 => object.object_type === CAP05_DECISION_OBJECT_TYPE_V1).map((object) => [object.object_id, object]));
    const feedbacks = objects.filter((object): object is Cap05ActionFeedbackEnvelopeV1 => object.object_type === CAP05_ACTION_FEEDBACK_OBJECT_TYPE_V1);
    const residuals = objects.filter((object): object is Cap05ForecastResidualEnvelopeV1 => object.object_type === CAP05_FORECAST_RESIDUAL_OBJECT_TYPE_V1);
    let count = 0;
    for (const feedback of feedbacks) {
      const decision = decisions.get(feedback.payload.decision_ref);
      if (!decision || decision.determinism_hash !== feedback.payload.decision_hash) continue;
      const planResult = await client.query(
        `SELECT canonical_evidence,source_fact_id FROM twin_approved_plan_binding_projection_v1
         WHERE approved_plan_evidence_ref=$1 AND approved_plan_evidence_hash=$2`,
        [feedback.payload.approved_plan_evidence_ref, feedback.payload.approved_plan_evidence_hash],
      );
      if (planResult.rows.length !== 1) continue;
      const planEvidence = planResult.rows[0].canonical_evidence as Cap05ApprovedPlanEvidenceV1;
      for (const residual of residuals) {
        if (!residual.payload.assimilation_update_ref || !residual.payload.assimilation_update_hash) continue;
        const forecast = await this.readAnyCanonicalFactWithClientV1(client, residual.payload.forecast_run_ref);
        const forecastPayload = forecast?.payload as Record<string, unknown> | undefined;
        const stateRef = optionalStringV1(forecastPayload?.source_posterior_ref);
        if (!stateRef) continue;
        const state = await this.readAnyCanonicalFactWithClientV1(client, stateRef);
        const evidenceWindowRef = optionalStringV1((state?.payload as Record<string, unknown> | undefined)?.evidence_window_ref);
        if (!evidenceWindowRef) continue;
        const evidenceWindow = await this.readAnyCanonicalFactWithClientV1(client, evidenceWindowRef);
        const actionFeedbackRefs = (evidenceWindow?.payload as Record<string, unknown> | undefined)?.action_feedback_refs;
        if (!Array.isArray(actionFeedbackRefs) || !actionFeedbackRefs.includes(feedback.object_id)) continue;
        const assimilation = await this.readAnyCanonicalFactWithClientV1(client, residual.payload.assimilation_update_ref);
        if (!assimilation || assimilation.determinism_hash !== residual.payload.assimilation_update_hash) continue;
        const updatedStateRef = optionalStringV1((assimilation.payload as Record<string, unknown>).posterior_state_ref);
        if (!updatedStateRef) continue;
        const updatedState = await this.readAnyCanonicalFactWithClientV1(client, updatedStateRef);
        if (!updatedState) continue;
        const projection = buildCap05FeedbackCycleProjectionV1({
          decision,
          approval_assertion_ref: requiredStringV1(planEvidence.canonical_payload.approval_assertion_ref, "CAP05_CYCLE_ASSERTION_REF_REQUIRED"),
          approval_assertion_hash: requiredStringV1(planEvidence.canonical_payload.approval_assertion_hash, "CAP05_CYCLE_ASSERTION_HASH_REQUIRED"),
          approved_plan_ref: feedback.payload.approved_plan_evidence_ref,
          approved_plan_hash: feedback.payload.approved_plan_evidence_hash,
          dispatch_disposition: feedback.payload.dispatch_disposition,
          dispatch_evidence_ref: null,
          dispatch_evidence_hash: null,
          action_feedback: feedback,
          outcome_observation_ref: residual.payload.actual_observation_ref,
          outcome_observation_hash: residual.payload.actual_observation_hash,
          forecast_residual: residual,
          assimilation_update_ref: assimilation.object_id,
          assimilation_update_hash: assimilation.determinism_hash,
          updated_state_ref: updatedState.object_id,
          updated_state_hash: updatedState.determinism_hash,
        });
        await this.insertFeedbackCycleProjectionWithClientV1(client, projection, {
          decision: factIdV1(decision.object_id),
          approved_plan: planResult.rows[0].source_fact_id,
          action_feedback: factIdV1(feedback.object_id),
          forecast_residual: factIdV1(residual.object_id),
          assimilation_update: factIdV1(assimilation.object_id),
          updated_state: factIdV1(updatedState.object_id),
        });
        count += 1;
      }
    }
    return count;
  }

  private async readAnyCanonicalFactWithClientV1(
    client: PoolClient,
    objectId: string,
  ): Promise<Cap05NonLineageEnvelopeV1<string, Record<string, unknown>> | null> {
    const result = await client.query(
      `SELECT fact_id,record_json FROM facts
       WHERE record_json->'payload'->>'object_id'=$1 LIMIT 2`,
      [objectId],
    );
    if (result.rows.length === 0) return null;
    if (result.rows.length !== 1) throw new Error("CAP05_RECOVERY_SOURCE_OBJECT_NOT_UNIQUE");
    const parsed = parseRecordJsonV1(result.rows[0].fact_id, result.rows[0].record_json);
    if (!parsed.payload || typeof parsed.payload !== "object") throw new Error("CAP05_RECOVERY_SOURCE_OBJECT_INVALID");
    return parsed.payload as Cap05NonLineageEnvelopeV1<string, Record<string, unknown>>;
  }

  async persistFeedbackCycleProjection(
    projection: Cap05FeedbackCycleProjectionV1,
    sourceFactRefs: Record<string, string>,
  ): Promise<void> {
    const client = await this.pool.connect();
    try {
      await client.query("BEGIN");
      await this.insertFeedbackCycleProjectionWithClientV1(client, projection, sourceFactRefs);
      await client.query("COMMIT");
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    } finally {
      client.release();
    }
  }

  private async insertFeedbackCycleProjectionWithClientV1(
    client: PoolClient,
    projection: Cap05FeedbackCycleProjectionV1,
    sourceFactRefs: Record<string, string>,
  ): Promise<void> {
    const row = buildCap05FeedbackCycleProjectionRowV1(projection, sourceFactRefs);
    await client.query(
      `INSERT INTO twin_action_feedback_cycle_projection_v1
       (projection_id,projection_hash,decision_ref,action_feedback_ref,approved_plan_ref,dispatch_disposition,
        outcome_observation_ref,forecast_residual_ref,assimilation_update_ref,updated_state_ref,canonical_projection,source_fact_refs)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11::jsonb,$12::jsonb)
       ON CONFLICT (projection_id) DO UPDATE SET
         projection_hash=EXCLUDED.projection_hash,canonical_projection=EXCLUDED.canonical_projection,
         source_fact_refs=EXCLUDED.source_fact_refs,rebuilt_at=transaction_timestamp()`,
      [
        row.projection_id,row.projection_hash,row.decision_ref,row.action_feedback_ref,row.approved_plan_ref,
        row.dispatch_disposition,row.outcome_observation_ref,row.forecast_residual_ref,row.assimilation_update_ref,
        row.updated_state_ref,JSON.stringify(row.canonical_projection),JSON.stringify(row.source_fact_refs),
      ],
    );
  }
}
