export type NormalizedReceiptEvidence = {
  receipt_type: string | null;
  receipt_fact_id: string | null;
  receipt_status: string | null;
  recorded_at: string | null;
  execution_started_at: string | null;
  execution_finished_at: string | null;
  duration_ms: number | null;
  water_l: number | null;
  electric_kwh: number | null;
  chemical_ml: number | null;
  log_ref_count: number | null;
  constraint_violated: boolean | null;
  executor_label: string | null;
  device_id: string | null;
  operation_plan_id: string | null;
  act_task_id: string | null;
};

type NormalizeReceiptEvidenceInput = {
  fact_id?: unknown;
  occurred_at?: unknown;
  record_json?: unknown;
};

function parseRecordJsonMaybe(v: unknown): any {
  if (v && typeof v === "object") return v;
  if (typeof v !== "string" || v.trim() === "") return null;
  try {
    return JSON.parse(v);
  } catch {
    return null;
  }
}

function pickString(...values: unknown[]): string | null {
  for (const value of values) {
    if (typeof value === "string") {
      const trimmed = value.trim();
      if (trimmed) return trimmed;
    }
  }
  return null;
}

function pickNumber(...values: unknown[]): number | null {
  for (const value of values) {
    const n = typeof value === "number" ? value : Number(value);
    if (Number.isFinite(n)) return n;
  }
  return null;
}

export function normalizeReceiptEvidence(input: NormalizeReceiptEvidenceInput, factType?: string): NormalizedReceiptEvidence {
  const recordJson = parseRecordJsonMaybe(input?.record_json);
  const payload = recordJson?.payload ?? {};
  const executionTime = payload?.execution_time ?? {};
  const resourceUsage = payload?.resource_usage ?? {};
  const logsRefs = Array.isArray(payload?.logs_refs) ? payload.logs_refs : [];
  const constraintCheck = payload?.constraint_check ?? {};
  const executorMeta = payload?.executor_id && typeof payload.executor_id === "object" ? payload.executor_id : {};

  const startTs = pickString(executionTime?.start_ts, payload?.execution_started_at);
  const endTs = pickString(executionTime?.end_ts, payload?.execution_finished_at);
  const durationMs = pickNumber(
    executionTime?.duration_ms,
    payload?.duration_ms,
    startTs && endTs ? Date.parse(endTs) - Date.parse(startTs) : null
  );

  const occurredAt = pickString(
    payload?.received_ts,
    payload?.created_at_ts,
    input?.occurred_at
  );

  return {
    receipt_type: pickString(factType, recordJson?.type),
    receipt_fact_id: pickString(input?.fact_id),
    receipt_status: pickString(payload?.status, payload?.receipt_status),
    recorded_at: occurredAt,
    execution_started_at: startTs,
    execution_finished_at: endTs,
    duration_ms: durationMs,
    water_l: pickNumber(resourceUsage?.water_l),
    electric_kwh: pickNumber(resourceUsage?.electric_kwh),
    chemical_ml: pickNumber(resourceUsage?.chemical_ml),
    log_ref_count: logsRefs.length,
    constraint_violated: typeof constraintCheck?.violated === "boolean" ? constraintCheck.violated : null,
    executor_label: pickString(payload?.executor_label, executorMeta?.label, executorMeta?.name, executorMeta?.id, payload?.executor_id),
    device_id: pickString(payload?.meta?.device_id, payload?.device_id, executorMeta?.id),
    operation_plan_id: pickString(payload?.operation_plan_id),
    act_task_id: pickString(payload?.act_task_id, payload?.task_id)
  };
}
