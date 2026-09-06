import { z } from "zod";

import { evidenceScopeV1Schema } from "./canonical_evidence_v1.js";
import { decisionEligibilityCriterionV1Schema } from "./decision_eligibility_v1.js";

/**
 * B-09m contract vocabulary only.
 *
 * DecisionEligibilityPolicyDeclarationV1 declares the identity, scope,
 * applicability and required-criterion vocabulary for one future B-Line
 * Decision Eligibility policy.
 *
 * It does not evaluate a candidate, emit a criterion assessment, produce a
 * DecisionEligibilityDecisionV1, approve an action, or authorize execution.
 *
 * B-09m intentionally creates zero production declaration instances.
 */

export const decisionEligibilityPolicyDeclarationAuthorityV1Schema =
  z.literal("POLICY_DECLARATION_ONLY");

const policyIdentityTokenV1Schema = z
  .string()
  .min(1)
  .regex(/^[A-Za-z0-9._-]+$/);

export const decisionEligibilityPolicyDeclarationScopeV1Schema = z
  .object({
    decision_scope: evidenceScopeV1Schema,
    scope_anchor_type: z.string().min(1),
    scope_anchor_ref: z.string().min(1),
  })
  .strict()
  .superRefine((value, ctx) => {
    for (const key of ["tenant_id", "project_id", "group_id"] as const) {
      if (!String(value.decision_scope[key] ?? "").trim()) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["decision_scope", key],
          message: "B09M_POLICY_SCOPE_REQUIRES_TENANT_PROJECT_GROUP",
        });
      }
    }
  });

export const decisionEligibilityPolicyDeclarationV1Schema = z
  .object({
    schema_version: z.literal("decision_eligibility_policy_declaration_v1"),
    declaration_id: z.string().min(1),
    policy_id: policyIdentityTokenV1Schema,
    policy_version: policyIdentityTokenV1Schema,
    policy_ref: z.string().min(1),
    scope: decisionEligibilityPolicyDeclarationScopeV1Schema,
    applicable_action_types: z.array(z.string().min(1)).min(1),
    required_criteria: z.array(decisionEligibilityCriterionV1Schema).min(1),
    lifecycle_semantics: z.literal("B07D_LIFECYCLE_STATE_V1"),
    declaration_source_type: z.string().min(1),
    declaration_source_ref: z.string().min(1),
    provenance_refs: z.array(z.string().min(1)).min(1),
    declared_at: z.string().datetime({ offset: true }),
    effective_from: z.string().datetime({ offset: true }),
    effective_until: z.string().datetime({ offset: true }).nullable(),
    supersedes_policy_ref: z.string().min(1).nullable(),
    limitations: z.array(z.string().min(1)),
    authority_state: decisionEligibilityPolicyDeclarationAuthorityV1Schema,
  })
  .strict()
  .superRefine((value, ctx) => {
    const expectedDeclarationId =
      "decision_eligibility_policy_declaration_v1:"
      + value.policy_id
      + ":"
      + value.policy_version;
    if (value.declaration_id !== expectedDeclarationId) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["declaration_id"],
        message: "B09M_DECLARATION_ID_MUST_ENCODE_POLICY_ID_AND_VERSION",
      });
    }

    const expectedPolicyRef =
      "decision_eligibility_policy_v1:"
      + value.policy_id
      + ":"
      + value.policy_version;
    if (value.policy_ref !== expectedPolicyRef) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["policy_ref"],
        message: "B09M_POLICY_REF_MUST_ENCODE_POLICY_ID_AND_VERSION",
      });
    }

    const trimmedActions = value.applicable_action_types.map((action) => action.trim());
    if (trimmedActions.some((action, index) => action !== value.applicable_action_types[index])) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["applicable_action_types"],
        message: "B09M_ACTION_TYPES_MUST_BE_CANONICALLY_TRIMMED",
      });
    }
    if (new Set(trimmedActions).size !== trimmedActions.length) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["applicable_action_types"],
        message: "B09M_ACTION_TYPES_MUST_BE_UNIQUE",
      });
    }

    if (new Set(value.required_criteria).size !== value.required_criteria.length) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["required_criteria"],
        message: "B09M_REQUIRED_CRITERIA_MUST_BE_UNIQUE",
      });
    }

    const declaredAt = Date.parse(value.declared_at);
    const effectiveFrom = Date.parse(value.effective_from);
    const effectiveUntil = value.effective_until === null
      ? null
      : Date.parse(value.effective_until);
    if (declaredAt > effectiveFrom) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["effective_from"],
        message: "B09M_POLICY_CANNOT_BECOME_EFFECTIVE_BEFORE_DECLARATION",
      });
    }
    if (effectiveUntil !== null && effectiveUntil <= effectiveFrom) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["effective_until"],
        message: "B09M_POLICY_EFFECTIVE_WINDOW_INVALID",
      });
    }

    if (
      value.supersedes_policy_ref !== null
      && value.supersedes_policy_ref === value.policy_ref
    ) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["supersedes_policy_ref"],
        message: "B09M_POLICY_CANNOT_SUPERSEDE_ITSELF",
      });
    }
  });

export type DecisionEligibilityPolicyDeclarationScopeV1 = z.infer<
  typeof decisionEligibilityPolicyDeclarationScopeV1Schema
>;

export type DecisionEligibilityPolicyDeclarationV1 = z.infer<
  typeof decisionEligibilityPolicyDeclarationV1Schema
>;
