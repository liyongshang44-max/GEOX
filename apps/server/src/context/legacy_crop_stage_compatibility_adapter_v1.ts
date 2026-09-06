import type { EvidenceScopeV1 } from "../contracts/canonical_evidence_v1.js";
import {
  qualifiedCropStageStateV1Schema,
  type QualifiedCropStageStateV1,
} from "../contracts/canonical_context_v1.js";
import { resolveCropStage } from "../domain/agronomy/stage_resolver.js";

export type LegacyCropStageCompatibilityInputV1 = {
  state_id: string;
  scope: EvidenceScopeV1;
  crop_code: string;
  explicit_stage?: string | null;
  days_after_planting?: number | null;
  start_date?: string | number | Date;
  evaluated_at: string;
  decision_time?: string | null;
  context_snapshot_ref?: string | null;
};

function normalize(value: unknown): string {
  return String(value ?? "").trim().toLowerCase();
}

function toMs(value: string | number | Date): number | null {
  if (typeof value === "number") {
    return Number.isFinite(value) ? value : null;
  }
  if (value instanceof Date) {
    const ms = value.getTime();
    return Number.isFinite(ms) ? ms : null;
  }
  const ms = Date.parse(String(value));
  return Number.isFinite(ms) ? ms : null;
}

function unknownStage(
  input: LegacyCropStageCompatibilityInputV1,
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
      "B05C_LEGACY_STAGE_ADAPTER_COMPATIBILITY_ONLY",
      "CANONICAL_TWIN_STAGE_AUTHORITY_NOT_ESTABLISHED",
      "UNKNOWN_MUST_REMAIN_UNKNOWN",
    ],
    reason_codes: [reasonCode],
  });
}

function compatibilityStage(
  input: LegacyCropStageCompatibilityInputV1,
  stage: string,
  sourceClass:
    | "DECLARED_STAGE_COMPATIBILITY"
    | "DAP_CALCULATOR"
    | "START_DATE_CALCULATOR",
  reasonCode: string,
): QualifiedCropStageStateV1 {
  return qualifiedCropStageStateV1Schema.parse({
    schema_version: "qualified_crop_stage_state_v1",
    state_id: input.state_id,
    scope: input.scope,
    stage,
    authority_state: "COMPATIBILITY_NON_AUTHORITATIVE",
    source_class: sourceClass,
    context_snapshot_ref: input.context_snapshot_ref ?? null,
    evidence_qualification_refs: [],
    derived_state_ref: null,
    evaluated_at: input.evaluated_at,
    decision_time: input.decision_time ?? null,
    decision_input_eligible: false,
    limitations: [
      "B05C_LEGACY_STAGE_ADAPTER_COMPATIBILITY_ONLY",
      "CANONICAL_TWIN_STAGE_AUTHORITY_NOT_ESTABLISHED",
    ],
    reason_codes: [reasonCode],
  });
}

/**
 * B-05c compatibility adapter only.
 *
 * This function never creates TWIN_QUALIFIED stage authority and never marks a
 * legacy resolver result as canonical decision-input eligible.
 *
 * It deliberately validates legacy convenience inputs before calling the
 * historical resolver so malformed/future values cannot be normalized into a
 * concrete stage in the canonical representation.
 */
export function projectLegacyCropStageCompatibilityV1(
  input: LegacyCropStageCompatibilityInputV1,
): QualifiedCropStageStateV1 {
  const evaluatedAtMs = Date.parse(input.evaluated_at);
  if (!Number.isFinite(evaluatedAtMs)) {
    throw new Error("B05C_EVALUATED_AT_INVALID");
  }

  const cropCode = normalize(input.crop_code);
  if (!cropCode) {
    return unknownStage(input, "B05C_CROP_CODE_MISSING");
  }

  const explicitStage = normalize(input.explicit_stage);
  if (explicitStage) {
    const explicitResolved = resolveCropStage({
      cropCode,
      explicitStage,
      now: evaluatedAtMs,
    });
    if (explicitResolved !== "unknown") {
      return compatibilityStage(
        input,
        explicitResolved,
        "DECLARED_STAGE_COMPATIBILITY",
        "B05C_DECLARED_STAGE_COMPATIBILITY",
      );
    }
  }

  if (input.days_after_planting !== undefined && input.days_after_planting !== null) {
    const dap = Number(input.days_after_planting);
    if (!Number.isFinite(dap)) {
      return unknownStage(input, "B05C_DAP_INVALID");
    }
    if (dap < 0) {
      return unknownStage(input, "B05C_NEGATIVE_DAP_REJECTED");
    }

    const dapResolved = resolveCropStage({
      cropCode,
      daysAfterPlanting: dap,
      now: evaluatedAtMs,
    });
    if (dapResolved === "unknown") {
      return unknownStage(input, "B05C_LEGACY_RESOLVER_UNKNOWN");
    }

    return compatibilityStage(
      input,
      dapResolved,
      "DAP_CALCULATOR",
      "B05C_DAP_CALCULATOR_COMPATIBILITY",
    );
  }

  if (input.start_date !== undefined) {
    const startMs = toMs(input.start_date);
    if (startMs === null) {
      return unknownStage(input, "B05C_INVALID_START_DATE_REJECTED");
    }
    if (startMs > evaluatedAtMs) {
      return unknownStage(input, "B05C_FUTURE_START_DATE_REJECTED");
    }

    const startResolved = resolveCropStage({
      cropCode,
      startDate: startMs,
      now: evaluatedAtMs,
    });
    if (startResolved === "unknown") {
      return unknownStage(input, "B05C_LEGACY_RESOLVER_UNKNOWN");
    }

    return compatibilityStage(
      input,
      startResolved,
      "START_DATE_CALCULATOR",
      "B05C_START_DATE_CALCULATOR_COMPATIBILITY",
    );
  }

  return unknownStage(
    input,
    explicitStage
      ? "B05C_EXPLICIT_STAGE_NOT_ACCEPTED"
      : "B05C_STAGE_INPUT_MISSING",
  );
}
