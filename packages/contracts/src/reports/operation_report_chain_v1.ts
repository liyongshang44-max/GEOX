import { z } from "zod";

export const OperationReportChainStatusV1Schema = z.enum(["DONE", "AVAILABLE", "PENDING", "MISSING", "NOT_APPLICABLE"]);

export const OperationReportStatusChainItemV1Schema = z.object({
  key: z.string().min(1),
  label: z.string().min(1),
  status: OperationReportChainStatusV1Schema.or(z.string().min(1)),
  reason: z.string().nullable().optional(),
  source: z.string().nullable().optional(),
});

export const OperationReportRecommendationV1Schema = z.object({
  recommendation_id: z.string().nullable(),
  diagnosis_basis: z.unknown().nullable().optional(),
  agronomy_explain: z.unknown().nullable().optional(),
  reason_codes: z.array(z.string()),
  evidence_refs: z.array(z.unknown()),
  confidence: z.unknown().nullable().optional(),
  status: z.string().nullable().optional(),
}).nullable();

export const OperationReportPrescriptionV1Schema = z.object({
  prescription_id: z.string().nullable(),
  recommendation_id: z.string().nullable().optional(),
  operation_type: z.string().nullable().optional(),
  target_area: z.unknown().nullable().optional(),
  amount: z.unknown().nullable().optional(),
  unit: z.string().nullable().optional(),
  duration: z.unknown().nullable().optional(),
  time_window: z.unknown().nullable().optional(),
  acceptance_conditions: z.unknown().nullable().optional(),
  device_requirements: z.unknown().nullable().optional(),
  status: z.string().nullable().optional(),
}).nullable();

export const OperationReportApprovalChainV1Schema = z.object({
  approval_request_id: z.string().nullable(),
  status: z.string().nullable(),
  approver: z.unknown().nullable().optional(),
  approved_at: z.string().nullable().optional(),
  decision_note: z.string().nullable().optional(),
  approval_scope: z.unknown().nullable().optional(),
}).nullable();

export const OperationReportExecutionChainV1Schema = z.object({
  act_task_id: z.string().nullable(),
  dispatch_status: z.string().nullable().optional(),
  executor: z.object({ kind: z.string().nullable(), id: z.string().nullable().optional() }).nullable().optional(),
  device_id: z.string().nullable().optional(),
  execution_mode: z.string().nullable().optional(),
  receipt_id: z.string().nullable().optional(),
  receipt_status: z.string().nullable().optional(),
  as_executed: z.unknown().nullable().optional(),
}).nullable();

export const OperationReportEvidenceChainV1Schema = z.object({
  evidence_status: z.string(),
  evidence_ids: z.array(z.string()),
  export_job_id: z.string().nullable().optional(),
  sha256: z.string().nullable().optional(),
  trusted: z.boolean(),
});

export const OperationReportAcceptanceChainV1Schema = z.object({
  acceptance_id: z.string().nullable().optional(),
  verdict: z.string().nullable().optional(),
  evidence_sufficient: z.boolean().optional(),
  accepted_at: z.string().nullable().optional(),
  failure_reason: z.string().nullable().optional(),
}).nullable();

export const OperationReportChainExtensionV1Schema = z.object({
  operation_id: z.string().nullable().optional(),
  field: z.object({ field_id: z.string().nullable().optional(), field_name: z.string().nullable().optional() }).optional(),
  crop_context: z.object({ crop_code: z.string().nullable().optional(), crop_stage: z.string().nullable().optional(), season_id: z.string().nullable().optional() }).optional(),
  diagnosis: z.unknown().optional(),
  recommendation: OperationReportRecommendationV1Schema,
  prescription: OperationReportPrescriptionV1Schema,
  approval: OperationReportApprovalChainV1Schema,
  operation_plan: z.unknown().nullable().optional(),
  execution: OperationReportExecutionChainV1Schema,
  receipt: z.unknown().nullable().optional(),
  evidence: OperationReportEvidenceChainV1Schema,
  acceptance: OperationReportAcceptanceChainV1Schema,
  roi: z.unknown().nullable().optional(),
  field_memory: z.unknown().nullable().optional(),
  chain_integrity: z.enum(["COMPLETE", "LEGACY_OR_MANUAL"]),
  chain_flags: z.array(z.string()),
  missing_links: z.array(z.string()),
  legacy_warning: z.string().nullable().optional(),
  status_chain: z.array(OperationReportStatusChainItemV1Schema),
});

export type OperationReportChainStatusV1 = z.infer<typeof OperationReportChainStatusV1Schema>;
export type OperationReportStatusChainItemV1 = z.infer<typeof OperationReportStatusChainItemV1Schema>;
export type OperationReportChainExtensionV1 = z.infer<typeof OperationReportChainExtensionV1Schema>;
