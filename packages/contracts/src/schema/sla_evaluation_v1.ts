export type SlaEvaluationV1 = {
  type: "sla_evaluation_v1";
  payload: {
    tenant_id: string;
    project_id: string;
    group_id: string;
    program_id: string;
    sla_name: string;
    target_value?: number | string | null;
    actual_value?: number | string | null;
    met: boolean;
    status: "MET" | "BREACH" | "UNKNOWN";
    source?: string;
    recorded_ts: number;
  };
};
