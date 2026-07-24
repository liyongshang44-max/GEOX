// Purpose: append immutable MCFT-CAP-05/08 G Decision and H Action Feedback objects using only SELECT+INSERT privileges, exact idempotency readback, and insert-or-verify rebuildable projections.
// Boundary: normal G/H commit path only; no UPDATE, DELETE, projection repair-in-place, full recovery rebuild, Forecast Residual, approval exercise, State mutation, route, scheduler, clock, filesystem, environment, or network authority.

import type { Pool, PoolClient } from "pg";
import { semanticHashV1 } from "../../domain/twin_runtime/canonical_identity_v1.js";
import {
  CAP05_ACTION_FEEDBACK_OBJECT_TYPE_V1,
  CAP05_DECISION_OBJECT_TYPE_V1,
  validateCap05ActionFeedbackV1,
  validateCap05DecisionV1,
  type Cap05ActionFeedbackEnvelopeV1,
  type Cap05DecisionEnvelopeV1,
} from "../../domain/twin_runtime/feedback_canonical_contracts_v1.js";
import {
  buildCap05ActionFeedbackProjectionRowsV1,
  buildCap05DecisionProjectionRowV1,
  type Cap05ActionFeedbackEvidenceRowV1,
} from "../../projections/twin_runtime/feedback_persistence_projection_v1.js";
import type {
  Cap05PersistenceResultV1,
  Cap05PersistenceStatusV1,
} from "./postgres_feedback_persistence_repository_v1.js";

export type Cap05ImmutableDecisionActionObjectV1 =
  | Cap05DecisionEnvelopeV1
  | Cap05ActionFeedbackEnvelopeV1;

export type Cap05ImmutableDecisionActionCommitPortV1 = {
  readCanonicalObject(objectId: string): Promise<Cap05ImmutableDecisionActionObjectV1 | null>;
  commitCanonicalObject(input: {
    object: Cap05ImmutableDecisionActionObjectV1;
    fault_injection?: (stage: string) => void;
  }): Promise<Cap05PersistenceResultV1>;
};

type IdentityKindV1 = "G_DECISION_RECORD" | "H_ACTION_FEEDBACK";

type ParsedFactV1 = {
  fact_id: string;
  type: string;
  payload: unknown;
};

function factIdV1(objectId: string): string {
  return `fact_${objectId}`;
}

function recordJsonV1(object: Cap05ImmutableDecisionActionObjectV1): string {
  return JSON.stringify({ type: object.object_type, payload: object });
}

function identityKindV1(object: Cap05ImmutableDecisionActionObjectV1): IdentityKindV1 {
  if (object.object_type === CAP05_DECISION_OBJECT_TYPE_V1) return "G_DECISION_RECORD";
  if (object.object_type === CAP05_ACTION_FEEDBACK_OBJECT_TYPE_V1) return "H_ACTION_FEEDBACK";
  throw new Error("CAP05_IMMUTABLE_COMMIT_OBJECT_TYPE_UNSUPPORTED");
}

function validateObjectV1(object: Cap05ImmutableDecisionActionObjectV1): void {
  if (object.object_type === CAP05_DECISION_OBJECT_TYPE_V1) validateCap05DecisionV1(object);
  else if (object.object_type === CAP05_ACTION_FEEDBACK_OBJECT_TYPE_V1) validateCap05ActionFeedbackV1(object);
  else throw new Error("CAP05_IMMUTABLE_COMMIT_OBJECT_TYPE_UNSUPPORTED");
}

function parseRecordJsonV1(factId: string, value: unknown): ParsedFactV1 {
  const parsed = typeof value === "string" ? JSON.parse(value) : value;
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) throw new Error("CAP05_IMMUTABLE_FACT_RECORD_JSON_INVALID");
  const record = parsed as Record<string, unknown>;
  if (typeof record.type !== "string" || !record.type) throw new Error("CAP05_IMMUTABLE_FACT_RECORD_TYPE_REQUIRED");
  return { fact_id: factId, type: record.type, payload: record.payload };
}

function parseCanonicalObjectV1(fact: ParsedFactV1): Cap05ImmutableDecisionActionObjectV1 {
  const object = fact.payload as Cap05ImmutableDecisionActionObjectV1;
  if (!object || typeof object !== "object") throw new Error("CAP05_IMMUTABLE_CANONICAL_FACT_PAYLOAD_MISSING");
  if (fact.type !== object.object_type) throw new Error("CAP05_IMMUTABLE_CANONICAL_FACT_TYPE_MISMATCH");
  validateObjectV1(object);
  return object;
}

function objectIdentityBasisV1(object: Cap05ImmutableDecisionActionObjectV1): Record<string, unknown> {
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

function isPgUniqueViolationV1(error: unknown): boolean {
  return Boolean(error && typeof error === "object" && (error as { code?: unknown }).code === "23505");
}

function sameJsonV1(left: unknown, right: unknown): boolean {
  return semanticHashV1(left) === semanticHashV1(right);
}

function exactEvidenceRowV1(row: Record<string, unknown>): Cap05ActionFeedbackEvidenceRowV1 {
  return {
    action_feedback_object_id: String(row.action_feedback_object_id),
    evidence_kind: row.evidence_kind as Cap05ActionFeedbackEvidenceRowV1["evidence_kind"],
    evidence_ref: String(row.evidence_ref),
    evidence_hash: row.evidence_hash === null || row.evidence_hash === undefined ? null : String(row.evidence_hash),
    source_fact_id: String(row.source_fact_id),
  };
}

function sortEvidenceV1(rows: readonly Cap05ActionFeedbackEvidenceRowV1[]): Cap05ActionFeedbackEvidenceRowV1[] {
  return [...rows].sort((left, right) => {
    const a = `${left.evidence_kind}\u0000${left.evidence_ref}`;
    const b = `${right.evidence_kind}\u0000${right.evidence_ref}`;
    return a.localeCompare(b);
  });
}

export class PostgresImmutableDecisionActionCommitRepositoryV1
implements Cap05ImmutableDecisionActionCommitPortV1 {
  constructor(private readonly pool: Pool) {}

  async readCanonicalObject(objectId: string): Promise<Cap05ImmutableDecisionActionObjectV1 | null> {
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
  ): Promise<Cap05ImmutableDecisionActionObjectV1 | null> {
    const result = await client.query(
      `SELECT fact_id,record_json FROM facts
       WHERE record_json->'payload'->>'object_id'=$1
       LIMIT 2`,
      [objectId],
    );
    if (result.rows.length === 0) return null;
    if (result.rows.length !== 1) throw new Error("CAP05_IMMUTABLE_CANONICAL_OBJECT_ID_NOT_UNIQUE");
    return parseCanonicalObjectV1(parseRecordJsonV1(result.rows[0].fact_id, result.rows[0].record_json));
  }

  private async insertGuardV1(
    client: PoolClient,
    object: Cap05ImmutableDecisionActionObjectV1,
  ): Promise<boolean> {
    const result = await client.query(
      `INSERT INTO twin_object_idempotency_index_v1
       (identity_kind,idempotency_key,record_set_id,determinism_hash,identity_basis,member_object_ids,member_determinism_hashes)
       VALUES ($1,$2,$3,$4,$5::jsonb,$6::jsonb,$7::jsonb)
       ON CONFLICT DO NOTHING
       RETURNING idempotency_key`,
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
    if (result.rows.length > 1) throw new Error("CAP05_IMMUTABLE_GUARD_INSERT_CARDINALITY");
    return result.rows.length === 1;
  }

  private async verifyGuardV1(
    client: PoolClient,
    object: Cap05ImmutableDecisionActionObjectV1,
  ): Promise<void> {
    const result = await client.query(
      `SELECT identity_kind,record_set_id,determinism_hash,identity_basis,member_object_ids,member_determinism_hashes
       FROM twin_object_idempotency_index_v1
       WHERE idempotency_key=$1`,
      [object.idempotency_key],
    );
    if (result.rows.length !== 1) throw new Error("CAP05_IMMUTABLE_IDEMPOTENCY_CONFLICT");
    const row = result.rows[0];
    if (row.identity_kind !== identityKindV1(object)
      || row.record_set_id !== object.object_id
      || row.determinism_hash !== object.determinism_hash
      || !sameJsonV1(row.identity_basis, objectIdentityBasisV1(object))
      || !sameJsonV1(row.member_object_ids, { [object.object_type]: object.object_id })
      || !sameJsonV1(row.member_determinism_hashes, { [object.object_id]: object.determinism_hash })) {
      throw new Error("CAP05_IMMUTABLE_IDEMPOTENCY_CONFLICT");
    }
  }

  private async insertCanonicalFactV1(
    client: PoolClient,
    object: Cap05ImmutableDecisionActionObjectV1,
  ): Promise<boolean> {
    const result = await client.query(
      `INSERT INTO facts (fact_id,occurred_at,source,record_json)
       VALUES ($1,$2::timestamptz,'system',$3::jsonb)
       ON CONFLICT (fact_id) DO NOTHING
       RETURNING fact_id`,
      [factIdV1(object.object_id), object.logical_time, recordJsonV1(object)],
    );
    if (result.rows.length > 1) throw new Error("CAP05_IMMUTABLE_FACT_INSERT_CARDINALITY");
    return result.rows.length === 1;
  }

  private async ensureDecisionProjectionV1(
    client: PoolClient,
    object: Cap05DecisionEnvelopeV1,
  ): Promise<void> {
    const factId = factIdV1(object.object_id);
    const row = buildCap05DecisionProjectionRowV1(object, factId);
    const inserted = await client.query(
      `INSERT INTO twin_decision_record_projection_v1
       (decision_object_id,tenant_id,project_id,group_id,field_id,season_id,zone_id,logical_time,as_of,
        scenario_set_ref,scenario_set_hash,selected_option_ref,selected_option_hash,selected_option_id,
        decision_request_evidence_ref,decision_request_evidence_hash,actor_ref,determinism_hash,canonical_payload,source_fact_id)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8::timestamptz,$9::timestamptz,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19::jsonb,$20)
       ON CONFLICT (decision_object_id) DO NOTHING
       RETURNING decision_object_id`,
      [
        row.decision_object_id,row.tenant_id,row.project_id,row.group_id,row.field_id,row.season_id,row.zone_id,row.logical_time,row.as_of,
        row.scenario_set_ref,row.scenario_set_hash,row.selected_option_ref,row.selected_option_hash,row.selected_option_id,
        row.decision_request_evidence_ref,row.decision_request_evidence_hash,row.actor_ref,row.determinism_hash,JSON.stringify(row.canonical_payload),row.source_fact_id,
      ],
    );
    if (inserted.rows.length === 1) return;
    if (inserted.rows.length !== 0) throw new Error("CAP05_IMMUTABLE_DECISION_PROJECTION_INSERT_CARDINALITY");
    const existing = await client.query(
      `SELECT determinism_hash,canonical_payload,source_fact_id FROM twin_decision_record_projection_v1
       WHERE decision_object_id=$1`,
      [object.object_id],
    );
    if (existing.rows.length !== 1
      || existing.rows[0].determinism_hash !== object.determinism_hash
      || existing.rows[0].source_fact_id !== factId
      || !sameJsonV1(existing.rows[0].canonical_payload, object.payload)) {
      throw new Error("CAP05_IMMUTABLE_DECISION_PROJECTION_CONFLICT");
    }
  }

  private async ensureActionFeedbackProjectionV1(
    client: PoolClient,
    object: Cap05ActionFeedbackEnvelopeV1,
  ): Promise<void> {
    const factId = factIdV1(object.object_id);
    const rows = buildCap05ActionFeedbackProjectionRowsV1(object, factId);
    const row = rows.feedback;
    const inserted = await client.query(
      `INSERT INTO twin_action_feedback_projection_v1
       (action_feedback_object_id,tenant_id,project_id,group_id,field_id,season_id,zone_id,logical_time,as_of,
        decision_ref,decision_hash,approved_plan_evidence_ref,approved_plan_evidence_hash,dispatch_disposition,event_id,
        source_record_id,binding_id,origin_source_id,execution_status,validation_status,source_quality,eligible_for_state_input,
        actual_amount_mm,spatial_coverage_fraction,target_scope_equivalent_irrigation_mm,execution_start,execution_end,
        available_to_runtime_at,determinism_hash,canonical_payload,source_fact_id)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8::timestamptz,$9::timestamptz,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21,$22,$23,$24,$25,$26::timestamptz,$27::timestamptz,$28::timestamptz,$29,$30::jsonb,$31)
       ON CONFLICT (action_feedback_object_id) DO NOTHING
       RETURNING action_feedback_object_id`,
      [
        row.action_feedback_object_id,row.tenant_id,row.project_id,row.group_id,row.field_id,row.season_id,row.zone_id,row.logical_time,row.as_of,
        row.decision_ref,row.decision_hash,row.approved_plan_evidence_ref,row.approved_plan_evidence_hash,row.dispatch_disposition,row.event_id,
        row.source_record_id,row.binding_id,row.origin_source_id,row.execution_status,row.validation_status,row.source_quality,row.eligible_for_state_input,
        row.actual_amount_mm,row.spatial_coverage_fraction,row.target_scope_equivalent_irrigation_mm,row.execution_start,row.execution_end,
        row.available_to_runtime_at,row.determinism_hash,JSON.stringify(row.canonical_payload),row.source_fact_id,
      ],
    );
    if (inserted.rows.length === 0) {
      const existing = await client.query(
        `SELECT determinism_hash,canonical_payload,source_fact_id FROM twin_action_feedback_projection_v1
         WHERE action_feedback_object_id=$1`,
        [object.object_id],
      );
      if (existing.rows.length !== 1
        || existing.rows[0].determinism_hash !== object.determinism_hash
        || existing.rows[0].source_fact_id !== factId
        || !sameJsonV1(existing.rows[0].canonical_payload, object.payload)) {
        throw new Error("CAP05_IMMUTABLE_ACTION_FEEDBACK_PROJECTION_CONFLICT");
      }
    } else if (inserted.rows.length !== 1) {
      throw new Error("CAP05_IMMUTABLE_ACTION_FEEDBACK_PROJECTION_INSERT_CARDINALITY");
    }

    for (const evidence of rows.evidence) {
      await client.query(
        `INSERT INTO twin_action_feedback_evidence_index_v1
         (action_feedback_object_id,evidence_kind,evidence_ref,evidence_hash,source_fact_id)
         VALUES ($1,$2,$3,$4,$5)
         ON CONFLICT (action_feedback_object_id,evidence_kind,evidence_ref) DO NOTHING`,
        [evidence.action_feedback_object_id,evidence.evidence_kind,evidence.evidence_ref,evidence.evidence_hash,evidence.source_fact_id],
      );
    }
    const existingEvidence = await client.query(
      `SELECT action_feedback_object_id,evidence_kind,evidence_ref,evidence_hash,source_fact_id
       FROM twin_action_feedback_evidence_index_v1
       WHERE action_feedback_object_id=$1
       ORDER BY evidence_kind,evidence_ref`,
      [object.object_id],
    );
    const actual = sortEvidenceV1(existingEvidence.rows.map((value) => exactEvidenceRowV1(value)));
    const expected = sortEvidenceV1(rows.evidence);
    if (!sameJsonV1(actual, expected)) throw new Error("CAP05_IMMUTABLE_ACTION_FEEDBACK_EVIDENCE_CONFLICT");
  }

  private async ensureProjectionV1(
    client: PoolClient,
    object: Cap05ImmutableDecisionActionObjectV1,
  ): Promise<void> {
    if (object.object_type === CAP05_DECISION_OBJECT_TYPE_V1) {
      await this.ensureDecisionProjectionV1(client, object);
      return;
    }
    await this.ensureActionFeedbackProjectionV1(client, object);
  }

  async commitCanonicalObject(input: {
    object: Cap05ImmutableDecisionActionObjectV1;
    fault_injection?: (stage: string) => void;
  }): Promise<Cap05PersistenceResultV1> {
    validateObjectV1(input.object);
    const client = await this.pool.connect();
    const inject = (stage: string): void => input.fault_injection?.(stage);
    try {
      await client.query("BEGIN");
      inject("before_idempotency_guard");
      const guardInserted = await this.insertGuardV1(client, input.object);
      if (!guardInserted) {
        await this.verifyGuardV1(client, input.object);
        const existing = await this.readCanonicalObjectWithClientV1(client, input.object.object_id);
        if (!existing
          || existing.object_type !== input.object.object_type
          || existing.idempotency_key !== input.object.idempotency_key
          || existing.determinism_hash !== input.object.determinism_hash) {
          throw new Error("CAP05_IMMUTABLE_IDEMPOTENT_OBJECT_INCOMPLETE");
        }
        await this.ensureProjectionV1(client, existing);
        await client.query("COMMIT");
        return {
          status: "EXISTING_IDEMPOTENT_SUCCESS" as Cap05PersistenceStatusV1,
          object: existing,
          fact_id: factIdV1(existing.object_id),
        };
      }

      const canonicalExisting = await this.readCanonicalObjectWithClientV1(client, input.object.object_id);
      if (canonicalExisting) {
        if (canonicalExisting.object_type !== input.object.object_type
          || canonicalExisting.idempotency_key !== input.object.idempotency_key
          || canonicalExisting.determinism_hash !== input.object.determinism_hash) {
          throw new Error("CAP05_IMMUTABLE_CANONICAL_OBJECT_CONFLICT");
        }
        await this.ensureProjectionV1(client, canonicalExisting);
        await client.query("COMMIT");
        return {
          status: "EXISTING_RECOVERED" as Cap05PersistenceStatusV1,
          object: canonicalExisting,
          fact_id: factIdV1(canonicalExisting.object_id),
        };
      }

      inject("before_fact");
      const factInserted = await this.insertCanonicalFactV1(client, input.object);
      if (!factInserted) throw new Error("CAP05_IMMUTABLE_CANONICAL_OBJECT_CONFLICT");
      inject("before_projection");
      await this.ensureProjectionV1(client, input.object);
      inject("before_commit");
      await client.query("COMMIT");
      return {
        status: "INSERTED" as Cap05PersistenceStatusV1,
        object: input.object,
        fact_id: factIdV1(input.object.object_id),
      };
    } catch (error) {
      await client.query("ROLLBACK");
      if (isPgUniqueViolationV1(error)) throw new Error("CAP05_IMMUTABLE_PERSISTENCE_UNIQUENESS_CONFLICT");
      throw error;
    } finally {
      client.release();
    }
  }
}
