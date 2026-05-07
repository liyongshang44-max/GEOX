import assert from "node:assert/strict";
import { buildFieldReportVm } from "./fieldReportVm";

const vm = buildFieldReportVm({
  generated_at: "2026-05-01T00:00:00Z",
  field: { field_id: "f-1", field_name: "测试地块" },
  overview: {
    current_risk_level: "LOW",
    open_alerts_count: 0,
    pending_acceptance_count: 0,
    total_operations_count: 0,
    latest_operation_at: null,
    estimated_total_cost: 0,
    actual_total_cost: 0,
  },
  explain: { human: "", top_reasons: [] },
  value_summary: {
    total_roi_items: 0,
    water_saved_items: 0,
    labor_saved_items: 0,
    early_warning_items: 0,
    low_confidence_items: 0,
    assumption_based_items: 0,
    first_pass_acceptance_items: 0,
  },
  device_summary: { total_devices: 0, online_devices: 0, offline_devices: 0, last_telemetry_at: null },
  next_action: null,
  recent_operations: [],
} as any);

assert.equal(vm.hero.title, "测试地块");
assert.equal(vm.roiSummary.displayText.includes("暂无可量化价值记录"), true);
assert.equal(vm.fieldMemory.displayText.includes("暂无可展示的地块记忆"), true);
assert.equal(vm.recentOperations.length, 0);

console.log("fieldReportVm smoke passed");
