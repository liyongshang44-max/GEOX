import { randomUUID } from "node:crypto";
import type { FieldProgramV1 } from "@geox/contracts";
import type { Pool, PoolClient } from "pg";
import { z } from "zod";

import {
  contextSnapshotV1Schema,
  type ContextSnapshotV1,
} from "../../contracts/canonical_context_v1.js";
import { evidenceScopeV1Schema } from "../../contracts/canonical_evidence_v1.js";
import { projectFieldProgramDeclaredContextV1 } from "../../context/field_program_context_projection_v1.js";
import { deriveDecisionRecommendationCandidateIdentityV1 } from "./decision_recommendation_candidate_criterion_shadow_binding_v1.js";

export const B09Y_BOUNDARY_FACT_TYPE_V1 = "canonical_decision_boundary_envelope_v1" as const;
export const B09Y_CONTEXT_FACT_TYPE_V1 = "context_snapshot_v1" as const;
export const B09Y_RUNTIME_SOURCE_V1 = "b09y/candidate_decision_boundary_context/v1" as const;

const programPrioritySchema = z.enum(["low", "medium", "high"]);
const fieldProgramStatusSchema = z.enum([
  "DRAFT",
  "ACTIVE",
  "PAUSED",
  "COMPLETED",
  "CANCELLED",
  "ARCHIVED",
]);

const fieldProgramPayloadSchema = z.object({
  tenant_id: z.string().min(1),
  project_id: z.string().min(1),
  group_id: z.string().min(1),
  program_id: z.string().min(1),
  field_id: z.string().min(1),
  season_id: z.string().min(1),
  crop_code: z.string(),
  variety_code: z.string().nullable().optional(),
  goal_profile: z.object({
    yield_priority: programPrioritySchema,
    quality_priority: programPrioritySchema,
    residue_priority: programPrioritySchema,
    water_saving_priority: programPrioritySchema,
    cost_priority: programPrioritySchema,
  }).passthrough(),
  constraints: z.object({
    forbid_pesticide_classes: z.array(z.string()),
    forbid_fertilizer_types: z.array(z.string()),
    max_irrigation_mm_per_day: z.number().finite().nullable().optional(),
    manual_approval_required_for: z.array(z.string()),
    allow_night_irrigation: z.boolean(),
  }).passthrough(),
  budget: z.object({
    max_cost_total: z.number().finite().nullable().optional(),
    currency: z.string().min(1),
  }).nullable().optional(),
  execution_policy: z.object({
    mode: z.enum(["approval_required", "auto_allowed"]),
    auto_execute_allowed_task_types: z.array(z.string()),
  }).passthrough(),
  acceptance_policy_ref: z.string().nullable().optional(),
  evidence_policy_ref: z.string().nullable().optional(),
  status: fieldProgramStatusSchema,
  created_ts: z.number().finite(),
  updated_ts: z.number().finite(),
}).passthrough();

const fieldProgramFactRecordSchema = z.object({
  type: z.literal("field_program_v1"),
  payload: fieldProgramPayloadSchema,
}).passthrough();

const recommendationFactRecordSchema = z.object({
  type: z.literal("decision_recommendation_v1"),
  payload: z.object({
    tenant_id: z.string().min(1),
    project_id: z.string().min(1),
    group_id: z.string().min(1),
    recommendation_id: z.string().min(1),
    field_id: z.string().min(1),
    season_id: z.string().nullable().optional(),
    device_id: z.string().nullable().optional(),
    zone_id: z.string().nullable().optional(),
    action_type: z.string().min(1),
    status: z.string().min(1),
  }).passthrough(),
}).passthrough();

export const candidateDecisionBoundaryEnvelopeV1Schema = z.object({
  schema_version: z.literal("canonical_decision_boundary_envelope_v1"),
  boundary_id: z.string().min(1),
  candidate_id: z.string().min(1),
  candidate_ref: z.string().min(1),
  scope: evidenceScopeV1Schema,
  decision_time: z.string().datetime({ offset: true }),
  recommendation_id: z.string().min(1),
  source_recommendation_fact_ref: z.string().min(1),
  evidence_qualification_refs: z.array(z.string().min(1)),
  field_program_fact_ref: z.string().min(1),
  program_id: z.string().min(1),
  context_snapshot_ref: z.string().min(1),
  context_snapshot_fact_ref: z.string().min(1),
  source_input_refs: z.array(z.string().min(1)),
  forecast_refs: z.array(z.string().min(1)),
  authority_state: z.literal("BOUNDARY_ONLY"),
  server_created: z.literal(true),
  caller_supplied_decision_time: z.literal(false),
  post_boundary_semantics: z.literal("EXACT_IMMUTABLE_REFS_OR_SAME_DECISION_TIME_AS_OF_ONLY"),
  limitations: z.array(z.string().min(1)),
}).strict();

export type CandidateDecisionBoundaryEnvelopeV1 = z.infer<
  typeof candidateDecisionBoundaryEnvelopeV1Schema
>;

export const candidateDecisionBoundaryContextBindingV1Schema = z.object({
  schema_version: z.literal("candidate_decision_boundary_context_binding_v1"),
  authority_mode: z.literal("SHADOW_CANONICAL_BOUNDARY"),
  binding_state: z.enum([
    "NOT_REQUESTED",
    "RECOMMENDATION_NOT_FOUND",
    "RECOMMENDATION_AMBIGUOUS",
    "RECOMMENDATION_INVALID",
    "FIELD_PROGRAM_NOT_FOUND",
    "FIELD_PROGRAM_INVALID",
    "SCOPE_MISMATCH",
    "BOUNDARY_AMBIGUOUS",
    "BOUNDARY_CONFLICT",
    "BOUND",
    "BINDING_READ_ERROR",
  ]),
  recommendation_id: z.string().min(1).nullable(),
  source_recommendation_fact_id: z.string().min(1).nullable(),
  field_program_fact_id: z.string().min(1).nullable(),
  candidate_id: z.string().min(1).nullable(),
  candidate_ref: z.string().min(1).nullable(),
  decision_time: z.string().datetime({ offset: true }).nullable(),
  context_snapshot_ref: z.string().min(1).nullable(),
  context_snapshot_fact_id: z.string().min(1).nullable(),
  context_snapshot: contextSnapshotV1Schema.nullable(),
  boundary_fact_id: z.string().min(1).nullable(),
  boundary_envelope: candidateDecisionBoundaryEnvelopeV1Schema.nullable(),
  persisted_state: z.enum(["NOT_PERSISTED", "CREATED", "EXISTING_IDEMPOTENT"]),
  exact_program_binding: z.boolean(),
  legacy_latest_program_reader_used: z.literal(false),
  caller_decision_time_accepted: z.literal(false),
  forecast_refs: z.array(z.string().min(1)),
  decision_eligibility_runtime_connected: z.literal(false),
  consumer_migration_performed: z.literal(false),
  authority_removal_permitted: z.literal(false),
  reason_codes: z.array(z.string().min(1)),
  limitations: z.array(z.string().min(1)),
}).strict();

export type CandidateDecisionBoundaryContextBindingV1 = z.infer<
  typeof candidateDecisionBoundaryContextBindingV1Schema
>;

export type CandidateDecisionBoundaryContextInputV1 = {
  tenant_id: string;
  project_id: string;
  group_id: string;
  field_id?: string | null;
  season_id?: string | null;
  device_id?: string | null;
  recommendation_id?: string | null;
  field_program_fact_id?: string | null;
};

type FactRowV1 = {
  fact_id: string;
  occurred_at: string | Date;
  source: string;
  record_json: unknown;
};

type PreparedBoundaryInputsV1 = {
  input: CandidateDecisionBoundaryContextInputV1;
  recommendation_fact: FactRowV1;
  recommendation_record: z.infer<typeof recommendationFactRecordSchema>;
  field_program_fact: FactRowV1;
  field_program: FieldProgramV1;
  candidate_id: string;
  candidate_ref: string;
  evidence_qualification_refs: string[];
};

function text(value: unknown): string {
  return String(value ?? "").trim();
}

function iso(value: unknown): string | null {
  if (value instanceof Date) return value.toISOString();
  const raw = text(value);
  if (!raw) return null;
  const parsed = new Date(raw);
  return Number.isFinite(parsed.getTime()) ? parsed.toISOString() : null;
}

function record(value: unknown): Record<string, any> {
  if (value && typeof value === "object" && !Array.isArray(value)) {
    return value as Record<string, any>;
  }
  if (typeof value === "string") {
    try {
      const parsed = JSON.parse(value);
      return parsed && typeof parsed === "object" && !Array.isArray(parsed)
        ? parsed as Record<string, any>
        : {};
    } catch {
      return {};
    }
  }
  return {};
}

function unique(values: unknown): string[] {
  return Array.from(
    new Set(
      (Array.isArray(values) ? values : [])
        .map((value) => text(value))
        .filter(Boolean),
    ),
  ).sort();
}

function sameRefs(a: unknown, b: unknown): boolean {
  return JSON.stringify(unique(a)) === JSON.stringify(unique(b));
}

function result(
  input: CandidateDecisionBoundaryContextInputV1,
  state: CandidateDecisionBoundaryContextBindingV1["binding_state"],
  detail: Partial<CandidateDecisionBoundaryContextBindingV1> = {},
): CandidateDecisionBoundaryContextBindingV1 {
  return candidateDecisionBoundaryContextBindingV1Schema.parse({
    schema_version: "candidate_decision_boundary_context_binding_v1",
    authority_mode: "SHADOW_CANONICAL_BOUNDARY",
    binding_state: state,
    recommendation_id: text(input.recommendation_id) || null,
    source_recommendation_fact_id: detail.source_recommendation_fact_id ?? null,
    field_program_fact_id: detail.field_program_fact_id ?? (text(input.field_program_fact_id) || null),
    candidate_id: detail.candidate_id ?? null,
    candidate_ref: detail.candidate_ref ?? null,
    decision_time: detail.decision_time ?? null,
    context_snapshot_ref: detail.context_snapshot_ref ?? null,
    context_snapshot_fact_id: detail.context_snapshot_fact_id ?? null,
    context_snapshot: detail.context_snapshot ?? null,
    boundary_fact_id: detail.boundary_fact_id ?? null,
    boundary_envelope: detail.boundary_envelope ?? null,
    persisted_state: detail.persisted_state ?? "NOT_PERSISTED",
    exact_program_binding: detail.exact_program_binding ?? false,
    legacy_latest_program_reader_used: false,
    caller_decision_time_accepted: false,
    forecast_refs: detail.forecast_refs ?? [],
    decision_eligibility_runtime_connected: false,
    consumer_migration_performed: false,
    authority_removal_permitted: false,
    reason_codes: detail.reason_codes ?? [state],
    limitations: [
      "B09Y_BOUNDARY_AND_CONTEXT_SHADOW_ONLY",
      "DECISION_TIME_IS_SERVER_CREATED_BOUNDARY_TIME",
      "LEGACY_RECOMMENDATION_CREATED_TS_NOT_USED_AS_DECISION_TIME",
      "RECOMMENDATION_FACT_OCCURRED_AT_NOT_USED_AS_DECISION_TIME",
      "FIELD_PROGRAM_LATEST_READER_FORBIDDEN",
      "EXACT_FIELD_PROGRAM_FACT_ID_REQUIRED",
      "FORECAST_REMAINS_UNBOUND_PENDING_MCFT_COMPLETION_AND_SEPARATE_AUTHORIZATION",
      "B07E_REMAINS_DISCONNECTED",
      "NO_APPROVAL_OR_EXECUTION_AUTHORITY",
      "NO_CONSUMER_MIGRATION_IN_B09Y",
      "NO_AUTHORITY_REMOVAL_IN_B09Y",
      ...(detail.limitations ?? []),
    ],
  });
}

function toFieldProgramV1(
  factRecord: z.infer<typeof fieldProgramFactRecordSchema>,
): FieldProgramV1 {
  const p = factRecord.payload;
  return {
    type: "field_program_v1",
    payload: {
      tenant_id: p.tenant_id,
      project_id: p.project_id,
      group_id: p.group_id,
      program_id: p.program_id,
      field_id: p.field_id,
      season_id: p.season_id,
      crop_code: p.crop_code,
      variety_code: p.variety_code ?? null,
      goal_profile: {
        yield_priority: p.goal_profile.yield_priority,
        quality_priority: p.goal_profile.quality_priority,
        residue_priority: p.goal_profile.residue_priority,
        water_saving_priority: p.goal_profile.water_saving_priority,
        cost_priority: p.goal_profile.cost_priority,
      },
      constraints: {
        forbid_pesticide_classes: p.constraints.forbid_pesticide_classes,
        forbid_fertilizer_types: p.constraints.forbid_fertilizer_types,
        max_irrigation_mm_per_day: p.constraints.max_irrigation_mm_per_day ?? null,
        manual_approval_required_for: p.constraints.manual_approval_required_for,
        allow_night_irrigation: p.constraints.allow_night_irrigation,
      },
      budget: p.budget == null
        ? null
        : {
            max_cost_total: p.budget.max_cost_total ?? null,
            currency: p.budget.currency,
          },
      execution_policy: {
        mode: p.execution_policy.mode,
        auto_execute_allowed_task_types: p.execution_policy.auto_execute_allowed_task_types,
      },
      acceptance_policy_ref: p.acceptance_policy_ref ?? null,
      evidence_policy_ref: p.evidence_policy_ref ?? null,
      status: p.status,
      created_ts: p.created_ts,
      updated_ts: p.updated_ts,
    },
  };
}

function validatePreparedInputsV1(
  input: CandidateDecisionBoundaryContextInputV1,
  recommendationFact: FactRowV1,
  fieldProgramFact: FactRowV1,
  evidenceQualificationRefs: string[],
): PreparedBoundaryInputsV1 | CandidateDecisionBoundaryContextBindingV1 {
  let recommendationRecord: z.infer<typeof recommendationFactRecordSchema>;
  let programRecord: z.infer<typeof fieldProgramFactRecordSchema>;
  try {
    recommendationRecord = recommendationFactRecordSchema.parse(record(recommendationFact.record_json));
  } catch {
    return result(input, "RECOMMENDATION_INVALID", {
      source_recommendation_fact_id: text(recommendationFact.fact_id) || null,
      reason_codes: ["B09Y_RECOMMENDATION_FACT_RUNTIME_SCHEMA_INVALID"],
    });
  }
  try {
    programRecord = fieldProgramFactRecordSchema.parse(record(fieldProgramFact.record_json));
  } catch {
    return result(input, "FIELD_PROGRAM_INVALID", {
      source_recommendation_fact_id: text(recommendationFact.fact_id) || null,
      field_program_fact_id: text(fieldProgramFact.fact_id) || null,
      reason_codes: ["B09Y_FIELD_PROGRAM_FACT_RUNTIME_SCHEMA_INVALID"],
    });
  }

  const recommendation = recommendationRecord.payload;
  const program = programRecord.payload;
  const requestedField = text(input.field_id);
  const requestedSeason = text(input.season_id);
  const requestedDevice = text(input.device_id);

  const recommendationScopeMatches =
    text(recommendationFact.source) === "api/v1/recommendations/generate"
    && recommendation.tenant_id === text(input.tenant_id)
    && recommendation.project_id === text(input.project_id)
    && recommendation.group_id === text(input.group_id)
    && recommendation.recommendation_id === text(input.recommendation_id)
    && Boolean(requestedField)
    && recommendation.field_id === requestedField
    && (!requestedSeason || text(recommendation.season_id) === requestedSeason)
    && (!requestedDevice || text(recommendation.device_id) === requestedDevice)
    && recommendation.status === "proposed";

  const programScopeMatches =
    program.tenant_id === text(input.tenant_id)
    && program.project_id === text(input.project_id)
    && program.group_id === text(input.group_id)
    && program.field_id === requestedField
    && (!requestedSeason || program.season_id === requestedSeason);

  if (!recommendationScopeMatches || !programScopeMatches) {
    return result(input, "SCOPE_MISMATCH", {
      source_recommendation_fact_id: text(recommendationFact.fact_id) || null,
      field_program_fact_id: text(fieldProgramFact.fact_id) || null,
      reason_codes: ["B09Y_RECOMMENDATION_OR_FIELD_PROGRAM_EXACT_SCOPE_MISMATCH"],
    });
  }

  const recommendationOccurredAt = iso(recommendationFact.occurred_at);
  const programOccurredAt = iso(fieldProgramFact.occurred_at);
  if (!recommendationOccurredAt) {
    return result(input, "RECOMMENDATION_INVALID", {
      source_recommendation_fact_id: text(recommendationFact.fact_id) || null,
      reason_codes: ["B09Y_RECOMMENDATION_OCCURRED_AT_INVALID_AS_PROVENANCE"],
    });
  }
  if (!programOccurredAt) {
    return result(input, "FIELD_PROGRAM_INVALID", {
      source_recommendation_fact_id: text(recommendationFact.fact_id) || null,
      field_program_fact_id: text(fieldProgramFact.fact_id) || null,
      reason_codes: ["B09Y_FIELD_PROGRAM_OCCURRED_AT_INVALID_AS_PROVENANCE"],
    });
  }

  const identity = deriveDecisionRecommendationCandidateIdentityV1({
    tenant_id: input.tenant_id,
    project_id: input.project_id,
    group_id: input.group_id,
    source_fact_id: text(recommendationFact.fact_id),
  });

  return {
    input,
    recommendation_fact: recommendationFact,
    recommendation_record: recommendationRecord,
    field_program_fact: fieldProgramFact,
    field_program: toFieldProgramV1(programRecord),
    candidate_id: identity.candidate_id,
    candidate_ref: "candidate_decision_v1:" + identity.candidate_id,
    evidence_qualification_refs: unique(evidenceQualificationRefs),
  };
}

function existingBoundaryMatchesV1(
  existing: CandidateDecisionBoundaryEnvelopeV1,
  prepared: PreparedBoundaryInputsV1,
): boolean {
  return existing.candidate_id === prepared.candidate_id
    && existing.candidate_ref === prepared.candidate_ref
    && existing.recommendation_id === text(prepared.input.recommendation_id)
    && existing.source_recommendation_fact_ref ===
      "decision_recommendation_v1:" + text(prepared.recommendation_fact.fact_id)
    && existing.field_program_fact_ref ===
      "field_program_v1:" + text(prepared.field_program_fact.fact_id)
    && existing.program_id === prepared.field_program.payload.program_id
    && sameRefs(
      existing.evidence_qualification_refs,
      prepared.evidence_qualification_refs,
    )
    && existing.forecast_refs.length === 0;
}

async function rollbackQuietlyV1(client: PoolClient): Promise<void> {
  try {
    await client.query("ROLLBACK");
  } catch {
    // Preserve original failure.
  }
}

async function readPersistedContextV1(
  client: PoolClient,
  contextSnapshotFactRef: string,
): Promise<{ fact_id: string; snapshot: ContextSnapshotV1 } | null> {
  const factId = text(contextSnapshotFactRef).replace(/^context_snapshot_fact_v1:/, "");
  if (!factId) return null;
  const q = await client.query(
    `SELECT fact_id, record_json::jsonb AS record_json
       FROM facts
      WHERE fact_id = $1
        AND (record_json::jsonb->>'type') = $2
      LIMIT 2`,
    [factId, B09Y_CONTEXT_FACT_TYPE_V1],
  );
  if ((q.rows ?? []).length !== 1) return null;
  const row = q.rows[0] as Record<string, unknown>;
  const payload = record(row.record_json).payload;
  try {
    return {
      fact_id: text(row.fact_id),
      snapshot: contextSnapshotV1Schema.parse(payload),
    };
  } catch {
    return null;
  }
}

export async function buildCandidateDecisionBoundaryContextBindingV1(
  pool: Pool,
  input: CandidateDecisionBoundaryContextInputV1,
  evidenceQualificationRefs: string[],
  options: { now?: () => string } = {},
): Promise<CandidateDecisionBoundaryContextBindingV1> {
  const recommendationId = text(input.recommendation_id);
  const fieldProgramFactId = text(input.field_program_fact_id);

  if (!recommendationId || !fieldProgramFactId) {
    return result(input, "NOT_REQUESTED", {
      reason_codes: [
        !recommendationId
          ? "B09Y_RECOMMENDATION_ID_REQUIRED"
          : "B09Y_EXACT_FIELD_PROGRAM_FACT_ID_REQUIRED",
      ],
    });
  }

  let recommendationRows: FactRowV1[] = [];
  let programRows: FactRowV1[] = [];

  try {
    const recommendationQuery = await pool.query(
      `SELECT fact_id, occurred_at, source, record_json::jsonb AS record_json
         FROM facts
        WHERE (record_json::jsonb->>'type') = 'decision_recommendation_v1'
          AND (record_json::jsonb#>>'{payload,tenant_id}') = $1
          AND (record_json::jsonb#>>'{payload,project_id}') = $2
          AND (record_json::jsonb#>>'{payload,group_id}') = $3
          AND (record_json::jsonb#>>'{payload,recommendation_id}') = $4
        ORDER BY occurred_at ASC, fact_id ASC
        LIMIT 2`,
      [input.tenant_id, input.project_id, input.group_id, recommendationId],
    );
    recommendationRows = (recommendationQuery.rows ?? []) as FactRowV1[];

    if (recommendationRows.length === 0) {
      return result(input, "RECOMMENDATION_NOT_FOUND", {
        reason_codes: ["B09Y_SCOPED_RECOMMENDATION_NOT_FOUND"],
      });
    }
    if (recommendationRows.length !== 1) {
      return result(input, "RECOMMENDATION_AMBIGUOUS", {
        reason_codes: ["B09Y_SCOPED_RECOMMENDATION_AMBIGUOUS_NO_LATEST_WINS"],
      });
    }

    const programQuery = await pool.query(
      `SELECT fact_id, occurred_at, source, record_json::jsonb AS record_json
         FROM facts
        WHERE fact_id = $1
          AND (record_json::jsonb->>'type') = 'field_program_v1'
        LIMIT 2`,
      [fieldProgramFactId],
    );
    programRows = (programQuery.rows ?? []) as FactRowV1[];
    if (programRows.length !== 1) {
      return result(input, "FIELD_PROGRAM_NOT_FOUND", {
        source_recommendation_fact_id: text(recommendationRows[0]?.fact_id) || null,
        field_program_fact_id: fieldProgramFactId,
        reason_codes: ["B09Y_EXACT_FIELD_PROGRAM_FACT_NOT_FOUND"],
      });
    }
  } catch {
    return result(input, "BINDING_READ_ERROR", {
      reason_codes: ["B09Y_PREBOUNDARY_FACT_READ_FAILED"],
    });
  }

  const preparedOrError = validatePreparedInputsV1(
    input,
    recommendationRows[0],
    programRows[0],
    evidenceQualificationRefs,
  );
  if ("binding_state" in preparedOrError) return preparedOrError;
  const prepared = preparedOrError;

  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    await client.query(
      "SELECT pg_advisory_xact_lock(hashtext($1))",
      [prepared.candidate_ref],
    );

    const exactRecommendation = await client.query(
      `SELECT fact_id, occurred_at, source, record_json::jsonb AS record_json
         FROM facts
        WHERE fact_id = $1
          AND (record_json::jsonb->>'type') = 'decision_recommendation_v1'
        LIMIT 2`,
      [prepared.recommendation_fact.fact_id],
    );
    const exactProgram = await client.query(
      `SELECT fact_id, occurred_at, source, record_json::jsonb AS record_json
         FROM facts
        WHERE fact_id = $1
          AND (record_json::jsonb->>'type') = 'field_program_v1'
        LIMIT 2`,
      [prepared.field_program_fact.fact_id],
    );

    if (
      (exactRecommendation.rows ?? []).length !== 1
      || (exactProgram.rows ?? []).length !== 1
    ) {
      throw new Error("B09Y_EXACT_BOUNDARY_INPUT_RECHECK_FAILED");
    }

    const boundaryRows = await client.query(
      `SELECT fact_id, occurred_at, record_json::jsonb AS record_json
         FROM facts
        WHERE (record_json::jsonb->>'type') = $1
          AND (record_json::jsonb#>>'{payload,candidate_ref}') = $2
        ORDER BY occurred_at ASC, fact_id ASC
        LIMIT 2`,
      [B09Y_BOUNDARY_FACT_TYPE_V1, prepared.candidate_ref],
    );

    if ((boundaryRows.rows ?? []).length > 1) {
      await rollbackQuietlyV1(client);
      return result(input, "BOUNDARY_AMBIGUOUS", {
        source_recommendation_fact_id: text(prepared.recommendation_fact.fact_id),
        field_program_fact_id: text(prepared.field_program_fact.fact_id),
        candidate_id: prepared.candidate_id,
        candidate_ref: prepared.candidate_ref,
        reason_codes: ["B09Y_CANDIDATE_HAS_MULTIPLE_BOUNDARY_FACTS_FAIL_CLOSED"],
      });
    }

    if ((boundaryRows.rows ?? []).length === 1) {
      const row = boundaryRows.rows[0] as Record<string, unknown>;
      let existing: CandidateDecisionBoundaryEnvelopeV1;
      try {
        existing = candidateDecisionBoundaryEnvelopeV1Schema.parse(
          record(row.record_json).payload,
        );
      } catch {
        await rollbackQuietlyV1(client);
        return result(input, "BOUNDARY_CONFLICT", {
          source_recommendation_fact_id: text(prepared.recommendation_fact.fact_id),
          field_program_fact_id: text(prepared.field_program_fact.fact_id),
          candidate_id: prepared.candidate_id,
          candidate_ref: prepared.candidate_ref,
          reason_codes: ["B09Y_EXISTING_BOUNDARY_INVALID"],
        });
      }

      if (!existingBoundaryMatchesV1(existing, prepared)) {
        await rollbackQuietlyV1(client);
        return result(input, "BOUNDARY_CONFLICT", {
          source_recommendation_fact_id: text(prepared.recommendation_fact.fact_id),
          field_program_fact_id: text(prepared.field_program_fact.fact_id),
          candidate_id: prepared.candidate_id,
          candidate_ref: prepared.candidate_ref,
          decision_time: existing.decision_time,
          boundary_fact_id: text(row.fact_id) || null,
          boundary_envelope: existing,
          reason_codes: ["B09Y_EXISTING_BOUNDARY_INTENT_CONFLICT"],
        });
      }

      const persistedContext = await readPersistedContextV1(
        client,
        existing.context_snapshot_fact_ref,
      );
      if (
        !persistedContext
        || "context_snapshot_v1:" + persistedContext.snapshot.snapshot_id
          !== existing.context_snapshot_ref
      ) {
        await rollbackQuietlyV1(client);
        return result(input, "BOUNDARY_CONFLICT", {
          source_recommendation_fact_id: text(prepared.recommendation_fact.fact_id),
          field_program_fact_id: text(prepared.field_program_fact.fact_id),
          candidate_id: prepared.candidate_id,
          candidate_ref: prepared.candidate_ref,
          decision_time: existing.decision_time,
          boundary_fact_id: text(row.fact_id) || null,
          boundary_envelope: existing,
          reason_codes: ["B09Y_EXISTING_CONTEXT_SNAPSHOT_FACT_MISSING_OR_INVALID"],
        });
      }

      await client.query("COMMIT");
      return result(input, "BOUND", {
        source_recommendation_fact_id: text(prepared.recommendation_fact.fact_id),
        field_program_fact_id: text(prepared.field_program_fact.fact_id),
        candidate_id: prepared.candidate_id,
        candidate_ref: prepared.candidate_ref,
        decision_time: existing.decision_time,
        context_snapshot_ref: existing.context_snapshot_ref,
        context_snapshot_fact_id: persistedContext.fact_id,
        context_snapshot: persistedContext.snapshot,
        boundary_fact_id: text(row.fact_id),
        boundary_envelope: existing,
        persisted_state: "EXISTING_IDEMPOTENT",
        exact_program_binding: true,
        forecast_refs: [],
        reason_codes: [
          "B09Y_EXISTING_SINGLE_BOUNDARY_REUSED_IDEMPOTENTLY",
          "B09Y_EXACT_FIELD_PROGRAM_CONTEXT_REBOUND_FROM_IMMUTABLE_FACT",
        ],
      });
    }

    const decisionTime = options.now?.() ?? new Date().toISOString();
    if (!iso(decisionTime)) {
      throw new Error("B09Y_SERVER_DECISION_TIME_INVALID");
    }

    const recommendationOccurredAt = iso(prepared.recommendation_fact.occurred_at);
    const programOccurredAt = iso(prepared.field_program_fact.occurred_at);
    if (
      !recommendationOccurredAt
      || !programOccurredAt
      || new Date(recommendationOccurredAt).getTime() > new Date(decisionTime).getTime()
      || new Date(programOccurredAt).getTime() > new Date(decisionTime).getTime()
    ) {
      throw new Error("B09Y_BOUND_INPUT_NOT_AVAILABLE_AT_DECISION_TIME");
    }

    const contextSnapshotId =
      "context_snapshot:field_program_fact:"
      + text(prepared.field_program_fact.fact_id)
      + ":"
      + prepared.candidate_id;
    const projected = projectFieldProgramDeclaredContextV1({
      field_program: prepared.field_program,
      decision_time: decisionTime,
      source_ref: "field_program_fact_v1:" + text(prepared.field_program_fact.fact_id),
      snapshot_id: contextSnapshotId,
    });
    const contextSnapshot = contextSnapshotV1Schema.parse(projected.snapshot);
    const contextSnapshotRef = "context_snapshot_v1:" + contextSnapshot.snapshot_id;
    const contextFactId = randomUUID();

    await client.query(
      "INSERT INTO facts (fact_id, occurred_at, source, record_json) VALUES ($1, $2::timestamptz, $3, $4::jsonb)",
      [
        contextFactId,
        decisionTime,
        B09Y_RUNTIME_SOURCE_V1,
        {
          type: B09Y_CONTEXT_FACT_TYPE_V1,
          payload: contextSnapshot,
          audit: {
            authority_state: "CONTEXT_SNAPSHOT_BOUNDARY_SHADOW_ONLY",
            exact_field_program_fact_id: text(prepared.field_program_fact.fact_id),
            candidate_ref: prepared.candidate_ref,
          },
        },
      ],
    );

    const boundaryId = "decision_boundary:" + prepared.candidate_id;
    const boundaryFactId = randomUUID();
    const envelope = candidateDecisionBoundaryEnvelopeV1Schema.parse({
      schema_version: "canonical_decision_boundary_envelope_v1",
      boundary_id: boundaryId,
      candidate_id: prepared.candidate_id,
      candidate_ref: prepared.candidate_ref,
      scope: {
        tenant_id: text(input.tenant_id),
        project_id: text(input.project_id),
        group_id: text(input.group_id),
        field_id: text(input.field_id),
        season_id: text(input.season_id) || null,
        zone_id: text(prepared.recommendation_record.payload.zone_id) || null,
      },
      decision_time: decisionTime,
      recommendation_id: recommendationId,
      source_recommendation_fact_ref:
        "decision_recommendation_v1:" + text(prepared.recommendation_fact.fact_id),
      evidence_qualification_refs: prepared.evidence_qualification_refs,
      field_program_fact_ref:
        "field_program_v1:" + text(prepared.field_program_fact.fact_id),
      program_id: prepared.field_program.payload.program_id,
      context_snapshot_ref: contextSnapshotRef,
      context_snapshot_fact_ref: "context_snapshot_fact_v1:" + contextFactId,
      source_input_refs: [
        "decision_recommendation_v1:" + text(prepared.recommendation_fact.fact_id),
        "field_program_v1:" + text(prepared.field_program_fact.fact_id),
      ],
      forecast_refs: [],
      authority_state: "BOUNDARY_ONLY",
      server_created: true,
      caller_supplied_decision_time: false,
      post_boundary_semantics: "EXACT_IMMUTABLE_REFS_OR_SAME_DECISION_TIME_AS_OF_ONLY",
      limitations: [
        "B09Y_SHADOW_ONLY_BOUNDARY",
        "FORECAST_NOT_BOUND",
        "ACTION_WINDOW_NOT_BOUND",
        "DECISION_ELIGIBILITY_RUNTIME_NOT_CONNECTED",
      ],
    });

    await client.query(
      "INSERT INTO facts (fact_id, occurred_at, source, record_json) VALUES ($1, $2::timestamptz, $3, $4::jsonb)",
      [
        boundaryFactId,
        decisionTime,
        B09Y_RUNTIME_SOURCE_V1,
        {
          type: B09Y_BOUNDARY_FACT_TYPE_V1,
          payload: envelope,
        },
      ],
    );

    await client.query("COMMIT");
    return result(input, "BOUND", {
      source_recommendation_fact_id: text(prepared.recommendation_fact.fact_id),
      field_program_fact_id: text(prepared.field_program_fact.fact_id),
      candidate_id: prepared.candidate_id,
      candidate_ref: prepared.candidate_ref,
      decision_time: decisionTime,
      context_snapshot_ref: contextSnapshotRef,
      context_snapshot_fact_id: contextFactId,
      context_snapshot: contextSnapshot,
      boundary_fact_id: boundaryFactId,
      boundary_envelope: envelope,
      persisted_state: "CREATED",
      exact_program_binding: true,
      forecast_refs: [],
      reason_codes: [
        "B09Y_SERVER_CREATED_SINGLE_CANDIDATE_BOUNDARY",
        "B09Y_EXACT_IMMUTABLE_FIELD_PROGRAM_FACT_BOUND",
        "B09Y_CONTEXT_SNAPSHOT_BOUND_TO_SAME_DECISION_TIME",
        "B09Y_FORECAST_INTENTIONALLY_UNBOUND",
      ],
    });
  } catch {
    await rollbackQuietlyV1(client);
    return result(input, "BINDING_READ_ERROR", {
      source_recommendation_fact_id: text(prepared.recommendation_fact.fact_id),
      field_program_fact_id: text(prepared.field_program_fact.fact_id),
      candidate_id: prepared.candidate_id,
      candidate_ref: prepared.candidate_ref,
      reason_codes: ["B09Y_BOUNDARY_TRANSACTION_FAILED_CLOSED"],
    });
  } finally {
    client.release();
  }
}
