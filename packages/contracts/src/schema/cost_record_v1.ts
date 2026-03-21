export type CostRecordV1 = {
  type: "cost_record_v1";
  payload: {
    tenant_id: string;
    project_id: string;
    group_id: string;
    program_id: string;
    act_task_id?: string | null;
    cost_amount: number;
    currency: string;
    category?: string;
    source?: string;
    recorded_ts: number;
  };
};
