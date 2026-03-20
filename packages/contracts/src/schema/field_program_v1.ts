export type ProgramPriorityV1 = "low" | "medium" | "high";

export type FieldProgramStatusV1 =
  | "DRAFT"
  | "ACTIVE"
  | "PAUSED"
  | "COMPLETED"
  | "CANCELLED"
  | "ARCHIVED";

export type FieldProgramV1 = {
  type: "field_program_v1";
  payload: {
    tenant_id: string;
    project_id: string;
    group_id: string;
    program_id: string;
    field_id: string;
    season_id: string;
    crop_code: string;
    variety_code?: string | null;
    goal_profile: {
      yield_priority: ProgramPriorityV1;
      quality_priority: ProgramPriorityV1;
      residue_priority: ProgramPriorityV1;
      water_saving_priority: ProgramPriorityV1;
      cost_priority: ProgramPriorityV1;
    };
    constraints: {
      forbid_pesticide_classes: string[];
      forbid_fertilizer_types: string[];
      max_irrigation_mm_per_day?: number | null;
      manual_approval_required_for: string[];
      allow_night_irrigation: boolean;
    };
    budget?: {
      max_cost_total?: number | null;
      currency: string;
    } | null;
    execution_policy: {
      mode: "approval_required" | "auto_allowed";
      auto_execute_allowed_task_types: string[];
    };
    acceptance_policy_ref?: string | null;
    evidence_policy_ref?: string | null;
    status: FieldProgramStatusV1;
    created_ts: number;
    updated_ts: number;
  };
};
