import { z } from "zod";

/**
 * Receipt minimum contract (irrigation scenario baseline)
 *
 * Main ingress: /api/v1/actions/receipt
 * - This is an execution receipt technical contract.
 * - It is not acceptance and not final_status semantics.
 * - Simulator and future executor share this same contract layer.
 *
 * Frozen meta semantics:
 * - command_id comes from meta.command_id
 * - idempotency_key comes from meta.idempotency_key
 */
export const actionReceiptRequestSchemaV1 = z.object({
  tenant_id: z.string().min(1),
  project_id: z.string().min(1),
  group_id: z.string().min(1),
  operation_plan_id: z.string().min(1),
  act_task_id: z.string().min(1),
  executor_id: z.object({ kind: z.enum(["human", "script", "device"]), id: z.string().min(1), namespace: z.string().min(1) }),
  execution_time: z.object({ start_ts: z.number(), end_ts: z.number() }),
  execution_coverage: z.object({ kind: z.enum(["area", "path", "field"]), ref: z.string().min(1) }),
  resource_usage: z.object({
    fuel_l: z.number().nullable(),
    electric_kwh: z.number().nullable(),
    water_l: z.number().nullable(),
    chemical_ml: z.number().nullable(),
  }),
  logs_refs: z.array(z.object({ kind: z.string().min(1), ref: z.string().min(1) })).min(1),
  status: z.enum(["executed", "not_executed"]).optional(),
  constraint_check: z.object({ violated: z.boolean(), violations: z.array(z.string()) }),
  observed_parameters: z.record(z.union([z.number(), z.boolean(), z.string()])),
  device_refs: z
    .array(
      z.object({
        kind: z.literal("device_ref_fact"),
        ref: z.string().min(8),
        note: z.string().max(280).optional().nullable(),
      }),
    )
    .optional(),
  meta: z.record(z.any()).optional(),
});

export type ActionReceiptRequestV1 = z.infer<typeof actionReceiptRequestSchemaV1>;

export function validateActionReceiptMetaV1(metaInput: unknown, actTaskId: string): { commandId: string; idempotencyKey: string; error: null } | { error: "IDEMPOTENCY_KEY_REQUIRED" | "MISSING_COMMAND_ID" | "COMMAND_TASK_ID_MISMATCH" } {
  const meta = (metaInput && typeof metaInput === "object") ? (metaInput as Record<string, unknown>) : {};
  const idempotencyKey = String(meta.idempotency_key ?? "").trim();
  if (!idempotencyKey) return { error: "IDEMPOTENCY_KEY_REQUIRED" };

  const commandId = String(meta.command_id ?? "").trim();
  if (!commandId) return { error: "MISSING_COMMAND_ID" };
  if (commandId !== actTaskId) return { error: "COMMAND_TASK_ID_MISMATCH" };

  return { error: null, commandId, idempotencyKey };
}
