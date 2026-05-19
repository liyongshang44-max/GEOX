export type PestDiseaseInspectionFactTypeV1 =
  | "pest_disease_inspection_request_v1"
  | "pest_disease_observation_v1"
  | "pest_disease_signal_v1"
  | "pest_disease_inspection_assessment_v1"
  | "pest_disease_inspection_review_v1"
  | "pest_disease_inspection_acceptance_v1";

export const PEST_DISEASE_INSPECTION_FACT_TYPES_V1 = [
  "pest_disease_inspection_request_v1",
  "pest_disease_observation_v1",
  "pest_disease_signal_v1",
  "pest_disease_inspection_assessment_v1",
  "pest_disease_inspection_review_v1",
  "pest_disease_inspection_acceptance_v1",
] as const satisfies readonly PestDiseaseInspectionFactTypeV1[];

export type PestDiseaseInspectionEvidenceRefV1 = { kind: string; ref_id: string };

export type PestDiseaseInspectionTriggerSourceV1 =
  | "AO_SENSE"
  | "MANUAL_SCOUT"
  | "DRONE_IMAGE"
  | "FIXED_TRAP"
  | "SENSING_RISK"
  | "CUSTOMER_REQUEST"
  | "CROP_STAGE_WINDOW";

export const PEST_DISEASE_INSPECTION_TRIGGER_SOURCES_V1 = [
  "AO_SENSE",
  "MANUAL_SCOUT",
  "DRONE_IMAGE",
  "FIXED_TRAP",
  "SENSING_RISK",
  "CUSTOMER_REQUEST",
  "CROP_STAGE_WINDOW",
] as const satisfies readonly PestDiseaseInspectionTriggerSourceV1[];

export type PestDiseaseInspectionTargetTypeV1 = "PEST" | "DISEASE" | "WEED" | "UNKNOWN_STRESS";

export const PEST_DISEASE_INSPECTION_TARGET_TYPES_V1 = [
  "PEST",
  "DISEASE",
  "WEED",
  "UNKNOWN_STRESS",
] as const satisfies readonly PestDiseaseInspectionTargetTypeV1[];

export type PestDiseaseInspectionPriorityV1 = "LOW" | "NORMAL" | "HIGH" | "URGENT";

export type PestDiseaseDeviceModelV1 =
  | "PHONE_CAMERA"
  | "DJI_MAVIC_3E"
  | "DJI_MAVIC_3M"
  | "DJI_MAVIC_3T"
  | "SENTERA_6X"
  | "MICASENSE_REDEDGE_P"
  | "FIXED_PEST_TRAP_GENERIC"
  | "TRAPVIEW_TRAP"
  | "MANUAL_SCOUT"
  | "OTHER";

export type PestDiseaseDeviceTypeV1 =
  | "PHONE"
  | "UAV_RGB"
  | "UAV_MULTISPECTRAL"
  | "UAV_THERMAL"
  | "FIXED_TRAP"
  | "SCOUTING_APP"
  | "MANUAL";

export type PestDiseaseMediaKindV1 =
  | "IMAGE"
  | "VIDEO"
  | "MULTISPECTRAL_MAP"
  | "THERMAL_IMAGE"
  | "TRAP_IMAGE";

export type PestDiseasePlantPartV1 = "LEAF" | "STEM" | "ROOT" | "FRUIT" | "CANOPY" | "TRAP" | "UNKNOWN";

export type PestDiseaseEvidenceQualityV1 =
  | "COMPLETE"
  | "PARTIAL"
  | "MISSING_GEO"
  | "MISSING_MEDIA"
  | "LOW_QUALITY_IMAGE";

export type PestDiseaseSignalTypeV1 =
  | "PEST_SIGNAL"
  | "DISEASE_SIGNAL"
  | "WEED_SIGNAL"
  | "CROP_STRESS_SIGNAL";

export type PestDiseaseInspectionConfidenceV1 = "HIGH" | "MEDIUM" | "LOW";

export type PestDiseaseInspectionAssessmentStatusV1 =
  | "CONFIRMED"
  | "SUSPECTED"
  | "RULED_OUT"
  | "NEEDS_REVIEW"
  | "INSUFFICIENT_EVIDENCE";

export type PestDiseaseInspectionSeverityV1 = "NONE" | "LOW" | "MEDIUM" | "HIGH" | "NEEDS_REVIEW";

export type PestDiseaseInspectionEvidenceTierV1 = "FORMAL" | "TECHNICAL" | "WARNING" | "MANUAL_REVIEW";

export type PestDiseaseInspectionReviewStatusV1 =
  | "NOT_REQUIRED"
  | "PENDING"
  | "APPROVED"
  | "REJECTED"
  | "ESCALATED";

export type PestDiseaseInspectionAcceptanceVerdictV1 =
  | "PASS"
  | "FAIL"
  | "NEEDS_REVIEW"
  | "INSUFFICIENT_EVIDENCE";

export type PestDiseaseGeoPointV1 = {
  lat: number;
  lng: number;
};

export type PestDiseaseDeviceProfileV1 = {
  device_id?: string | null;
  device_model: PestDiseaseDeviceModelV1;
  device_type: PestDiseaseDeviceTypeV1;
  capabilities: string[];
};

export type PestDiseaseMediaRefV1 = {
  kind: PestDiseaseMediaKindV1;
  ref_id: string;
  checksum?: string | null;
};

export type PestDiseaseSkillSignalRefV1 = {
  skill_id: string;
  skill_run_id?: string | null;
  signal_id?: string | null;
};

export type PestDiseaseInspectionRequestV1 = {
  inspection_id: string;
  tenant_id: string;
  project_id: string;
  group_id: string;
  field_id: string;
  zone_id?: string | null;

  trigger_source: PestDiseaseInspectionTriggerSourceV1;
  requested_target: PestDiseaseInspectionTargetTypeV1;

  crop_code?: string | null;
  crop_stage?: string | null;

  requested_at_ts: number;
  priority: PestDiseaseInspectionPriorityV1;

  evidence_refs: PestDiseaseInspectionEvidenceRefV1[];
  reasons: string[];
};

export type PestDiseaseObservationV1 = {
  observation_id: string;
  inspection_id: string;

  tenant_id: string;
  project_id: string;
  group_id: string;
  field_id: string;
  zone_id?: string | null;

  captured_at_ts: number;

  geo_point?: PestDiseaseGeoPointV1 | null;
  device_profile?: PestDiseaseDeviceProfileV1 | null;

  media_refs: PestDiseaseMediaRefV1[];

  scout_note?: string | null;
  crop_stage?: string | null;

  plant_part: PestDiseasePlantPartV1;
  target_type: PestDiseaseInspectionTargetTypeV1;

  suspected_issue_code?: string | null;

  pest_count?: number | null;
  trap_count?: number | null;
  incidence_percent?: number | null;
  severity_percent?: number | null;
  affected_area_percent?: number | null;

  evidence_quality: PestDiseaseEvidenceQualityV1;

  evidence_refs: PestDiseaseInspectionEvidenceRefV1[];
  created_at_ts: number;
};

export type PestDiseaseSignalV1 = {
  signal_id: string;
  inspection_id: string;
  observation_id?: string | null;

  tenant_id: string;
  project_id: string;
  group_id: string;
  field_id: string;
  zone_id?: string | null;

  skill_id: string;
  skill_run_id?: string | null;
  skill_trace_id?: string | null;

  signal_type: PestDiseaseSignalTypeV1;
  candidate_issue_code?: string | null;

  confidence: PestDiseaseInspectionConfidenceV1;
  reason_codes: string[];
  missing_inputs: string[];
  uncertainty_notes: string[];

  evidence_refs: PestDiseaseInspectionEvidenceRefV1[];
  created_at_ts: number;
};

export type PestDiseaseInspectionAssessmentV1 = {
  assessment_id: string;
  inspection_id: string;

  tenant_id: string;
  project_id: string;
  group_id: string;
  field_id: string;
  zone_id?: string | null;

  target_type: PestDiseaseInspectionTargetTypeV1;
  suspected_issue_code?: string | null;

  assessment_status: PestDiseaseInspectionAssessmentStatusV1;
  severity: PestDiseaseInspectionSeverityV1;
  confidence: PestDiseaseInspectionConfidenceV1;
  evidence_tier: PestDiseaseInspectionEvidenceTierV1;

  review_required: boolean;
  customer_visible_eligible: boolean;

  observation_refs: string[];
  skill_signal_refs: PestDiseaseSkillSignalRefV1[];

  evidence_refs: PestDiseaseInspectionEvidenceRefV1[];
  blocking_reasons: string[];
  reasons: string[];

  created_at_ts: number;
};

export type PestDiseaseInspectionReviewV1 = {
  review_id: string;
  inspection_id: string;
  assessment_id: string;

  tenant_id: string;
  project_id: string;
  group_id: string;
  field_id: string;

  review_status: PestDiseaseInspectionReviewStatusV1;

  reviewer_actor_id?: string | null;
  reviewed_at_ts?: number | null;
  review_note?: string | null;

  evidence_refs: PestDiseaseInspectionEvidenceRefV1[];
};

export type PestDiseaseInspectionAcceptanceV1 = {
  inspection_acceptance_id: string;
  inspection_id: string;
  assessment_id: string;

  tenant_id: string;
  project_id: string;
  group_id: string;
  field_id: string;

  verdict: PestDiseaseInspectionAcceptanceVerdictV1;

  evidence_complete: boolean;
  geo_evidence_present: boolean;
  media_evidence_present: boolean;
  human_review_satisfied: boolean;

  reasons: string[];
  evidence_refs: PestDiseaseInspectionEvidenceRefV1[];

  evaluated_at_ts: number;
};

export type PestDiseaseInspectionRequestFactV1 = PestDiseaseInspectionRequestV1 & {
  type: "pest_disease_inspection_request_v1";
  schema_version: "1";
};

export type PestDiseaseObservationFactV1 = PestDiseaseObservationV1 & {
  type: "pest_disease_observation_v1";
  schema_version: "1";
};

export type PestDiseaseSignalFactV1 = PestDiseaseSignalV1 & {
  type: "pest_disease_signal_v1";
  schema_version: "1";
};

export type PestDiseaseInspectionAssessmentFactV1 = PestDiseaseInspectionAssessmentV1 & {
  type: "pest_disease_inspection_assessment_v1";
  schema_version: "1";
};

export type PestDiseaseInspectionReviewFactV1 = PestDiseaseInspectionReviewV1 & {
  type: "pest_disease_inspection_review_v1";
  schema_version: "1";
};

export type PestDiseaseInspectionAcceptanceFactV1 = PestDiseaseInspectionAcceptanceV1 & {
  type: "pest_disease_inspection_acceptance_v1";
  schema_version: "1";
};

export type PestDiseaseInspectionDomainFactV1 =
  | PestDiseaseInspectionRequestFactV1
  | PestDiseaseObservationFactV1
  | PestDiseaseSignalFactV1
  | PestDiseaseInspectionAssessmentFactV1
  | PestDiseaseInspectionReviewFactV1
  | PestDiseaseInspectionAcceptanceFactV1;

export const PEST_DISEASE_INSPECTION_DOMAIN_HARD_RULES_V1 = {
  acceptance_pass_means_evidence_chain_complete: "pest_disease_inspection_acceptance PASS = 巡检证据链完整，可支撑 assessment",
  acceptance_pass_not_issue_presence: "pest_disease_inspection_acceptance PASS ≠ 病虫害一定存在",
  acceptance_pass_not_spray_recommendation: "pest_disease_inspection_acceptance PASS ≠ spray recommendation",
  acceptance_pass_not_spot_spray_prescription: "pest_disease_inspection_acceptance PASS ≠ spot spray prescription",
  acceptance_pass_not_ao_act_spray_task: "pest_disease_inspection_acceptance PASS ≠ AO-ACT spray task",
  skillrun_success_not_assessment_confirmed: "SkillRun SUCCESS ≠ pest_disease_inspection_assessment CONFIRMED",
  observation_not_formal_conclusion: "pest_disease_observation_v1 ≠ formal pest/disease conclusion",
  signal_not_formal_assessment: "pest_disease_signal_v1 is a technical signal, not a formal assessment",
  assessment_not_spray_execution: "pest_disease_inspection_assessment_v1 ≠ spray recommendation / spot spray prescription / AO-ACT spray task",
} as const;

export const PEST_DISEASE_INSPECTION_SKILL_BOUNDARY_NOTE_V1 = {
  skill_output_boundary: "Pest/Disease AGRONOMY or SENSING Skill output may produce pest_disease_signal_v1 only; it is not a formal assessment, review, acceptance, recommendation, prescription, approval, AO-ACT task, ROI, or Field Memory.",
  domain_writer_boundary: "Inspection Domain owns pest_disease_inspection_assessment_v1 and pest_disease_inspection_acceptance_v1; Skills do not write the formal inspection acceptance fact.",
  ao_sense_bridge_boundary: "AO-SENSE may request and receipt inspection tasks, but pest/disease media, GPS, scout note, device profile, counts, incidence, severity, and evidence quality belong in pest_disease_observation_v1 and are referenced from AO-SENSE receipt by fact_id.",
} as const;
