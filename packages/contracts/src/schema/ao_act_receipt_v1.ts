export type AoActReceiptV1 = {
  type: "ao_act_receipt_v1";
  payload: {
    act_task_id: string;
    executor_id: {
      kind: "human";
      id: string;
    };
    status: "executed" | "not_executed";
    execution_time: {
      start_ts?: number;
      end_ts?: number;
    };
    execution_coverage?: {
      kind: "field" | "point" | "manual";
    };
    resource_usage?: {
      water_l?: number;
      electric_kwh?: number;
      chemical_ml?: number;
    };
    logs_refs?: string[];
    evidence_refs?: string[];
    evidence_artifact_ids?: string[];
    constraint_check?: {
      violated: boolean;
      summary?: string;
    };
  };
};
