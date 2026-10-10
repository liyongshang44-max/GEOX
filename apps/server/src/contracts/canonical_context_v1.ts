import { z } from "zod";

import { evidenceScopeV1Schema } from "./canonical_evidence_v1.js";

/**
 * B-05a contract vocabulary only.
 *
 * This module separates:
 * - declared context;
 * - observed evidence;
 * - derived crop-stage state.
 *
 * It does not activate a Context Authority runtime, does not bind MCFT, and
 * does not authorize legacy stage resolvers or compatibility defaults.
 */

export const contextAssertionKindV1Schema = z.enum([
  "CROP_IDENTITY",
  "CULTIVAR",
  "PLANTING_EVENT",
  "DECLARED_FIELD_PROGRAM",
  "MANAGEMENT_HISTORY",
  "CUSTOMER_GOAL",
]);

export const contextAssertionSourceClassV1Schema = z.enum([
  "CUSTOMER_DECLARATION",
  "OPERATOR_DECLARATION",
  "IMPORTED_DECLARATION",
  "COMPATIBILITY_LEGACY",
]);

export const contextAssertionValueV1Schema = z.union([
  z.string(),
  z.number().finite(),
  z.boolean(),
  z.null(),
  z.array(z.unknown()),
  z.record(z.unknown()),
]);

export const contextAssertionV1Schema = z
  .object({
    schema_version: z.literal("context_assertion_v1"),
    assertion_id: z.string().min(1),
    scope: evidenceScopeV1Schema,
    kind: contextAssertionKindV1Schema,
    value: contextAssertionValueV1Schema,
    source_ref: z.string().min(1),
    source_class: contextAssertionSourceClassV1Schema,
    asserted_at: z.string().datetime({ offset: true }),
    effective_at: z.string().datetime({ offset: true }).nullable(),
    limitations: z.array(z.string().min(1)),
    reason_codes: z.array(z.string().min(1)),
  })
  .strict();

export const contextSnapshotV1Schema = z
  .object({
    schema_version: z.literal("context_snapshot_v1"),
    snapshot_id: z.string().min(1),
    scope: evidenceScopeV1Schema,
    decision_time: z.string().datetime({ offset: true }).nullable(),
    assertions: z.array(contextAssertionV1Schema),
    limitations: z.array(z.string().min(1)),
    reason_codes: z.array(z.string().min(1)),
  })
  .strict();

/**
 * B-05a deliberately distinguishes representation from authority.
 *
 * COMPATIBILITY_NON_AUTHORITATIVE may carry a concrete stage for existing
 * product continuity, but it is never eligible as a future canonical decision
 * input. TWIN_QUALIFIED is a contract capability only; B-05a does not create a
 * runtime producer for it.
 */
export const cropStageAuthorityStateV1Schema = z.enum([
  "UNKNOWN",
  "COMPATIBILITY_NON_AUTHORITATIVE",
  "TWIN_QUALIFIED",
]);

export const cropStageSourceClassV1Schema = z.enum([
  "NONE",
  "DECLARED_STAGE_COMPATIBILITY",
  "DAP_CALCULATOR",
  "START_DATE_CALCULATOR",
  "CROP_SKILL_CALCULATOR",
  "TWIN_DERIVED_STATE",
]);

export const qualifiedCropStageStateV1Schema = z
  .object({
    schema_version: z.literal("qualified_crop_stage_state_v1"),
    state_id: z.string().min(1),
    scope: evidenceScopeV1Schema,
    stage: z.string().min(1).nullable(),
    authority_state: cropStageAuthorityStateV1Schema,
    source_class: cropStageSourceClassV1Schema,
    context_snapshot_ref: z.string().min(1).nullable(),
    evidence_qualification_refs: z.array(z.string().min(1)),
    derived_state_ref: z.string().min(1).nullable(),
    evaluated_at: z.string().datetime({ offset: true }),
    decision_time: z.string().datetime({ offset: true }).nullable(),
    decision_input_eligible: z.boolean(),
    limitations: z.array(z.string().min(1)),
    reason_codes: z.array(z.string().min(1)),
  })
  .strict()
  .superRefine((value, ctx) => {
    if (value.authority_state === "UNKNOWN") {
      if (value.stage !== null) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["stage"],
          message: "B05_UNKNOWN_CROP_STAGE_MUST_REMAIN_NULL",
        });
      }
      if (value.decision_input_eligible) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["decision_input_eligible"],
          message: "B05_UNKNOWN_CROP_STAGE_CANNOT_BE_DECISION_INPUT",
        });
      }
      if (value.source_class !== "NONE") {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["source_class"],
          message: "B05_UNKNOWN_CROP_STAGE_MUST_NOT_CLAIM_DERIVATION_SOURCE",
        });
      }
    }

    if (value.authority_state === "COMPATIBILITY_NON_AUTHORITATIVE") {
      if (value.stage === null) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["stage"],
          message: "B05_COMPATIBILITY_STAGE_REQUIRES_EXPLICIT_STAGE_VALUE",
        });
      }
      if (value.decision_input_eligible) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["decision_input_eligible"],
          message: "B05_COMPATIBILITY_STAGE_CANNOT_BECOME_CANONICAL_DECISION_INPUT",
        });
      }
      if (value.source_class === "NONE" || value.source_class === "TWIN_DERIVED_STATE") {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["source_class"],
          message: "B05_COMPATIBILITY_STAGE_REQUIRES_COMPATIBILITY_SOURCE_CLASS",
        });
      }
    }

    if (value.authority_state === "TWIN_QUALIFIED") {
      if (value.stage === null) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["stage"],
          message: "B05_TWIN_QUALIFIED_STAGE_REQUIRES_STAGE_VALUE",
        });
      }
      if (value.source_class !== "TWIN_DERIVED_STATE") {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["source_class"],
          message: "B05_TWIN_QUALIFIED_STAGE_REQUIRES_TWIN_DERIVED_SOURCE",
        });
      }
      if (value.derived_state_ref === null) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["derived_state_ref"],
          message: "B05_TWIN_QUALIFIED_STAGE_REQUIRES_DERIVED_STATE_REF",
        });
      }
      if (value.context_snapshot_ref === null) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["context_snapshot_ref"],
          message: "B05_TWIN_QUALIFIED_STAGE_REQUIRES_CONTEXT_SNAPSHOT_REF",
        });
      }
      if (!value.decision_input_eligible) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["decision_input_eligible"],
          message: "B05_TWIN_QUALIFIED_STAGE_MUST_DECLARE_DECISION_INPUT_ELIGIBILITY",
        });
      }
    }

    if (value.authority_state !== "TWIN_QUALIFIED" && value.derived_state_ref !== null) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["derived_state_ref"],
        message: "B05_NON_TWIN_STAGE_MUST_NOT_REFERENCE_AUTHORITATIVE_DERIVED_STATE",
      });
    }
  });

export type ContextAssertionKindV1 = z.infer<typeof contextAssertionKindV1Schema>;
export type ContextAssertionV1 = z.infer<typeof contextAssertionV1Schema>;
export type ContextSnapshotV1 = z.infer<typeof contextSnapshotV1Schema>;
export type CropStageAuthorityStateV1 = z.infer<typeof cropStageAuthorityStateV1Schema>;
export type QualifiedCropStageStateV1 = z.infer<typeof qualifiedCropStageStateV1Schema>;
