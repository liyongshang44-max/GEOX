import assert from "node:assert/strict";
import { buildCustomerDashboardVm } from "./customerDashboardVm";

const vm = buildCustomerDashboardVm({
  pending_actions_summary: { total_open_alerts: 3, pending_acceptance: 1 },
  fields: { total: "N/A", at_risk: 2 },
  roi_summary: undefined,
  recent_operations: [],
});

assert.equal(vm.kpis.find((k) => k.key === "OPEN_ACTIONS")?.label, "待处理事项");
assert.equal(vm.kpis.some((k) => k.label === "总地块数"), false);
assert.equal(vm.roiSummary.emptyState?.title, vm.emptyStates.NO_ROI.title);
assert.equal(vm.deviceHealth.empty, true);

console.log("customerDashboardVm smoke passed");
