// Purpose: persist and exactly read back the MCFT-CAP-08.S3 T09 Outcome-absence witness and T10 FVO-10 observation required for database-reconstructable completion.
// Boundary: bounded append-or-exact-verify Evidence facts only; no State/Forecast/Scenario mutation, projection, route, scheduler, wall clock, filesystem, environment, or production authority.

import crypto from "node:crypto";
import type { Pool } from "pg";
import {
  CAP08_S3_OUTCOME_FVO_ID_V1,
  CAP08_S3_OUTCOME_VALUE_V1,
} from "../../domain/twin_runtime/cap08_s3_formal_provider_contracts_v1.js";
import {
  CAP08_S3_OUTCOME_ABSENCE_WITNESS_RECORD_TYPE_V1,
  buildCap08S3OutcomeAbsenceWitnessV1,
  validateCap08S3OutcomeAbsenceWitnessV1,
  type Cap08S3OutcomeAbsenceWitnessV1,
} from "../../domain/twin_runtime/cap08_s3_completion_tuple_v1.js";
import { semanticHashV1 } from "../../domain/twin_runtime/canonical_identity_v1.js";
import type {
  CanonicalReplayEvidenceRecordV1,
  TwinScopeKeyV1,
} from "./ports.js";

export const CAP08_S3_COMPLETION_EVIDENCE_SOURCE_V1 =
  "mcft_cap08_s3_completion_evidence_v1" as const;

export type Cap08S3PersistedOutcomeEvidenceV1 =
  CanonicalReplayEvidenceRecordV1 & { formal_run_id: string };

export type Cap08S3CompletionEvidenceCommitResultV1<T> = {
  status: "INSERTED" | "EXISTING_IDEMPOTENT_SUCCESS";
  evidence: T;
};

function requiredStringV1(value: unknown, code: string): string {
  if (typeof value !== "string" || !value.trim()) throw new Error(code);
  return value;
}

function exactScopeV1(expected: TwinScopeKeyV1, actual: TwinScopeKeyV1, code: string): void {
  for (const field of ["tenant_id", "project_id", "group_id", "field_id", "season_id", "zone_id"] as const) {
    if (expected[field] !== actual[field]) throw new Error(`${code}:${field}`);
  }
}

function factIdV1(kind: string, formalRunId: string, sourceRecordId: string): string {
  const digest = crypto.createHash("sha256")
    .update(`${kind}\0${formalRunId}\0${sourceRecordId}`, "utf8")
    .digest("hex")
    .slice(0, 32);
  return `fact_mcft08_s3_completion_evidence_${digest}`;
}

function exactOutcomeV1(input: {
  formal_run_id: string;
  scope: TwinScopeKeyV1;
  record: CanonicalReplayEvidenceRecordV1;
}): Cap08S3PersistedOutcomeEvidenceV1 {
  const formalRunId = requiredStringV1(input.formal_run_id, "CAP08_S3_OUTCOME_FORMAL_RUN_REQUIRED");
  const record = structuredClone(input.record);
  exactScopeV1(input.scope, record, "CAP08_S3_OUTCOME_SCOPE_MISMATCH");
  if (record.source_record_id !== CAP08_S3_OUTCOME_FVO_ID_V1
    || record.record_type !== "soil_moisture_observation_v1"
    || record.binding_id !== "soil_obs_c8_20cm_v1"
    || record.available_to_runtime_at !== "2026-06-01T10:00:00.000Z"
    || record.role_time.observed_at !== "2026-06-01T10:00:00.000Z"
    || record.canonical_payload.value !== Number(CAP08_S3_OUTCOME_VALUE_V1)
    || record.canonical_payload.unit !== "fraction"
    || record.canonical_payload.quantity_kind !== "VOLUMETRIC_WATER_CONTENT") {
    throw new Error("CAP08_S3_OUTCOME_COMPLETION_EVIDENCE_IDENTITY_MISMATCH");
  }
  requiredStringV1(record.source_record_hash, "CAP08_S3_OUTCOME_HASH_REQUIRED");
  return { ...record, formal_run_id: formalRunId };
}

function recordJsonV1(type: string, payload: unknown): Record<string, unknown> {
  return { type, payload };
}

export class Cap08S3OutcomeCompletionEvidenceServiceV1 {
  constructor(private readonly pool: Pool) {}

  private async commitExactV1<T extends { source_record_id: string; source_record_hash: string }>(input: {
    formal_run_id: string;
    record_type: string;
    occurred_at: string;
    evidence: T;
  }): Promise<Cap08S3CompletionEvidenceCommitResultV1<T>> {
    const factId = factIdV1(input.record_type, input.formal_run_id, input.evidence.source_record_id);
    const recordJson = recordJsonV1(input.record_type, input.evidence);
    const inserted = await this.pool.query(
      `INSERT INTO facts (fact_id,occurred_at,source,record_json)
       VALUES ($1,$2::timestamptz,$3,$4::jsonb)
       ON CONFLICT (fact_id) DO NOTHING
       RETURNING fact_id`,
      [factId, input.occurred_at, CAP08_S3_COMPLETION_EVIDENCE_SOURCE_V1, JSON.stringify(recordJson)],
    );
    if (inserted.rows.length === 1) return { status: "INSERTED", evidence: structuredClone(input.evidence) };
    if (inserted.rows.length !== 0) throw new Error("CAP08_S3_COMPLETION_EVIDENCE_INSERT_CARDINALITY");
    const existing = await this.pool.query(
      "SELECT source,record_json FROM facts WHERE fact_id=$1",
      [factId],
    );
    if (existing.rows.length !== 1
      || existing.rows[0].source !== CAP08_S3_COMPLETION_EVIDENCE_SOURCE_V1
      || semanticHashV1(existing.rows[0].record_json) !== semanticHashV1(recordJson)) {
      throw new Error("CAP08_S3_COMPLETION_EVIDENCE_IDEMPOTENCY_CONFLICT");
    }
    return { status: "EXISTING_IDEMPOTENT_SUCCESS", evidence: structuredClone(input.evidence) };
  }

  async commitOutcomeFvo10(input: {
    formal_run_id: string;
    scope: TwinScopeKeyV1;
    record: CanonicalReplayEvidenceRecordV1;
  }): Promise<Cap08S3CompletionEvidenceCommitResultV1<Cap08S3PersistedOutcomeEvidenceV1>> {
    const evidence = exactOutcomeV1(input);
    return this.commitExactV1({
      formal_run_id: evidence.formal_run_id,
      record_type: evidence.record_type,
      occurred_at: evidence.available_to_runtime_at,
      evidence,
    });
  }

  async commitOutcomeAbsenceWitness(input: {
    formal_run_id: string;
    scope: TwinScopeKeyV1;
  }): Promise<Cap08S3CompletionEvidenceCommitResultV1<Cap08S3OutcomeAbsenceWitnessV1>> {
    const evidence = buildCap08S3OutcomeAbsenceWitnessV1(input);
    validateCap08S3OutcomeAbsenceWitnessV1(evidence);
    return this.commitExactV1({
      formal_run_id: evidence.formal_run_id,
      record_type: evidence.record_type,
      occurred_at: evidence.logical_time,
      evidence,
    });
  }

  async readOutcomeFvo10(input: {
    formal_run_id: string;
    scope: TwinScopeKeyV1;
  }): Promise<Cap08S3PersistedOutcomeEvidenceV1 | null> {
    const rows = await this.pool.query(
      `SELECT record_json->'payload' AS payload
       FROM facts
       WHERE source=$1
         AND record_json->>'type'='soil_moisture_observation_v1'
         AND record_json->'payload'->>'formal_run_id'=$2
         AND record_json->'payload'->>'source_record_id'=$3
       LIMIT 2`,
      [CAP08_S3_COMPLETION_EVIDENCE_SOURCE_V1, input.formal_run_id, CAP08_S3_OUTCOME_FVO_ID_V1],
    );
    if (rows.rows.length === 0) return null;
    if (rows.rows.length !== 1) throw new Error("CAP08_S3_OUTCOME_COMPLETION_EVIDENCE_CARDINALITY");
    return exactOutcomeV1({ formal_run_id: input.formal_run_id, scope: input.scope, record: rows.rows[0].payload });
  }

  async readOutcomeAbsenceWitness(input: {
    formal_run_id: string;
    scope: TwinScopeKeyV1;
  }): Promise<Cap08S3OutcomeAbsenceWitnessV1 | null> {
    const rows = await this.pool.query(
      `SELECT record_json->'payload' AS payload
       FROM facts
       WHERE source=$1
         AND record_json->>'type'=$2
         AND record_json->'payload'->>'formal_run_id'=$3
       LIMIT 2`,
      [CAP08_S3_COMPLETION_EVIDENCE_SOURCE_V1, CAP08_S3_OUTCOME_ABSENCE_WITNESS_RECORD_TYPE_V1, input.formal_run_id],
    );
    if (rows.rows.length === 0) return null;
    if (rows.rows.length !== 1) throw new Error("CAP08_S3_ABSENCE_WITNESS_CARDINALITY");
    const witness = structuredClone(rows.rows[0].payload as Cap08S3OutcomeAbsenceWitnessV1);
    exactScopeV1(input.scope, witness.scope, "CAP08_S3_ABSENCE_WITNESS_SCOPE_MISMATCH");
    validateCap08S3OutcomeAbsenceWitnessV1(witness);
    return witness;
  }
}
