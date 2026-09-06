import { z } from "zod";

import {
  candidateDecisionV1Schema,
} from "./canonical_decision_v1.js";
import {
  evidenceScopeV1Schema,
} from "./canonical_evidence_v1.js";

/**
 * B-08b typed integration contracts only.
 *
 * These contracts freeze authority/reference seams for future MCFT / ADR / LLM
 * integration without connecting any real adapter, runtime, or provider.
 *
 * Reasoning is not authority. Decision-producer ports may return only
 * CandidateDecisionV1 semantics.
 */

export const authorityInputPortKindV1Schema = z.enum([
  "GOVERNED_EVIDENCE",
  "CONTEXT_AUTHORITY",
  "TWIN_DECISION_INPUT",
  "KNOWLEDGE_CLAIM_INPUT",
]);

export const decisionProducerPortKindV1Schema = z.enum([
  "DETERMINISTIC_CALCULATOR",
  "HUMAN_REASONING",
  "LLM_REASONING",
]);

export const governedEvidencePortOutputV1Schema = z
  .object({
    schema_version: z.literal("governed_evidence_port_output_v1"),
    port_kind: z.literal("GOVERNED_EVIDENCE"),
    scope: evidenceScopeV1Schema,
    decision_time: z.string().datetime({ offset: true }),
    evidence_qualification_refs: z.array(z.string().min(1)),
    limitations: z.array(z.string().min(1)),
    authority_state: z.literal("REFERENCE_ONLY"),
  })
  .strict();

export const contextAuthorityPortOutputV1Schema = z
  .object({
    schema_version: z.literal("context_authority_port_output_v1"),
    port_kind: z.literal("CONTEXT_AUTHORITY"),
    scope: evidenceScopeV1Schema,
    decision_time: z.string().datetime({ offset: true }),
    context_snapshot_ref: z.string().min(1).nullable(),
    crop_stage_state_ref: z.string().min(1).nullable(),
    limitations: z.array(z.string().min(1)),
    authority_state: z.literal("REFERENCE_ONLY"),
  })
  .strict();

export const twinDecisionInputPortOutputV1Schema = z
  .object({
    schema_version: z.literal("twin_decision_input_port_output_v1"),
    port_kind: z.literal("TWIN_DECISION_INPUT"),
    scope: evidenceScopeV1Schema,
    decision_time: z.string().datetime({ offset: true }),
    state_refs: z.array(z.string().min(1)),
    forecast_refs: z.array(z.string().min(1)),
    scenario_refs: z.array(z.string().min(1)),
    limitations: z.array(z.string().min(1)),
    authority_state: z.literal("REFERENCE_ONLY"),
  })
  .strict();

export const knowledgeClaimInputPortOutputV1Schema = z
  .object({
    schema_version: z.literal("knowledge_claim_input_port_output_v1"),
    port_kind: z.literal("KNOWLEDGE_CLAIM_INPUT"),
    scope: evidenceScopeV1Schema,
    decision_time: z.string().datetime({ offset: true }),
    knowledge_claim_refs: z.array(z.string().min(1)),
    policy_refs: z.array(z.string().min(1)),
    limitations: z.array(z.string().min(1)),
    authority_state: z.literal("REFERENCE_ONLY"),
  })
  .strict();

export const decisionProducerPortOutputV1Schema = z
  .object({
    schema_version: z.literal("decision_producer_port_output_v1"),
    port_kind: decisionProducerPortKindV1Schema,
    candidate: candidateDecisionV1Schema,
    reasoning_trace_refs: z.array(z.string().min(1)),
    limitations: z.array(z.string().min(1)),
    authority_state: z.literal("CANDIDATE_ONLY"),
  })
  .strict();

export const futureDecisionIntegrationTargetV1Schema = z.enum([
  "MCFT",
  "ADR",
  "LLM",
]);

export const futureDecisionIntegrationBindingV1Schema = z
  .object({
    schema_version: z.literal("future_decision_integration_binding_v1"),
    integration_target: futureDecisionIntegrationTargetV1Schema,
    port_kind: z.enum([
      "TWIN_DECISION_INPUT",
      "KNOWLEDGE_CLAIM_INPUT",
      "LLM_REASONING",
    ]),
    binding_state: z.literal("DISCONNECTED"),
    adapter_ref: z.null(),
    provider_ref: z.null(),
    runtime_edge: z.literal("INTENTIONAL_NONE"),
    limitations: z.array(z.string().min(1)),
  })
  .strict()
  .superRefine((value, ctx) => {
    const expected = {
      MCFT: "TWIN_DECISION_INPUT",
      ADR: "KNOWLEDGE_CLAIM_INPUT",
      LLM: "LLM_REASONING",
    } as const;

    if (value.port_kind !== expected[value.integration_target]) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["port_kind"],
        message: "B08B_INTEGRATION_TARGET_PORT_KIND_MISMATCH",
      });
    }
  });

export type AuthorityInputPortKindV1 = z.infer<typeof authorityInputPortKindV1Schema>;
export type DecisionProducerPortKindV1 = z.infer<typeof decisionProducerPortKindV1Schema>;
export type GovernedEvidencePortOutputV1 = z.infer<typeof governedEvidencePortOutputV1Schema>;
export type ContextAuthorityPortOutputV1 = z.infer<typeof contextAuthorityPortOutputV1Schema>;
export type TwinDecisionInputPortOutputV1 = z.infer<typeof twinDecisionInputPortOutputV1Schema>;
export type KnowledgeClaimInputPortOutputV1 = z.infer<typeof knowledgeClaimInputPortOutputV1Schema>;
export type DecisionProducerPortOutputV1 = z.infer<typeof decisionProducerPortOutputV1Schema>;
export type FutureDecisionIntegrationBindingV1 = z.infer<typeof futureDecisionIntegrationBindingV1Schema>;
