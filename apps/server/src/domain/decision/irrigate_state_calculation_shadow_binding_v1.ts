import { createHash } from "node:crypto";
import type { Pool } from "pg";
import { z } from "zod";

import {
  calculationResultV1Schema,
  type CalculationResultV1,
} from "../../contracts/canonical_decision_v1.js";
import { decisionEligibilityCriterionAssessmentV1Schema } from "../../contracts/decision_eligibility_v1.js";
import type { IrrigationRequirementSkillOutputV1 } from "../agronomy/skills/irrigation/irrigation_requirement_skill_v1.js";
import { projectAgronomyJudgeEligibilityPrecursorV1 } from "./agronomy_judge_eligibility_precursor_adapter_v1.js";
import type { DecisionRecommendationCandidateCriterionShadowBindingV1 } from "./decision_recommendation_candidate_criterion_shadow_binding_v1.js";
import { projectIrrigationRequirementCalculationResultV1 } from "./irrigation_calculation_result_adapter_v1.js";

export const B09AE_CALCULATION_IDENTITY_POLICY_V1 = "SOURCE_FACT_SCOPE_CALCULATOR_SHA256_V1" as const;
export const B09AE_CALCULATOR_REF_V1 = "irrigation_requirement_skill_v1" as const;
export const B09AE_RECOMMENDATION_SOURCE_V1 = "api/v1/recommendations/generate" as const;

export type IrrigateStateCalculationShadowInputV1 = {
  tenant_id: string;
  project_id: string;
  group_id: string;
  field_id?: string | null;
  season_id?: string | null;
  recommendation_id?: string | null;
};

export type IrrigateStateCalculationSourceFactV1 = {
  fact_id: string;
  occurred_at: string | Date;
  source: string;
  record_json: unknown;
};

export const irrigateStateCalculationShadowBindingV1Schema = z
  .object({
    schema_version: z.literal("irrigate_state_calculation_shadow_binding_v1"),
    authority_mode: z.literal("SHADOW_NON_AUTHORITATIVE"),
    binding_state: z.enum([
      "CANDIDATE_NOT_READY",
      "SOURCE_NOT_FOUND",
      "SOURCE_AMBIGUOUS",
      "SOURCE_IDENTITY_MISMATCH",
      "SOURCE_SEMANTICS_INVALID",
      "SKILL_TRACE_INVALID",
      "CALCULATION_PROJECTION_FAILED",
      "CALCULATION_BOUND_STATE_NOT_BOUND_JUDGE_SCOPE_MISMATCH",
      "CALCULATION_BOUND_STATE_NOT_BOUND_JUDGE_INPUT_MISMATCH",
      "CALCULATION_BOUND_STATE_NOT_BOUND_EVIDENCE_BLOCKED",
      "CALCULATION_BOUND_STATE_NOT_BOUND_SEMANTIC_MISMATCH",
      "BOUND",
      "BINDING_READ_ERROR",
    ]),
    recommendation_id: z.string().min(1).nullable(),
    candidate_ref: z.string().min(1).nullable(),
    source_fact_id: z.string().min(1).nullable(),
    source_fact_count: z.number().int().min(0).max(2),
    source_fact_occurred_at: z.string().datetime({ offset: true }).nullable(),
    calculation_identity_policy: z.literal(B09AE_CALCULATION_IDENTITY_POLICY_V1),
    calculation_identity_digest_sha256: z.string().regex(/^[a-f0-9]{64}$/).nullable(),
    calculation_id: z.string().min(1).nullable(),
    calculation_result_ref: z.string().min(1).nullable(),
    calculation_binding_state: z.enum(["NOT_BOUND", "BOUND_TO_SAME_SOURCE"]),
    calculation_result: calculationResultV1Schema.nullable(),
    shadow_candidate_calculation_result_refs: z.array(z.string().min(1)),
    judge_congruence_state: z.enum([
      "NOT_EVALUATED",
      "EXACT_MATCH",
      "SCOPE_MISMATCH",
      "INPUT_MISMATCH",
      "EVIDENCE_BLOCKED",
      "SEMANTIC_MISMATCH",
    ]),
    mismatched_fields: z.array(z.string().min(1)),
    b07c_projection_state: z.enum(["NOT_PROJECTED", "PROJECTED"]),
    b07c_criterion_assessments: z.array(decisionEligibilityCriterionAssessmentV1Schema),
    state_criterion_binding_state: z.enum(["NOT_BOUND", "BOUND_TO_SAME_CANDIDATE"]),
    state_criterion_assessment: decisionEligibilityCriterionAssessmentV1Schema.nullable(),
    decision_eligibility_runtime_connected: z.literal(false),
    legacy_agronomy_result_unchanged: z.literal(true),
    consumer_migration_performed: z.literal(false),
    authority_removal_permitted: z.literal(false),
    reason_codes: z.array(z.string().min(1)),
    limitations: z.array(z.string().min(1)),
  })
  .strict();

export type IrrigateStateCalculationShadowBindingV1 = z.infer<
  typeof irrigateStateCalculationShadowBindingV1Schema
>;

function text(value: unknown): string {
  return String(value ?? "").trim();
}

function nullableText(value: unknown): string | null {
  const normalized = text(value);
  return normalized || null;
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

function iso(value: string | Date | null | undefined): string | null {
  if (value == null) return null;
  const date = value instanceof Date ? value : new Date(value);
  return Number.isFinite(date.getTime()) ? date.toISOString() : null;
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

function nullableFiniteNumber(value: unknown): number | null | "INVALID" {
  if (value == null || value === "") return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : "INVALID";
}

function sameNullableNumber(a: unknown, b: unknown): boolean {
  const left = nullableFiniteNumber(a);
  const right = nullableFiniteNumber(b);
  return left !== "INVALID" && right !== "INVALID" && Object.is(left, right);
}

function sameNullableText(a: unknown, b: unknown): boolean {
  return nullableText(a) === nullableText(b);
}

function result(
  input: IrrigateStateCalculationShadowInputV1,
  state: IrrigateStateCalculationShadowBindingV1["binding_state"],
  detail: Partial<IrrigateStateCalculationShadowBindingV1> = {},
): IrrigateStateCalculationShadowBindingV1 {
  return irrigateStateCalculationShadowBindingV1Schema.parse({
    schema_version: "irrigate_state_calculation_shadow_binding_v1",
    authority_mode: "SHADOW_NON_AUTHORITATIVE",
    binding_state: state,
    recommendation_id: text(input.recommendation_id) || null,
    candidate_ref: detail.candidate_ref ?? null,
    source_fact_id: detail.source_fact_id ?? null,
    source_fact_count: detail.source_fact_count ?? 0,
    source_fact_occurred_at: detail.source_fact_occurred_at ?? null,
    calculation_identity_policy: B09AE_CALCULATION_IDENTITY_POLICY_V1,
    calculation_identity_digest_sha256: detail.calculation_identity_digest_sha256 ?? null,
    calculation_id: detail.calculation_id ?? null,
    calculation_result_ref: detail.calculation_result_ref ?? null,
    calculation_binding_state: detail.calculation_binding_state ?? "NOT_BOUND",
    calculation_result: detail.calculation_result ?? null,
    shadow_candidate_calculation_result_refs: detail.shadow_candidate_calculation_result_refs ?? [],
    judge_congruence_state: detail.judge_congruence_state ?? "NOT_EVALUATED",
    mismatched_fields: detail.mismatched_fields ?? [],
    b07c_projection_state: detail.b07c_projection_state ?? "NOT_PROJECTED",
    b07c_criterion_assessments: detail.b07c_criterion_assessments ?? [],
    state_criterion_binding_state: detail.state_criterion_binding_state ?? "NOT_BOUND",
    state_criterion_assessment: detail.state_criterion_assessment ?? null,
    decision_eligibility_runtime_connected: false,
    legacy_agronomy_result_unchanged: true,
    consumer_migration_performed: false,
    authority_removal_permitted: false,
    reason_codes: detail.reason_codes ?? [state],
    limitations: [
      "B09AE_SHADOW_NON_AUTHORITATIVE",
      "CALCULATION_RESULT_IS_SAME_SOURCE_COMPATIBILITY_PROJECTION",
      "LEGACY_SKILL_EVIDENCE_REFS_NOT_PROMOTED",
      "LATER_OR_CHANGED_JUDGE_RESULT_CANNOT_REWRITE_ORIGINAL_CANDIDATE_BASIS",
      "B07C_REMAINS_CRITERION_ONLY_WITH_NO_FINAL_ELIGIBILITY_AUTHORITY",
      "DECISION_ELIGIBILITY_RUNTIME_NOT_CONNECTED",
      "NO_CONSUMER_MIGRATION_IN_B09AE",
      "NO_AUTHORITY_REMOVAL_IN_B09AE",
      ...(detail.limitations ?? []),
    ],
  });
}

export function deriveIrrigateStateCalculationIdentityV1(input: {
  tenant_id: string;
  project_id: string;
  group_id: string;
  source_fact_id: string;
}): { calculation_id: string; digest_sha256: string } {
  const material = [
    B09AE_CALCULATION_IDENTITY_POLICY_V1,
    text(input.tenant_id),
    text(input.project_id),
    text(input.group_id),
    text(input.source_fact_id),
    B09AE_CALCULATOR_REF_V1,
  ];
  if (material.slice(1, 5).some((value) => !value)) {
    throw new Error("B09AE_CALCULATION_IDENTITY_MATERIAL_INCOMPLETE");
  }
  const digest = createHash("sha256").update(material.join("\u001f")).digest("hex");
  return {
    calculation_id: "calculation_sfsha256_" + digest,
    digest_sha256: digest,
  };
}

function judgeScopeMismatches(
  input: IrrigateStateCalculationShadowInputV1,
  judgeValue: Record<string, unknown>,
): string[] {
  const candidate = {
    tenant_id: text(input.tenant_id),
    project_id: text(input.project_id),
    group_id: text(input.group_id),
    field_id: nullableText(input.field_id),
    season_id: nullableText(input.season_id),
    recommendation_id: nullableText(input.recommendation_id),
  };
  const judge = {
    tenant_id: text(judgeValue.tenant_id),
    project_id: text(judgeValue.project_id),
    group_id: text(judgeValue.group_id),
    field_id: nullableText(judgeValue.field_id),
    season_id: nullableText(judgeValue.season_id),
    recommendation_id: nullableText(judgeValue.recommendation_id),
  };
  return Object.keys(candidate).filter(
    (key) => (candidate as any)[key] !== (judge as any)[key],
  );
}

const INPUT_FIELDS = [
  "soil_moisture",
  "target_soil_moisture",
  "root_zone_depth_mm",
  "rain_forecast_mm_72h",
  "et0_mm_72h",
  "crop_stage",
  "application_efficiency",
] as const;

function judgeInputMismatches(
  sourceInputs: Record<string, unknown>,
  judgeInputs: Record<string, unknown>,
): string[] {
  const mismatches: string[] = [];
  for (const key of INPUT_FIELDS) {
    const same = key === "crop_stage"
      ? sameNullableText(sourceInputs[key], judgeInputs[key])
      : sameNullableNumber(sourceInputs[key], judgeInputs[key]);
    if (!same) mismatches.push(key);
  }
  return mismatches;
}

function requirementOutputFromTrace(
  skillTrace: Record<string, any>,
): IrrigationRequirementSkillOutputV1 | null {
  if (text(skillTrace.skill_id) !== B09AE_CALCULATOR_REF_V1) return null;
  if (text(skillTrace.skill_version) !== "v1") return null;
  const outputs = record(skillTrace.outputs);
  const requirement = record(outputs.requirement);
  if (requirement.requirement_detected !== true) return null;
  if (!Array.isArray(requirement.evidence_refs)) return null;
  if (!record(requirement.confidence).level) return null;
  if (!record(requirement.calculation_trace).formula_version) return null;
  return requirement as IrrigationRequirementSkillOutputV1;
}

function sourceScopeMatches(
  input: IrrigateStateCalculationShadowInputV1,
  sourcePayload: Record<string, any>,
): boolean {
  return text(sourcePayload.tenant_id) === text(input.tenant_id)
    && text(sourcePayload.project_id) === text(input.project_id)
    && text(sourcePayload.group_id) === text(input.group_id)
    && nullableText(sourcePayload.field_id) === nullableText(input.field_id)
    && nullableText(sourcePayload.season_id) === nullableText(input.season_id)
    && nullableText(sourcePayload.recommendation_id) === nullableText(input.recommendation_id);
}

export function projectIrrigateStateCalculationShadowBindingV1(
  input: IrrigateStateCalculationShadowInputV1,
  sourceFacts: IrrigateStateCalculationSourceFactV1[],
  judgeValue: Record<string, unknown>,
  candidateShadow: DecisionRecommendationCandidateCriterionShadowBindingV1,
): IrrigateStateCalculationShadowBindingV1 {
  const candidate = candidateShadow.candidate_decision;
  const candidateRef = candidateShadow.candidate_ref;

  if (
    candidateShadow.binding_state !== "BOUND"
    || candidate == null
    || !candidateRef
    || !candidateShadow.source_fact_id
  ) {
    return result(input, "CANDIDATE_NOT_READY", {
      candidate_ref: candidateRef,
      source_fact_id: candidateShadow.source_fact_id,
      reason_codes: ["B09AE_B09J_CANDIDATE_NOT_BOUND"],
    });
  }

  if (candidate.proposed_action.action_type !== "IRRIGATE") {
    return result(input, "SOURCE_SEMANTICS_INVALID", {
      candidate_ref: candidateRef,
      source_fact_id: candidateShadow.source_fact_id,
      reason_codes: ["B09AE_ONLY_IRRIGATE_CANDIDATE_SUPPORTED"],
    });
  }

  if (sourceFacts.length === 0) {
    return result(input, "SOURCE_NOT_FOUND", {
      candidate_ref: candidateRef,
      source_fact_id: candidateShadow.source_fact_id,
      source_fact_count: 0,
      reason_codes: ["B09AE_BOUND_RECOMMENDATION_SOURCE_FACT_NOT_FOUND"],
    });
  }
  if (sourceFacts.length !== 1) {
    return result(input, "SOURCE_AMBIGUOUS", {
      candidate_ref: candidateRef,
      source_fact_id: candidateShadow.source_fact_id,
      source_fact_count: Math.min(sourceFacts.length, 2),
      reason_codes: ["B09AE_BOUND_RECOMMENDATION_SOURCE_FACT_AMBIGUOUS"],
    });
  }

  const sourceFact = sourceFacts[0];
  const sourceOccurredAt = iso(sourceFact.occurred_at);
  const sourceRecord = record(sourceFact.record_json);
  const sourcePayload = record(sourceRecord.payload);
  const sourceFactId = text(sourceFact.fact_id);

  const common = {
    candidate_ref: candidateRef,
    source_fact_id: sourceFactId || candidateShadow.source_fact_id,
    source_fact_count: 1,
    source_fact_occurred_at: sourceOccurredAt,
  };

  if (
    sourceFactId !== candidateShadow.source_fact_id
    || candidate.source_ref !== sourceFactId
  ) {
    return result(input, "SOURCE_IDENTITY_MISMATCH", {
      ...common,
      reason_codes: ["B09AE_RE_READ_SOURCE_FACT_DOES_NOT_MATCH_B09J_CANDIDATE_SOURCE"],
    });
  }

  if (
    text(sourceRecord.type) !== "decision_recommendation_v1"
    || text(sourceFact.source) !== B09AE_RECOMMENDATION_SOURCE_V1
    || text(sourcePayload.action_type) !== "IRRIGATE"
    || text(sourcePayload.status) !== "proposed"
    || !sourceScopeMatches(input, sourcePayload)
    || !sourceOccurredAt
  ) {
    return result(input, "SOURCE_SEMANTICS_INVALID", {
      ...common,
      reason_codes: ["B09AE_RECOMMENDATION_SOURCE_SEMANTICS_INVALID"],
    });
  }

  const skillTrace = record(sourcePayload.skill_trace);
  const skillInputs = record(skillTrace.inputs);
  const requirementOutput = requirementOutputFromTrace(skillTrace);
  if (
    requirementOutput == null
    || text(skillInputs.tenant_id) !== text(input.tenant_id)
    || text(skillInputs.project_id) !== text(input.project_id)
    || text(skillInputs.group_id) !== text(input.group_id)
    || nullableText(skillInputs.field_id) !== nullableText(input.field_id)
  ) {
    return result(input, "SKILL_TRACE_INVALID", {
      ...common,
      reason_codes: ["B09AE_PERSISTED_IRRIGATION_REQUIREMENT_SKILL_TRACE_INVALID"],
    });
  }

  const identity = deriveIrrigateStateCalculationIdentityV1({
    tenant_id: input.tenant_id,
    project_id: input.project_id,
    group_id: input.group_id,
    source_fact_id: sourceFactId,
  });
  const calculationRef = "calculation_result_v1:" + identity.calculation_id;

  let calculation: CalculationResultV1;
  try {
    calculation = projectIrrigationRequirementCalculationResultV1(requirementOutput, {
      calculation_id: identity.calculation_id,
      scope: candidate.scope,
      evidence_qualification_refs: unique(candidate.basis.evidence_qualification_refs),
      context_snapshot_ref: candidate.basis.context_snapshot_ref,
      crop_stage_state_ref: candidate.basis.crop_stage_state_ref,
      trace_refs: unique([
        "decision_recommendation_v1:" + sourceFactId,
        text(skillTrace.trace_id) ? "skill_trace:" + text(skillTrace.trace_id) : "",
      ]),
      evaluated_at: sourceOccurredAt,
      decision_time: candidate.decision_time,
    });
  } catch {
    return result(input, "CALCULATION_PROJECTION_FAILED", {
      ...common,
      calculation_identity_digest_sha256: identity.digest_sha256,
      calculation_id: identity.calculation_id,
      calculation_result_ref: calculationRef,
      reason_codes: ["B09AE_B06B_CALCULATION_PROJECTION_FAILED_CLOSED"],
    });
  }

  const calculationDetail = {
    ...common,
    calculation_identity_digest_sha256: identity.digest_sha256,
    calculation_id: identity.calculation_id,
    calculation_result_ref: calculationRef,
    calculation_binding_state: "BOUND_TO_SAME_SOURCE" as const,
    calculation_result: calculation,
    shadow_candidate_calculation_result_refs: [calculationRef],
  };

  const judge = record(judgeValue);
  const scopeMismatches = judgeScopeMismatches(input, judge);
  if (scopeMismatches.length > 0) {
    return result(input, "CALCULATION_BOUND_STATE_NOT_BOUND_JUDGE_SCOPE_MISMATCH", {
      ...calculationDetail,
      judge_congruence_state: "SCOPE_MISMATCH",
      mismatched_fields: scopeMismatches,
      reason_codes: ["B09AE_JUDGE_SCOPE_DOES_NOT_MATCH_BOUND_CANDIDATE"],
    });
  }

  const judgeInputs = record(judge.inputs);
  const inputMismatches = judgeInputMismatches(skillInputs, judgeInputs);
  if (inputMismatches.length > 0) {
    return result(input, "CALCULATION_BOUND_STATE_NOT_BOUND_JUDGE_INPUT_MISMATCH", {
      ...calculationDetail,
      judge_congruence_state: "INPUT_MISMATCH",
      mismatched_fields: inputMismatches,
      reason_codes: ["B09AE_JUDGE_INPUTS_DIFFER_FROM_ORIGINAL_RECOMMENDATION_SKILL_INPUTS"],
    });
  }

  const verdict = text(judge.verdict).toUpperCase();
  const judgeRef = "judge_result_v2:" + text(judge.judge_id);
  if (!text(judge.judge_id)) {
    return result(input, "SOURCE_SEMANTICS_INVALID", {
      ...calculationDetail,
      reason_codes: ["B09AE_JUDGE_ID_REQUIRED_FOR_B07C_SOURCE_REF"],
    });
  }

  if (verdict === "PASS") {
    return result(input, "CALCULATION_BOUND_STATE_NOT_BOUND_SEMANTIC_MISMATCH", {
      ...calculationDetail,
      judge_congruence_state: "SEMANTIC_MISMATCH",
      reason_codes: ["B09AE_EXACT_CONGRUENT_PASS_CONTRADICTS_SOURCE_REQUIREMENT_DETECTED_TRUE"],
    });
  }

  let precursor: ReturnType<typeof projectAgronomyJudgeEligibilityPrecursorV1>;
  try {
    precursor = projectAgronomyJudgeEligibilityPrecursorV1(judge, {
      candidate_ref: candidateRef,
      candidate_action_type: "IRRIGATE",
      source_ref: judgeRef,
      canonical_evidence_qualification_refs: unique(candidate.basis.evidence_qualification_refs),
      calculation_result_refs: [calculationRef],
    });
  } catch {
    return result(input, "CALCULATION_BOUND_STATE_NOT_BOUND_SEMANTIC_MISMATCH", {
      ...calculationDetail,
      judge_congruence_state: "SEMANTIC_MISMATCH",
      reason_codes: ["B09AE_B07C_PRECURSOR_PROJECTION_FAILED_CLOSED"],
    });
  }

  const assessments = precursor.criterion_assessments;
  const stateAssessment = assessments.find((assessment) => assessment.criterion === "STATE") ?? null;

  if (verdict === "BLOCKED") {
    return result(input, "CALCULATION_BOUND_STATE_NOT_BOUND_EVIDENCE_BLOCKED", {
      ...calculationDetail,
      judge_congruence_state: "EVIDENCE_BLOCKED",
      b07c_projection_state: "PROJECTED",
      b07c_criterion_assessments: assessments,
      state_criterion_assessment: null,
      reason_codes: [
        "B09AE_EXACT_INPUTS_BUT_AGRONOMY_JUDGE_BLOCKED_BY_EVIDENCE",
        "B09AE_STATE_REMAINS_UNBOUND",
      ],
    });
  }

  if (
    verdict !== "WATER_DEFICIT"
    || stateAssessment == null
    || stateAssessment.status !== "SATISFIED"
    || JSON.stringify(unique(stateAssessment.support_refs)) !== JSON.stringify([calculationRef])
  ) {
    return result(input, "CALCULATION_BOUND_STATE_NOT_BOUND_SEMANTIC_MISMATCH", {
      ...calculationDetail,
      judge_congruence_state: "SEMANTIC_MISMATCH",
      b07c_projection_state: "PROJECTED",
      b07c_criterion_assessments: assessments,
      reason_codes: ["B09AE_B07C_STATE_OUTPUT_DOES_NOT_MATCH_EXPECTED_SAME_SOURCE_CALCULATION_SUPPORT"],
    });
  }

  return result(input, "BOUND", {
    ...calculationDetail,
    judge_congruence_state: "EXACT_MATCH",
    b07c_projection_state: "PROJECTED",
    b07c_criterion_assessments: assessments,
    state_criterion_binding_state: "BOUND_TO_SAME_CANDIDATE",
    state_criterion_assessment: stateAssessment,
    reason_codes: [
      "B09AE_SAME_RECOMMENDATION_SOURCE_CALCULATION_RESULT_BOUND",
      "B09AE_JUDGE_INPUTS_EXACTLY_MATCH_ORIGINAL_RECOMMENDATION_SKILL_INPUTS",
      "B09AE_EXISTING_B07C_STATE_CRITERION_BOUND_TO_SAME_CANDIDATE",
    ],
  });
}

export async function buildIrrigateStateCalculationShadowBindingV1(
  pool: Pool,
  input: IrrigateStateCalculationShadowInputV1,
  judgeValue: Record<string, unknown>,
  candidateShadow: DecisionRecommendationCandidateCriterionShadowBindingV1,
): Promise<IrrigateStateCalculationShadowBindingV1> {
  if (
    candidateShadow.binding_state !== "BOUND"
    || !candidateShadow.source_fact_id
  ) {
    return projectIrrigateStateCalculationShadowBindingV1(
      input,
      [],
      judgeValue,
      candidateShadow,
    );
  }

  try {
    const query = await pool.query(
      `SELECT fact_id, occurred_at, source, record_json::jsonb AS record_json
         FROM facts
        WHERE fact_id = $1
          AND (record_json::jsonb->>'type') = 'decision_recommendation_v1'
          AND (record_json::jsonb#>>'{payload,tenant_id}') = $2
          AND (record_json::jsonb#>>'{payload,project_id}') = $3
          AND (record_json::jsonb#>>'{payload,group_id}') = $4
          AND (record_json::jsonb#>>'{payload,recommendation_id}') = $5
        LIMIT 2`,
      [
        candidateShadow.source_fact_id,
        input.tenant_id,
        input.project_id,
        input.group_id,
        text(input.recommendation_id),
      ],
    );
    return projectIrrigateStateCalculationShadowBindingV1(
      input,
      (query.rows ?? []) as IrrigateStateCalculationSourceFactV1[],
      judgeValue,
      candidateShadow,
    );
  } catch {
    return result(input, "BINDING_READ_ERROR", {
      candidate_ref: candidateShadow.candidate_ref,
      source_fact_id: candidateShadow.source_fact_id,
      reason_codes: ["B09AE_BOUND_RECOMMENDATION_SOURCE_RE_READ_FAILED"],
    });
  }
}
