export type AgronomyRuleInput = {
  tenant_id: string;
  project_id: string;
  group_id: string;
  field_id: string;
  season_id: string;
  crop_code: string;
  crop_stage: string;

  telemetry: {
    soil_moisture?: number;
    canopy_temp?: number;
    air_temp?: number;
    humidity?: number;
    ec?: number;
    ph?: number;
  };

  constraints?: {
    forbid_irrigation?: boolean;
    forbid_fertilizer_classes?: string[];
    water_budget_l?: number;
  };

  context?: {
    recent_operations?: Array<{
      action_type: string;
      ts: number;
      final_status: string;
    }>;
    snapshot_ts: number;
  };
};
