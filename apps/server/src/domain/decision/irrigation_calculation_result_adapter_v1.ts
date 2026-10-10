import {
  calculationResultV1Schema,
  type CalculationResultV1,
} from "../../contracts/canonical_decision_v1.js";
import type { EvidenceScopeV1 } from "../../contracts/canonical_evidence_v1.js";
import type { IrrigationDeficitSkillOutputV1 } from "../agronomy/skills/irrigation/irrigation_deficit_skill_v1.js";
import type { IrrigationRequirementSkillOutputV1 } from "../agronomy/skills/irrigation/irrigation_requirement_skill_v1.js";

/**
 * B-06b compatibility adapters only.
 *
 * These functions project already-computed deterministic irrigation skill
 * outputs into CalculationResultV1. They do not run the skills, qualify raw
 * evidence, create CandidateDecision, or grant eligibility/approval/execution
 * authority.
 *
 * Legacy skill evidence_refs are deliberately NOT promoted into
 * evidence_qualification_refs. The caller must supply canonical qualification
 * refs explicitly.
 */

export type IrrigationCalculationProjectionContextV1 = {
  calculation_id: string;
  scope: EvidenceScopeV1;
  evidence_qualification_refs: string[];
  context_snapshot_ref?: string | null;
  crop_stage_state_ref?: string | null;
  trace_refs?: string[];
  evaluated_at: string;
  decision_time?: string | null;
};

function uniqueNonEmpty(values: string[] | undefined): string[] {
  return Array.from(
    new Set(
      (Array.isArray(values) ? values : [])
        .map((value) => String(value ?? "").trim())
        .filter(Boolean),
    ),
  );
}

function optionalRef(value: string | null | undefined): string | null {
  const normalized = String(value ?? "").trim();
  return normalized || null;
}

function uncertaintyFromConfidence(level: "HIGH" | "MEDIUM" | "LOW"): "LOW" | "MEDIUM" | "HIGH" {
  if (level === "HIGH") return "LOW";
  if (level === "MEDIUM") return "MEDIUM";
  return "HIGH";
}

function baseProjection(
  context: IrrigationCalculationProjectionContextV1,
  calculatorRef: string,
  outputs: CalculationResultV1["outputs"],
  assumptions: string[],
  uncertainty: CalculationResultV1["uncertainty"],
  limitations: string[],
): CalculationResultV1 {
  return calculationResultV1Schema.parse({
    schema_version: "calculation_result_v1",
    calculation_id: context.calculation_id,
    scope: context.scope,
    calculator_ref: calculatorRef,
    calculator_version: "v1",
    evidence_qualification_refs: uniqueNonEmpty(context.evidence_qualification_refs),
    context_snapshot_ref: optionalRef(context.context_snapshot_ref),
    crop_stage_state_ref: optionalRef(context.crop_stage_state_ref),
    outputs,
    trace_refs: uniqueNonEmpty(context.trace_refs),
    assumptions: uniqueNonEmpty(assumptions),
    uncertainty: {
      level: uncertainty.level,
      reasons: uniqueNonEmpty(uncertainty.reasons),
    },
    limitations: uniqueNonEmpty(limitations),
    evaluated_at: context.evaluated_at,
    decision_time: context.decision_time ?? null,
    authority_state: "CALCULATION_ONLY",
  });
}

export function projectIrrigationRequirementCalculationResultV1(
  output: IrrigationRequirementSkillOutputV1,
  context: IrrigationCalculationProjectionContextV1,
): CalculationResultV1 {
  const assumptions = output.confidence.reasons.filter((reason) => reason.endsWith("_defaulted"));
  const limitations = ["B06B_LEGACY_CALCULATOR_COMPATIBILITY_PROJECTION"];

  if (output.confidence.reasons.includes("soil_moisture_missing_or_invalid")) {
    limitations.push("SOIL_MOISTURE_MISSING_OR_INVALID");
  }
  if (assumptions.length > 0) {
    limitations.push("LEGACY_DEFAULTS_PRESERVED_AS_EXPLICIT_ASSUMPTIONS");
  }

  return baseProjection(
    context,
    "irrigation_requirement_skill_v1",
    [
      { key: "requirement_detected", value: output.requirement_detected, unit: null },
      { key: "net_irrigation_requirement_mm", value: output.net_irrigation_requirement_mm, unit: "mm" },
      { key: "gross_irrigation_requirement_mm", value: output.gross_irrigation_requirement_mm, unit: "mm" },
      { key: "rain_credit_mm", value: output.rain_credit_mm, unit: "mm" },
      { key: "et0_adjustment_mm", value: output.et0_adjustment_mm, unit: "mm" },
    ],
    assumptions,
    {
      level: uncertaintyFromConfidence(output.confidence.level),
      reasons: output.confidence.reasons,
    },
    limitations,
  );
}

export function projectIrrigationDeficitCalculationResultV1(
  output: IrrigationDeficitSkillOutputV1,
  context: IrrigationCalculationProjectionContextV1,
): CalculationResultV1 {
  return baseProjection(
    context,
    "irrigation_deficit_skill_v1",
    [
      { key: "deficit_detected", value: output.deficit_detected, unit: null },
      { key: "deficit_level", value: output.deficit_level, unit: null },
    ],
    [],
    {
      level: uncertaintyFromConfidence(output.confidence.level),
      reasons: output.confidence.reasons,
    },
    [
      "B06B_LEGACY_CALCULATOR_COMPATIBILITY_PROJECTION",
      "LEGACY_RECOMMENDED_AMOUNT_NOT_PROMOTED_TO_CALCULATION_RESULT",
    ],
  );
}
