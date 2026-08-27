import type { EvidenceScopeV1 } from "../contracts/canonical_evidence_v1.js";
import {
  qualifiedCropStageStateV1Schema,
  type QualifiedCropStageStateV1,
} from "../contracts/canonical_context_v1.js";
import type { CropSkill } from "../domain/agronomy/skills/types.js";

const CANONICAL_COMPATIBLE_SKILL_STAGE = new Set([
  "seedling",
  "vegetative",
  "flowering",
  "fruiting",
  "reproductive",
]);

export type CropSkillStageCompatibilityInputV1 = {
  state_id: string;
  scope: EvidenceScopeV1;
  crop_code: string;
  crop_skill: CropSkill;
  days_after_sowing?: number | null;
  days_after_planting?: number | null;
  metrics?: unknown;
  evaluated_at: string;
  decision_time?: string | null;
  context_snapshot_ref?: string | null;
};

function normalize(value: unknown): string {
  return String(value ?? "").trim().toLowerCase();
}

function unknownStage(
  input: CropSkillStageCompatibilityInputV1,
  reasonCode: string,
): QualifiedCropStageStateV1 {
  return qualifiedCropStageStateV1Schema.parse({
    schema_version: "qualified_crop_stage_state_v1",
    state_id: input.state_id,
    scope: input.scope,
    stage: null,
    authority_state: "UNKNOWN",
    source_class: "NONE",
    context_snapshot_ref: input.context_snapshot_ref ?? null,
    evidence_qualification_refs: [],
    derived_state_ref: null,
    evaluated_at: input.evaluated_at,
    decision_time: input.decision_time ?? null,
    decision_input_eligible: false,
    limitations: [
      "B05D_CROP_SKILL_STAGE_COMPATIBILITY_ONLY",
      "CANONICAL_TWIN_STAGE_AUTHORITY_NOT_ESTABLISHED",
      "UNKNOWN_MUST_REMAIN_UNKNOWN",
    ],
    reason_codes: [reasonCode],
  });
}

function compatibilityStage(
  input: CropSkillStageCompatibilityInputV1,
  stage: string,
): QualifiedCropStageStateV1 {
  return qualifiedCropStageStateV1Schema.parse({
    schema_version: "qualified_crop_stage_state_v1",
    state_id: input.state_id,
    scope: input.scope,
    stage,
    authority_state: "COMPATIBILITY_NON_AUTHORITATIVE",
    source_class: "CROP_SKILL_CALCULATOR",
    context_snapshot_ref: input.context_snapshot_ref ?? null,
    evidence_qualification_refs: [],
    derived_state_ref: null,
    evaluated_at: input.evaluated_at,
    decision_time: input.decision_time ?? null,
    decision_input_eligible: false,
    limitations: [
      "B05D_CROP_SKILL_STAGE_COMPATIBILITY_ONLY",
      "CANONICAL_TWIN_STAGE_AUTHORITY_NOT_ESTABLISHED",
    ],
    reason_codes: ["B05D_CROP_SKILL_CALCULATOR_COMPATIBILITY"],
  });
}

function chooseDaysAfterSowing(
  input: CropSkillStageCompatibilityInputV1,
): { ok: true; value: number } | { ok: false; reason: string } {
  if (input.days_after_sowing !== undefined && input.days_after_sowing !== null) {
    if (typeof input.days_after_sowing !== "number" || !Number.isFinite(input.days_after_sowing)) {
      return { ok: false, reason: "B05D_DAYS_AFTER_SOWING_INVALID" };
    }
    if (input.days_after_sowing < 0) {
      return { ok: false, reason: "B05D_NEGATIVE_DAYS_AFTER_SOWING_REJECTED" };
    }
    return { ok: true, value: input.days_after_sowing };
  }

  if (input.days_after_planting !== undefined && input.days_after_planting !== null) {
    if (typeof input.days_after_planting !== "number" || !Number.isFinite(input.days_after_planting)) {
      return { ok: false, reason: "B05D_DAYS_AFTER_PLANTING_INVALID" };
    }
    if (input.days_after_planting < 0) {
      return { ok: false, reason: "B05D_NEGATIVE_DAYS_AFTER_PLANTING_REJECTED" };
    }
    return { ok: true, value: input.days_after_planting };
  }

  return { ok: false, reason: "B05D_DAYS_INPUT_MISSING" };
}

/**
 * B-05d crop-skill compatibility boundary.
 *
 * The historical crop skills default a missing/falsey day count to seedling.
 * Canonical paths must not treat that convenience default as stage truth.
 *
 * This adapter therefore requires an explicit, finite, nonnegative day count
 * before invoking the legacy skill resolver. Even a valid skill result remains
 * COMPATIBILITY_NON_AUTHORITATIVE and is never a canonical decision input.
 */
export function projectCropSkillStageCompatibilityV1(
  input: CropSkillStageCompatibilityInputV1,
): QualifiedCropStageStateV1 {
  const evaluatedAtMs = Date.parse(input.evaluated_at);
  if (!Number.isFinite(evaluatedAtMs)) {
    throw new Error("B05D_EVALUATED_AT_INVALID");
  }

  const requestedCrop = normalize(input.crop_code);
  const skillCrop = normalize(input.crop_skill?.crop_code);
  if (!requestedCrop) {
    return unknownStage(input, "B05D_CROP_CODE_MISSING");
  }
  if (!input.crop_skill || !skillCrop || requestedCrop !== skillCrop) {
    return unknownStage(input, "B05D_CROP_SKILL_SCOPE_MISMATCH");
  }
  if (input.crop_skill.enabled !== true) {
    return unknownStage(input, "B05D_CROP_SKILL_DISABLED");
  }

  const days = chooseDaysAfterSowing(input);
  if (!days.ok) {
    return unknownStage(input, days.reason);
  }

  let resolved: unknown;
  try {
    resolved = input.crop_skill.resolveStage({
      days_after_sowing: days.value,
      metrics: input.metrics,
    });
  } catch {
    return unknownStage(input, "B05D_CROP_SKILL_RESOLVER_FAILED");
  }

  const stage = normalize(resolved);
  if (!CANONICAL_COMPATIBLE_SKILL_STAGE.has(stage)) {
    return unknownStage(input, "B05D_CROP_SKILL_STAGE_UNRECOGNIZED");
  }

  return compatibilityStage(input, stage);
}
