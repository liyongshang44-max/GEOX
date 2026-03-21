export type ResourceUsageV1 = {
  type: "resource_usage_v1";
  payload: {
    tenant_id: string;
    project_id: string;
    group_id: string;
    program_id: string;
    act_task_id?: string | null;
    resource_usage: {
      fuel_l: number;
      electric_kwh: number;
      water_l: number;
      chemical_ml: number;
    };
    source?: string;
    recorded_ts: number;
  };
};
