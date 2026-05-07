import assert from "node:assert/strict";
import { buildOperationReportVm } from "./operationReportVm";

const vm = buildOperationReportVm({
  generated_at: "2026-05-01T00:00:00Z",
  identifiers: { operation_id: "op-1" },
  execution: { final_status: "PENDING", execution_started_at: null, execution_finished_at: null, invalid_reason: null },
  acceptance: { status: "PENDING", verdict: null, missing_items: [], missing_evidence: false, generated_at: null },
  risk: { level: "LOW", reasons: [] },
  evidence: { artifacts_count: 0, logs_count: 0, media_count: 0, metrics_count: 0 },
  workflow: { owner_name: null, updated_at: null },
  sla: { response_time_ms: null, dispatch_latency_quality: null, dispatch_latency_ms: null, execution_duration_quality: null, execution_duration_ms: null, acceptance_latency_quality: null, acceptance_latency_ms: null, invalid_reasons: [] },
} as any);

const byKey = (key: string) => vm.sections.find((s) => s.key === key);
assert.equal(byKey("PRESCRIPTION")?.status, "MISSING");
assert.equal(["MISSING", "PENDING"].includes(byKey("APPROVAL")?.status ?? ""), true);
assert.equal(byKey("EXECUTION")?.status, "MISSING");
assert.equal(byKey("ROI")?.status, "MISSING");
assert.equal(byKey("MEMORY")?.status, "MISSING");
assert.equal(vm.sections.length, 8);

console.log("operationReportVm smoke passed");
