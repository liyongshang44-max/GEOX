export type SkillRunStageV1 =
  | "recommendation"
  | "prescription"
  | "execution"
  | "acceptance"
  | "roi"
  | "other";

export type SkillRunStatusV1 = "queued" | "running" | "success" | "failed" | "cancelled";

export type SkillRunV1 = {
  skill_run_id: string;
  skill_id: string;
  status: SkillRunStatusV1;
  started_at_ts_ms?: number;
  finished_at_ts_ms?: number;
  recommendation_id?: string;
  prescription_id?: string;
  task_id?: string;
  operation_id?: string;
  field_id?: string;
  device_id?: string;
  trigger_stage?: SkillRunStageV1;
  input_digest?: string;
  output_digest?: string;
  explanation_codes?: string[];
};
