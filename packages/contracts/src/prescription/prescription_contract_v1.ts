import type { SkillTraceV1 } from "../agronomy/recommendation_v2.js";

export type PrescriptionRiskLevelV1 = "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";

export type PrescriptionStatusV1 =
  | "DRAFT"
  | "READY_FOR_APPROVAL"
  | "APPROVAL_REQUESTED"
  | "APPROVED"
  | "REJECTED"
  | "TASK_CREATED"
  | "CANCELLED";

export type PrescriptionOperationTypeV1 =
  | "IRRIGATION"
  | "FERTILIZATION"
  | "SPRAYING"
  | "INSPECTION"
  | "SAMPLING"
  | "OTHER";

export type PrescriptionContractV1 = {
  prescription_id: string;
  recommendation_id: string;
  tenant_id: string;
  project_id: string;
  group_id: string;
  field_id: string;
  season_id?: string | null;
  crop_id?: string | null;
  zone_id?: string | null;
  operation_type: PrescriptionOperationTypeV1;
  spatial_scope: {
    field_boundary_ref?: string | null;
    zone_boundary_ref?: string | null;
    geometry?: unknown | null;
    area_ha?: number | null;
    excluded_area_refs?: string[];
    risk_area_refs?: string[];
  };
  timing_window: {
    recommended_start_at?: string | null;
    recommended_end_at?: string | null;
    latest_start_at?: string | null;
    forbidden_windows?: Array<{
      start_at: string;
      end_at: string;
      reason: string;
    }>;
    weather_constraints?: Record<string, unknown>;
    crop_stage_constraints?: string[];
  };
  operation_amount: {
    amount: number;
    unit: string;
    rate?: number | null;
    rate_unit?: string | null;
    min_amount?: number | null;
    max_amount?: number | null;
    parameters?: Record<string, unknown>;
  };
  device_requirements: {
    device_type?: string | null;
    required_capabilities?: string[];
    min_accuracy?: number | null;
    flow_rate_min?: number | null;
    variable_rate_required?: boolean;
    online_required?: boolean;
    calibration_required?: boolean;
  };
  risk: {
    level: PrescriptionRiskLevelV1;
    reasons: string[];
  };
  evidence_refs: string[];
  skill_trace_id?: string;
  skill_trace?: SkillTraceV1;
  approval_requirement: {
    required: boolean;
    role?: string | null;
    second_confirmation_required?: boolean;
    auto_execute_allowed?: boolean;
    manual_takeover_required?: boolean;
  };
  acceptance_conditions: {
    amount_tolerance_percent?: number | null;
    required_coverage_percent?: number | null;
    required_execution_window?: boolean;
    required_post_metric?: {
      metric: string;
      operator: ">" | ">=" | "<" | "<=" | "=";
      value: number;
      unit?: string | null;
      observation_window_hours?: number | null;
    } | null;
    evidence_required: string[];
    failure_conditions?: string[];
    insufficient_evidence_conditions?: string[];
  };
  status: PrescriptionStatusV1;
  created_at: string;
  updated_at: string;
  created_by?: string | null;
};
