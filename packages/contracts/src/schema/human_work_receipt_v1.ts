import { z } from "zod";
import type { AoActReceiptV1 } from "./ao_act_receipt_v1";

export const HumanWorkReceiptExceptionTypeValuesV1 = [
  "NONE",
  "WEATHER",
  "MACHINE",
  "MATERIAL_SHORTAGE",
  "SAFETY",
  "FIELD_BLOCKED",
  "OTHER",
] as const;

export type HumanWorkReceiptExceptionTypeV1 = (typeof HumanWorkReceiptExceptionTypeValuesV1)[number];

const NonEmptyText = z.string().trim().min(1);

const HumanWorkReceiptEvidenceRefV1Schema = z.object({
  artifact_id: z.string().trim().min(1).max(128).optional(),
  object_key: z.string().trim().min(1).max(512).optional(),
  filename: z.string().max(255).optional(),
  category: z.enum(["before", "during", "after", "anomaly", "other"]).optional(),
  mime_type: z.string().max(128).optional(),
  size_bytes: z.number().finite().nonnegative().max(1024 * 1024 * 1024).optional(),
  captured_at_ts: z.number().finite().nonnegative().max(99_999_999_999_999).optional(),
}).superRefine((value, ctx) => {
  if (!value.artifact_id && !value.object_key) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["artifact_id"],
      message: "artifact_id or object_key is required",
    });
  }
});

const HumanWorkReceiptLogRefV1Schema = z.union([
  z.string().trim().min(1),
  z.object({ kind: NonEmptyText.max(64), ref: NonEmptyText.max(512) }),
]);

export const HumanWorkReceiptV1Schema = z.object({
  type: z.literal("human_work_receipt_v1"),
  payload: z.object({
    assignment_id: NonEmptyText.max(128),
    act_task_id: NonEmptyText.max(128),
    operation_plan_id: NonEmptyText.max(128),
    status: z.enum(["executed", "not_executed"]),
    execution_time: z.object({
      start_ts: z.number().finite().nonnegative(),
      end_ts: z.number().finite().nonnegative(),
    }).refine((x) => x.start_ts <= x.end_ts, {
      message: "execution_time.start_ts must be <= execution_time.end_ts",
      path: ["start_ts"],
    }),
    execution_coverage: z.object({
      kind: z.enum(["field", "point", "manual"]),
      ref: NonEmptyText.max(256),
    }),
    labor: z.object({
      duration_minutes: z.number().finite().int().min(1).max(24 * 60),
      worker_count: z.number().finite().int().min(1).max(2000),
    }),
    resource_usage: z.object({
      fuel_l: z.number().finite().nonnegative().max(1_000_000).optional(),
      electric_kwh: z.number().finite().nonnegative().max(1_000_000).optional(),
      water_l: z.number().finite().nonnegative().max(1_000_000).optional(),
      chemical_ml: z.number().finite().nonnegative().max(1_000_000).optional(),
      consumables: z.array(z.object({
        name: NonEmptyText.max(64),
        amount: z.number().finite().nonnegative().max(1_000_000),
        unit: z.string().trim().max(16).optional(),
      })).max(32).optional(),
    }).default({}).refine((value) => {
      const hasNumeric = value.fuel_l != null || value.electric_kwh != null || value.water_l != null || value.chemical_ml != null;
      const hasConsumables = Array.isArray(value.consumables) && value.consumables.length > 0;
      return hasNumeric || hasConsumables;
    }, {
      message: "resource_usage requires at least one numeric field or consumables",
      path: ["consumables"],
    }),
    exception: z.object({
      type: z.enum(HumanWorkReceiptExceptionTypeValuesV1),
      code: z.string().trim().min(1).max(64).optional(),
      detail: z.string().max(2000).optional(),
    }).default({ type: "NONE" }).superRefine((value, ctx) => {
      if (value.type !== "NONE" && !value.code) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["code"],
          message: "exception.code is required when exception.type is not NONE",
        });
      }
    }),
    location_summary: z.object({
      center: z.object({ lat: z.number().gte(-90).lte(90), lon: z.number().gte(-180).lte(180) }).optional(),
      path_points: z.number().finite().nonnegative().max(1_000_000).optional(),
      distance_m: z.number().finite().nonnegative().max(10_000_000).optional(),
      geohash: z.string().trim().min(1).max(32).optional(),
      remark: z.string().max(512).optional(),
    }).optional(),
    evidence_meta: z.array(HumanWorkReceiptEvidenceRefV1Schema).max(50).default([]),
    logs_refs: z.array(HumanWorkReceiptLogRefV1Schema).max(50).default([]),
    observed_parameters: z.record(z.unknown()).optional(),
    meta: z.record(z.unknown()).optional(),
  }).superRefine((value, ctx) => {
    const hasEvidenceMeta = Array.isArray(value.evidence_meta) && value.evidence_meta.length > 0;
    const hasLogsRefs = Array.isArray(value.logs_refs) && value.logs_refs.length > 0;
    if (!hasEvidenceMeta && !hasLogsRefs) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["evidence_meta"],
        message: "at least one evidence reference is required",
      });
    }
  }),
});

export type HumanWorkReceiptEvidenceRefV1 = z.infer<typeof HumanWorkReceiptEvidenceRefV1Schema>;
export type HumanWorkReceiptV1 = z.infer<typeof HumanWorkReceiptV1Schema>;

export function mapHumanWorkReceiptToAoActReceiptV1(input: HumanWorkReceiptV1): AoActReceiptV1 {
  const payload = input.payload;
  return {
    type: "ao_act_receipt_v1",
    payload: {
      act_task_id: payload.act_task_id,
      executor_id: { kind: "human", id: "human_executor_v1" },
      status: payload.status,
      execution_time: payload.execution_time,
      execution_coverage: payload.execution_coverage,
      resource_usage: payload.resource_usage,
      logs_refs: (payload.logs_refs ?? []).map((item) => (
        typeof item === "string" ? { kind: "manual_ref", ref: item } : { kind: item.kind, ref: item.ref }
      )),
      evidence_refs: (payload.evidence_meta ?? []).map((item) => {
        if (item.object_key) return `obj:${item.object_key}`;
        if (item.artifact_id) return `artifact:${item.artifact_id}`;
        return item.filename ?? "";
      }).filter(Boolean),
      evidence_artifact_ids: (payload.evidence_meta ?? [])
        .map((item) => item.artifact_id)
        .filter((v): v is string => typeof v === "string" && v.length > 0),
      constraint_check: {
        violated: payload.exception?.type != null && payload.exception.type !== "NONE",
        summary: payload.exception?.code ?? payload.exception?.type ?? "NONE",
      },
      observed_parameters: {
        ...(payload.observed_parameters ?? {}),
        labor: payload.labor,
        exception: payload.exception ?? null,
        location_summary: payload.location_summary ?? null,
        evidence_meta: payload.evidence_meta ?? [],
      },
    },
  };
}
