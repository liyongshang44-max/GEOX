export type FertilizationFactTypeV1 =
  | "nitrogen_need_assessment_v1"
  | "fertilization_recommendation_v1"
  | "fertilization_prescription_v1"
  | "fertilization_acceptance_v1";

export const FERTILIZATION_FACT_TYPES_V1 = [
  "nitrogen_need_assessment_v1",
  "fertilization_recommendation_v1",
  "fertilization_prescription_v1",
  "fertilization_acceptance_v1",
] as const satisfies readonly FertilizationFactTypeV1[];

export type FertilizationTriggerSourceV1 =
  | "SAMPLING_LAB"
  | "SENSING_RISK"
  | "MANUAL_AGRONOMIST"
  | "CROP_STAGE_WINDOW";

export const FERTILIZATION_TRIGGER_SOURCES_V1 = [
  "SAMPLING_LAB",
  "SENSING_RISK",
  "MANUAL_AGRONOMIST",
  "CROP_STAGE_WINDOW",
] as const satisfies readonly FertilizationTriggerSourceV1[];

export type FertilizationEvidenceTierV1 = "FORMAL" | "WARNING" | "MANUAL_REVIEW";

export const FERTILIZATION_EVIDENCE_TIERS_V1 = [
  "FORMAL",
  "WARNING",
  "MANUAL_REVIEW",
] as const satisfies readonly FertilizationEvidenceTierV1[];

export type NitrogenNeedAssessmentStatusV1 = "SUFFICIENT" | "LOW_N_RISK" | "NEEDS_REVIEW" | "INVALID";

export const NITROGEN_NEED_ASSESSMENT_STATUSES_V1 = [
  "SUFFICIENT",
  "LOW_N_RISK",
  "NEEDS_REVIEW",
  "INVALID",
] as const satisfies readonly NitrogenNeedAssessmentStatusV1[];

export type FertilizationConfidenceV1 = "HIGH" | "MEDIUM" | "LOW";
export type FertilizationSampleTypeV1 = "SOIL" | "TISSUE";
export type FertilizationNutrientV1 = "N";
export type FertilizationRecommendationTypeV1 = "NITROGEN";
export type FertilizationZoneResultV1 = "PASS" | "FAIL" | "NEEDS_REVIEW";
export type FertilizationAcceptanceStatusV1 = "PASS" | "FAIL" | "NEEDS_REVIEW" | "MISSING";

export type FertilizationEvidenceRefV1 = { kind: string; ref_id: string };

export type FertilizationSkillSignalRefV1 = {
  skill_id: string;
  skill_run_id?: string | null;
  skill_trace_id?: string | null;
  signal_type: string;
};

export type FertilizationSensingStateRefV1 = {
  state_type: "fertility_state" | "salinity_risk_state" | "canopy_stress_state" | string;
  ref_id: string;
};

export type NitrogenNeedMetricsV1 = {
  nitrate_n_mg_kg?: number | null;
  ammonium_n_mg_kg?: number | null;
  total_n_percent?: number | null;
  organic_matter_percent?: number | null;
  tissue_n_percent?: number | null;
  ec_ds_m?: number | null;
  canopy_temp_c?: number | null;
};

export type NitrogenNeedAssessmentV1 = {
  assessment_id: string;
  tenant_id: string;
  project_id: string;
  group_id: string;
  field_id: string;
  season_id?: string | null;
  crop_code?: string | null;

  trigger_source: FertilizationTriggerSourceV1;
  evidence_tier: FertilizationEvidenceTierV1;

  sample_id?: string | null;
  lab_import_id?: string | null;

  skill_signal_refs?: FertilizationSkillSignalRefV1[];
  sensing_state_refs?: FertilizationSensingStateRefV1[];

  sample_type?: FertilizationSampleTypeV1 | null;

  metrics: NitrogenNeedMetricsV1;

  status: NitrogenNeedAssessmentStatusV1;
  reasons: string[];
  evidence_refs: FertilizationEvidenceRefV1[];
  created_at_ts: number;
};

export type FertilizationRecommendationZoneRateV1 = {
  zone_id: string;
  n_kg_ha: number;
  confidence: FertilizationConfidenceV1;
  reason: string;
};

export type FertilizationSourceSkillRefV1 = {
  skill_id: string;
  skill_run_id?: string | null;
  output_ref?: string | null;
};

export type FertilizationRecommendationV1 = {
  fertilization_recommendation_id: string;
  assessment_id: string;
  tenant_id: string;
  project_id: string;
  group_id: string;
  field_id: string;

  recommendation_type: FertilizationRecommendationTypeV1;
  suggested_total_n_kg_ha: number | null;

  zone_rates: FertilizationRecommendationZoneRateV1[];

  risk_flags: string[];
  customer_visible_eligible: boolean;
  evidence_refs: FertilizationEvidenceRefV1[];

  source_skill_refs?: FertilizationSourceSkillRefV1[];

  created_at_ts: number;
};

export type FertilizationPrescriptionZoneRateV1 = {
  zone_id: string;
  planned_n_kg_ha: number;
  max_n_kg_ha?: number | null;
  unit: "kgN/ha";
  required: boolean;
  reason?: string | null;
};

export type FertilizationPrescriptionV1 = {
  fertilization_prescription_id: string;
  fertilization_recommendation_id: string;
  assessment_id: string;
  tenant_id: string;
  project_id: string;
  group_id: string;
  field_id: string;
  nutrient: FertilizationNutrientV1;
  material_type?: string | null;
  zone_rates: FertilizationPrescriptionZoneRateV1[];
  manual_approval_required: boolean;
  customer_visible_eligible: boolean;
  status: "DRAFT" | "READY_FOR_APPROVAL" | "SUBMITTED_FOR_APPROVAL" | "APPROVED" | "REJECTED";
  evidence_refs: FertilizationEvidenceRefV1[];
  created_at_ts: number;
};

export type FertilizationAcceptanceZoneResultV1 = {
  zone_id: string;
  planned_n_kg_ha: number;
  actual_n_kg_ha: number | null;
  coverage_percent: number | null;
  deviation_percent: number | null;
  result: FertilizationZoneResultV1;
  reasons: string[];
};

export type FertilizationAcceptanceV1 = {
  fertilization_acceptance_id: string;
  fertilization_prescription_id: string;
  tenant_id: string;
  project_id: string;
  group_id: string;
  field_id: string;
  operation_plan_id?: string | null;
  act_task_id?: string | null;
  receipt_id?: string | null;
  as_applied_id?: string | null;
  acceptance_status: FertilizationAcceptanceStatusV1;
  zone_results: FertilizationAcceptanceZoneResultV1[];
  operation_rollup_policy: "ALL_REQUIRED_ZONES_PASS" | "NEEDS_REVIEW_ON_MISSING_ZONE";
  reasons: string[];
  evidence_refs: FertilizationEvidenceRefV1[];
  evaluated_at_ts: number;
};

export type NitrogenNeedAssessmentFactV1 = NitrogenNeedAssessmentV1 & {
  type: "nitrogen_need_assessment_v1";
  schema_version: "1";
};

export type FertilizationRecommendationFactV1 = FertilizationRecommendationV1 & {
  type: "fertilization_recommendation_v1";
  schema_version: "1";
};

export type FertilizationPrescriptionFactV1 = FertilizationPrescriptionV1 & {
  type: "fertilization_prescription_v1";
  schema_version: "1";
};

export type FertilizationAcceptanceFactV1 = FertilizationAcceptanceV1 & {
  type: "fertilization_acceptance_v1";
  schema_version: "1";
};

export type FertilizationDomainFactV1 =
  | NitrogenNeedAssessmentFactV1
  | FertilizationRecommendationFactV1
  | FertilizationPrescriptionFactV1
  | FertilizationAcceptanceFactV1;

export const FERTILIZATION_DOMAIN_HARD_RULES_V1 = {
  skillrun_success_not_low_n_risk: "SkillRun SUCCESS ≠ nitrogen_need_assessment LOW_N_RISK",
  lab_result_imported_not_nitrogen_need_confirmed: "lab_result_imported ≠ nitrogen need confirmed",
  fertility_state_low_not_formal_fertilization_recommendation: "fertility_state LOW ≠ formal fertilization recommendation",
  low_n_risk_not_recommendation_approved: "nitrogen_need_assessment LOW_N_RISK ≠ fertilization recommendation approved",
  recommendation_not_prescription: "fertilization_recommendation ≠ fertilization prescription",
  prescription_not_approved_operation: "fertilization_prescription ≠ approved operation",
  receipt_success_not_acceptance_pass: "receipt success ≠ fertilization acceptance PASS",
  operation_average_must_not_hide_zone_failure: "operation-level average 不得掩盖 zone-level over/under application",
  acceptance_pass_must_not_write_roi_field_memory_customer_success: "fertilization acceptance PASS 不得直接写 ROI / Field Memory / customer success",
} as const;

export const FERTILIZATION_SKILL_BOUNDARY_NOTE_V1 = {
  acceptance_skill_id_collision: "AcceptanceSkill skill_id=fertilization_acceptance_v1 is only an acceptance_signal producer and is not the formal fertilization_acceptance_v1 fact writer.",
  agronomy_skill_output_boundary: "Fertilization AGRONOMY Skill output may be diagnosis_signal or recommendation_candidate, but must pass through Fertilization Domain and Main Chain before customer-visible recommendation, prescription, approval, AO-ACT task, receipt, acceptance, ROI, or Field Memory.",
} as const;
