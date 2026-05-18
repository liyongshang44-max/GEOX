export type SamplingReasonV1 =
  | "LOW_CONFIDENCE"
  | "NUTRIENT_CHECK"
  | "SOIL_MOISTURE_VALIDATION"
  | "MODEL_GAP"
  | "MANUAL_REQUEST";
export type SamplingSampleTypeV1 = "SOIL" | "TISSUE" | "WATER";
export const SAMPLING_REASONS_V1 = [
  "LOW_CONFIDENCE",
  "NUTRIENT_CHECK",
  "SOIL_MOISTURE_VALIDATION",
  "MODEL_GAP",
  "MANUAL_REQUEST",
] as const;
export type SamplingEvidenceRefV1 = { kind: string; ref_id: string };
export type SamplingFactEnvelopeV1<TType extends string, TPayload> = { type: TType; payload: TPayload };
export type SamplingPlanV1 = { plan_id: string; tenant_id: string; project_id: string; group_id: string; field_id: string; zone_id?: string | null; reason: SamplingReasonV1; sample_type: SamplingSampleTypeV1; required_depth_cm?: number | null; required_points: number; created_at_ts: number; evidence_refs: Array<SamplingEvidenceRefV1> };
export type SamplingReceiptEvidenceRefV1 = { kind: "raw_sample_v1" | "marker_v1" | "import_run_v1" | "fact_id"; ref_id: string };
export type SampleReceiptV1 = { sample_id: string; plan_id: string; tenant_id: string; project_id: string; group_id: string; field_id: string; zone_id?: string | null; collected_at_ts: number; collector_actor_id: string; sample_type: SamplingSampleTypeV1; depth_cm?: number | null; location_ref?: string | null; barcode?: string | null; evidence_refs: Array<SamplingReceiptEvidenceRefV1>; chain_of_custody_status: "RECORDED" | "MISSING" | "BROKEN" };
export type LabResultImportV1 = { import_id: string; sample_id: string; imported_at_ts: number; lab_name?: string | null; metrics: Record<string, number | string | null>; units: Record<string, string>; evidence_refs: Array<SamplingEvidenceRefV1>; quality_status: "PASS" | "NEEDS_REVIEW" | "INVALID" };
export type SamplingAcceptanceV1 = { acceptance_id: string; plan_id: string; sample_id: string; import_id?: string | null; tenant_id: string; project_id: string; group_id: string; verdict: "PASS" | "FAIL" | "INSUFFICIENT_EVIDENCE"; reasons: string[]; evaluated_at_ts: number; evidence_refs: Array<SamplingEvidenceRefV1> };
export type SamplingPlanFactV1 = SamplingFactEnvelopeV1<"sampling_plan_v1", SamplingPlanV1>;
export type SampleReceiptFactV1 = SamplingFactEnvelopeV1<"sample_receipt_v1", SampleReceiptV1>;
export type LabResultImportFactV1 = SamplingFactEnvelopeV1<"lab_result_import_v1", LabResultImportV1>;
export type SamplingAcceptanceFactV1 = SamplingFactEnvelopeV1<"sampling_acceptance_v1", SamplingAcceptanceV1>;
export type SamplingAcceptanceEvaluateRequestV1 = { plan_id: string; sample_id: string; import_id?: string };
export type SamplingAcceptanceEvaluateResponseV1 = { ok: true; acceptance_id: string; fact_id: string; verdict: "PASS" | "FAIL" | "INSUFFICIENT_EVIDENCE"; reasons: string[] };
export const SAMPLING_DOMAIN_HARD_RULES_V1 = {
  sample_receipt_created_not_lab_result_valid: "sample_receipt created ≠ lab result valid",
  lab_result_imported_not_agronomy_recommendation: "lab_result_imported ≠ agronomy recommendation",
  sampling_acceptance_pass_not_operation_success: "sampling_acceptance PASS ≠ operation success",
  manual_sample_data_must_not_write_problem_state_conclusion: "manual sample data 不得直接写 ProblemState conclusion",
  lab_result_must_not_write_roi_field_memory_customer_success: "lab result 不得直接写 ROI / Field Memory / customer success",
} as const;
