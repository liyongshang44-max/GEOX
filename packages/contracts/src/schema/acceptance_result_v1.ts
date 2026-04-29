import { z } from "zod";

export const AcceptanceVerdictV1Schema = z.enum(["PASS", "FAIL", "PARTIAL"]);
export type AcceptanceVerdictV1 = z.infer<typeof AcceptanceVerdictV1Schema>;

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
  execution_judge_verdict: z.string().min(1).optional()
});

export type AcceptanceResultV1Payload = z.infer<typeof AcceptanceResultV1PayloadSchema>;
