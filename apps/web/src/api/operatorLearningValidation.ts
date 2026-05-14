import { apiRequestWithPolicy, withQuery } from "./client";

export type OperatorLearningValidationStatusV1 =
  | "FORMAL_LEARNING_ACCEPTED"
  | "TRUSTED_VALUE_ONLY"
  | "RAW_SIGNALS_ONLY"
  | "SIMULATED_OR_DEV_ONLY"
  | "INSUFFICIENT_FORMAL_CHAIN";

export type OperatorLearningValidationV1 = {
  operation_id: string;
  learning_effective: boolean;
  learning_validation_status: OperatorLearningValidationStatusV1;
  formal_memory_count: number;
  trusted_value_count: number;
  raw_signal_count: number;
  technical_memory_count: number;
  simulated_or_dev_count: number;
  gates: Record<string, boolean>;
  reasons: string[];
  customer_summary: {
    learned: string;
    excluded_data: string;
    no_learning_reason: string | null;
  };
  raw_counts: {
    field_memory_rows: number;
    roi_rows: number;
    skill_trace_rows: number;
  };
};

export type OperatorLearningValidationResponse = {
  ok: boolean;
  source?: string;
  dataScope?: string;
  generated_at?: string;
  learning_validation?: OperatorLearningValidationV1;
  error?: string;
};

function text(value: unknown): string {
  return String(value ?? "").trim();
}

export async function fetchOperatorLearningValidation(args: { operationId?: unknown } = {}): Promise<OperatorLearningValidationV1 | null> {
  const operationId = text(args.operationId);
  if (!operationId) return null;
  const result = await apiRequestWithPolicy<OperatorLearningValidationResponse>(
    withQuery("/api/v1/operator/learning-validation", { operation_id: operationId }),
    undefined,
    { allowedStatuses: [400, 401, 403, 404, 405], silent: true, timeoutMs: 10000 },
  );
  if (!result.ok) return null;
  return result.data?.learning_validation ?? null;
}
