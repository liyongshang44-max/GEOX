import { z } from "zod";

export const AcceptanceVerdictV1Schema = z.enum(["PASS", "FAIL", "PARTIAL", "NEEDS_REVIEW", "INSUFFICIENT_EVIDENCE"]);
export type AcceptanceVerdictV1 = z.infer<typeof AcceptanceVerdictV1Schema>;

export const AcceptanceSourceLaneV1Schema = z.enum(["FORMAL_OPERATION", "SIMULATED_DEV_ONLY", "DEBUG_ONLY", "UNKNOWN"]);
export type AcceptanceSourceLaneV1 = z.infer<typeof AcceptanceSourceLaneV1Schema>;

export const AcceptanceMetricsV1Schema = z.object({
  coverage_ratio: z.number().finite(),
  in_field_ratio: z.number().finite(),
  telemetry_delta: z.number().finite(),

  // Step9 Variable Acceptance V1 metrics.
  // Optional to preserve compatibility with ordinary acceptance results.
  zone_application_count: z.number().finite().optional(),
  zone_completion_rate: z.number().finite().optional(),
  avg_zone_coverage_percent: z.number().finite().optional(),
  max_zone_deviation_percent: z.number().finite().optional()
});
export type AcceptanceMetricsV1 = z.infer<typeof AcceptanceMetricsV1Schema>;

export const AcceptanceFormalGateV1Schema = z.object({
  formal_evidence_passed: z.boolean(),
  formal_execution_passed: z.boolean(),
  non_simulated_chain: z.boolean(),
  chain_validation_passed: z.boolean().optional(),
  trust_level: z.enum(["FORMAL_ACCEPTED", "NEEDS_REVIEW", "INSUFFICIENT_FORMAL_EVIDENCE", "SIMULATED_DEV_ONLY"]).optional(),
  source_lane: AcceptanceSourceLaneV1Schema.optional(),
  is_simulated: z.boolean().optional(),
  blocking_reasons: z.array(z.string().min(1)).optional(),
  customer_visible_eligible: z.boolean().optional()
});
export type AcceptanceFormalGateV1 = z.infer<typeof AcceptanceFormalGateV1Schema>;

export const AcceptanceResultV1PayloadSchema = z.object({
  acceptance_id: z.string().min(1),
  act_task_id: z.string().min(1),
  field_id: z.string().min(1),
  verdict: AcceptanceVerdictV1Schema,
  metrics: AcceptanceMetricsV1Schema,
  evidence_refs: z.array(z.string().min(1)),
  evaluated_at: z.string().min(1),
  tenant_id: z.string().min(1).optional(),
  project_id: z.string().min(1).optional(),
  group_id: z.string().min(1).optional(),
  program_id: z.string().min(1).optional(),
  operation_plan_id: z.string().min(1).optional(),
  trace_id: z.string().min(1).optional(),
  rule_id: z.string().min(1).optional(),
  explanation_codes: z.array(z.string().min(1)).optional(),
  acceptance_skill_id: z.string().min(1).optional(),
  acceptance_skill_version: z.string().min(1).optional(),
  input_digest: z.string().min(1).optional(),
  output_digest: z.string().min(1).optional(),
  execution_judge_id: z.string().min(1).optional(),
  execution_judge_verdict: z.string().min(1).optional(),

  /** Base Contract v2 formal acceptance gate metadata. */
  formal_gate: AcceptanceFormalGateV1Schema.optional(),
  formal_acceptance: z.boolean().optional(),
  formal_evidence_passed: z.boolean().optional(),
  non_simulated_chain: z.boolean().optional(),
  formal_execution_passed: z.boolean().optional(),
  source_lane: AcceptanceSourceLaneV1Schema.optional(),
  is_simulated: z.boolean().optional(),
  blocking_reasons: z.array(z.string().min(1)).optional(),
  customer_visible_eligible: z.boolean().optional(),
  trust_level: z.string().min(1).optional()
}).extend({
  variable_operation: z.boolean().optional(),
  operation_rollup_policy: z.string().min(1).optional(),
  zone_results: z.array(z.any()).optional(),
  zone_matrix: z.array(z.any()).optional(),
  failed_required_zones: z.array(z.string().min(1)).optional(),
  as_executed_id: z.string().min(1).optional(),
  as_applied_id: z.string().min(1).optional(),
  receipt_id: z.string().min(1).optional(),
});

export type AcceptanceResultV1Payload = z.infer<typeof AcceptanceResultV1PayloadSchema>;
