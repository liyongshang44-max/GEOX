// apps/web/src/api/twinKernelTrace.ts
// Purpose: fetch the read-only Twin Kernel trace read model by decision_cycle_id.
// Boundary: this client only performs GET readback and must not create snapshots, forecasts, scenarios, calibration records, learning candidates, decision cycles, recommendations, approvals, AO-ACT tasks, ROI, Field Memory, or model updates.

import { apiRequestWithPolicy } from "./client";

export type TwinTraceJsonRecord = Record<string, unknown>;

export type TwinTraceReadModelV1 = {
  object_type: "twin_trace_v1_read_model" | string;
  decision_cycle_id: string;
  scope: TwinTraceJsonRecord;
  as_of_ts: string;
  read_only: true;
  write_ready: false;
  downstream_write_ready: false;
  provenance_classes: TwinTraceJsonRecord;
  entered_collected: TwinTraceJsonRecord;
  human_confirmed: TwinTraceJsonRecord;
  pointer_refs: TwinTraceJsonRecord;
  system_derived: Record<string, TwinTraceJsonRecord>;
  answers: TwinTraceJsonRecord;
};

export type TwinTraceReadModelResponse = {
  ok: boolean;
  object_type: "twin_trace_v1_read_model" | string;
  read_only: true;
  twin_trace: TwinTraceReadModelV1;
};

function safeDecisionCycleId(decisionCycleId: string): string {
  return encodeURIComponent(String(decisionCycleId || "").trim());
}

export async function fetchTwinKernelTraceReadModel(
  decisionCycleId: string,
): Promise<TwinTraceReadModelResponse> {
  const response = await apiRequestWithPolicy<TwinTraceReadModelResponse>(
    "/api/v1/twin-kernel/traces/" + safeDecisionCycleId(decisionCycleId),
    undefined,
    { dedupe: true, silent: true, timeoutMs: 10000 },
  );

  if (!response.ok || !response.data) {
    throw new Error("TWIN_KERNEL_TRACE_READ_MODEL_API_FAILED");
  }

  return response.data;
}
