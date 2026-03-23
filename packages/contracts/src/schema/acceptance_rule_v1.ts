import { z } from "zod";

export const AcceptanceRuleV1PayloadSchema = z.object({
  rule_id: z.string().min(1),
  task_type: z.string().min(1),
  policy_version: z.string().min(1),
  required_metrics: z.array(z.string().min(1)),
  thresholds: z.record(z.number().finite())
});

export const AcceptanceRuleV1Schema = z.object({
  type: z.literal("acceptance_rule_v1"),
  payload: AcceptanceRuleV1PayloadSchema
});

export type AcceptanceRuleV1Payload = z.infer<typeof AcceptanceRuleV1PayloadSchema>;
export type AcceptanceRuleV1 = z.infer<typeof AcceptanceRuleV1Schema>;
