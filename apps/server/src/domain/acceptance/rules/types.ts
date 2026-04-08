export type AcceptanceEvaluationInput = {
  parameters: Record<string, any>;
  telemetry: Record<string, any>;
  acceptance_policy_ref: string | null;
};

export type AcceptanceEvaluationOutput = {
  result: "PASSED" | "FAILED" | "INCONCLUSIVE";
  score?: number;
  metrics: Record<string, number>;
  rule_id: string;
  explanation_codes?: string[];
  acceptance_skill_id?: string;
  acceptance_skill_version?: string;
};

export type AcceptanceRule = {
  task_type: string;
  run(input: AcceptanceEvaluationInput): AcceptanceEvaluationOutput;
};
