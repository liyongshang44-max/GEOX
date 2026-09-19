import { z } from "zod";

/**
 * B-09a migration-governance contracts.
 *
 * These objects classify replacement/shadow readiness and record shadow
 * comparisons. They do not remove authority or mutate legacy/canonical runtime.
 */

export const semanticReplacementStateV1Schema = z.enum([
  "REPLACEMENT_ESTABLISHED",
  "PARTIAL_REPLACEMENT",
  "UNREPLACED_EXTERNAL_DEPENDENCY",
  "REFERENCE_ONLY",
  "ORPHANED_NO_ACTIVE_CONSUMER",
]);

export const semanticShadowStateV1Schema = z.enum([
  "EXISTING_PARTIAL_SHADOW",
  "READY_FOR_SHADOW",
  "NOT_READY",
  "NOT_REQUIRED",
]);

export const semanticConsumerMigrationStateV1Schema = z.enum([
  "NOT_STARTED",
  "PARTIAL",
  "NOT_APPLICABLE",
]);

export const semanticAuthorityRemovalStateV1Schema = z.enum([
  "FORBIDDEN_PENDING_SHADOW",
  "FORBIDDEN_PARTIAL_REPLACEMENT",
  "FORBIDDEN_UNREPLACED",
  "PENDING_CONSUMER_MIGRATION",
  "NOT_APPLICABLE_REFERENCE_ONLY",
]);

export const semanticLegacyProducerDispositionV1Schema = z.enum([
  "SHADOW_COMPARE_REQUIRED",
  "FREEZE_NO_NEW_FEATURE",
  "REFERENCE_ONLY",
  "ORPHANED_FREEZE",
  "ROLE_RECLASSIFICATION_REQUIRED",
]);

export const semanticLegacyProducerDispositionRecordV1Schema = z
  .object({
    producer_id: z.string().min(1),
    path: z.string().min(1),
    disposition: semanticLegacyProducerDispositionV1Schema,
    reason_codes: z.array(z.string().min(1)),
  })
  .strict();

export const semanticMigrationFamilyReadinessV1Schema = z
  .object({
    semantic_id: z.string().min(1),
    canonical_replacement_refs: z.array(z.string().min(1)),
    replacement_state: semanticReplacementStateV1Schema,
    shadow_state: semanticShadowStateV1Schema,
    consumer_migration_state: semanticConsumerMigrationStateV1Schema,
    authority_removal_state: semanticAuthorityRemovalStateV1Schema,
    producer_dispositions: z.array(semanticLegacyProducerDispositionRecordV1Schema).min(1),
    reason_codes: z.array(z.string().min(1)),
    limitations: z.array(z.string().min(1)),
  })
  .strict();

export const semanticMigrationInventoryV1Schema = z
  .object({
    schema_version: z.literal("semantic_migration_inventory_v1"),
    phase: z.literal("B-09a"),
    base_product_head: z.string().regex(/^[0-9a-f]{40}$/),
    migration_phase_state: z.literal("INVENTORY_AND_SHADOW_PLANNING_ONLY"),
    authority_removal_performed: z.literal(false),
    real_mcft_adapter_state: z.literal("DISCONNECTED"),
    real_adr_runtime_state: z.literal("DISCONNECTED"),
    real_llm_provider_state: z.literal("DISCONNECTED"),
    families: z.array(semanticMigrationFamilyReadinessV1Schema).min(1),
  })
  .strict();

export const semanticShadowComparisonDimensionV1Schema = z.enum([
  "IDENTITY",
  "SCOPE",
  "VALUE",
  "VERDICT",
  "ACTION",
  "EVIDENCE_BASIS",
  "CONTEXT",
  "TIME",
  "AUTHORITY_CLASS",
]);

export const semanticShadowComparisonStateV1Schema = z.enum([
  "MATCH",
  "DIVERGENT",
  "INCOMPARABLE",
  "CANONICAL_MISSING",
  "LEGACY_MISSING",
]);

export const semanticShadowDivergenceV1Schema = z
  .object({
    dimension: semanticShadowComparisonDimensionV1Schema,
    code: z.string().min(1),
    legacy_ref: z.string().min(1).nullable(),
    canonical_ref: z.string().min(1).nullable(),
  })
  .strict();

export const semanticShadowComparisonV1Schema = z
  .object({
    schema_version: z.literal("semantic_shadow_comparison_v1"),
    comparison_id: z.string().min(1),
    semantic_id: z.string().min(1),
    legacy_producer_id: z.string().min(1),
    canonical_owner_ref: z.string().min(1),
    scope_ref: z.string().min(1).nullable(),
    decision_time: z.string().datetime({ offset: true }).nullable(),
    comparable_dimensions: z.array(semanticShadowComparisonDimensionV1Schema).min(1),
    comparison_state: semanticShadowComparisonStateV1Schema,
    divergences: z.array(semanticShadowDivergenceV1Schema),
    comparison_basis_refs: z.array(z.string().min(1)),
    limitations: z.array(z.string().min(1)),
    authority_removal_permitted: z.literal(false),
    authority_state: z.literal("SHADOW_ONLY"),
  })
  .strict();

export const evidenceSemanticShadowInventoryItemV1Schema = z
  .object({
    judge_id: z.string().min(1),
    comparison_id: z.string().min(1),
    comparison_state: semanticShadowComparisonStateV1Schema,
    decision_time: z.string().datetime({ offset: true }).nullable(),
    scope_ref: z.string().min(1).nullable(),
    divergence_codes: z.array(z.string().min(1)),
    comparison_basis_refs: z.array(z.string().min(1)),
    observed_at: z.string().datetime({ offset: true }),
    authority_state: z.literal("SHADOW_ONLY"),
    authority_removal_permitted: z.literal(false),
  })
  .strict();

export const evidenceSemanticShadowInventoryV1Schema = z
  .object({
    schema_version: z.literal("evidence_semantic_shadow_inventory_v1"),
    semantic_id: z.literal("evidence.qualification"),
    source: z.literal("JUDGE_RESULT_V2_PERSISTED_OUTPUTS"),
    scope: z
      .object({
        tenant_id: z.string().min(1),
        project_id: z.string().min(1),
        group_id: z.string().min(1),
        field_id: z.string().min(1).nullable(),
      })
      .strict(),
    observed_comparison_count: z.number().int().nonnegative(),
    unobserved_legacy_result_count: z.number().int().nonnegative(),
    malformed_comparison_count: z.number().int().nonnegative(),
    state_counts: z
      .object({
        MATCH: z.number().int().nonnegative(),
        DIVERGENT: z.number().int().nonnegative(),
        INCOMPARABLE: z.number().int().nonnegative(),
        CANONICAL_MISSING: z.number().int().nonnegative(),
        LEGACY_MISSING: z.number().int().nonnegative(),
      })
      .strict(),
    items: z.array(evidenceSemanticShadowInventoryItemV1Schema),
    limitations: z.array(z.string().min(1)),
    authority_state: z.literal("SHADOW_ONLY"),
    authority_removal_permitted: z.literal(false),
    consumer_migration_permitted: z.literal(false),
    removal_readiness: z.literal("NOT_AUTHORIZED_BY_INVENTORY"),
  })
  .strict();

export type SemanticMigrationInventoryV1 = z.infer<typeof semanticMigrationInventoryV1Schema>;
export type SemanticMigrationFamilyReadinessV1 = z.infer<typeof semanticMigrationFamilyReadinessV1Schema>;
export type SemanticShadowComparisonV1 = z.infer<typeof semanticShadowComparisonV1Schema>;
export type EvidenceSemanticShadowInventoryItemV1 = z.infer<typeof evidenceSemanticShadowInventoryItemV1Schema>;
export type EvidenceSemanticShadowInventoryV1 = z.infer<typeof evidenceSemanticShadowInventoryV1Schema>;
