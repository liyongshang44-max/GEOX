import assert from "node:assert/strict";
import { buildCustomerDashboardVm } from "./customerDashboardVm";

const vm = buildCustomerDashboardVm({
  pending_actions_summary: { total_open_alerts: 3, pending_acceptance: 1 },
  fields: { total: "N/A", at_risk: 2 },
  roi_summary: undefined,
  recent_operations: [],
});

const vmNoRiskNoOps = buildCustomerDashboardVm({
  pending_actions_summary: { total_open_alerts: 0, pending_acceptance: 0 },
  fields: { at_risk: 0 },
  top_risk_fields: [],
  recent_operations: [],
});

const vmNoFields = buildCustomerDashboardVm({
  pending_actions_summary: { total_open_alerts: 0, pending_acceptance: 0 },
  fields: undefined,
  top_risk_fields: [],
  recent_operations: [],
});

assert.equal(vm.kpis.find((k) => k.key === "OPEN_ACTIONS")?.label, "待处理事项");
assert.equal(vm.kpis.some((k) => k.label === "总地块数"), false);
assert.equal(vm.roiSummary.emptyState?.title, vm.emptyStates.NO_ROI.title);
assert.equal(vm.deviceHealth.empty, true);
assert.equal(vmNoRiskNoOps.topRiskFields.length, 0);
assert.equal(vmNoRiskNoOps.recentOperations.length, 0);
assert.equal(vm.emptyStates.WEATHER_UNAVAILABLE.title.length > 0, true);
assert.equal(vm.emptyStates.MAP_UNAVAILABLE.title.length > 0, true);
assert.equal(vmNoFields.kpis.find((k) => k.key === "RISK_FIELDS")?.value, "0");

const visibleText = JSON.stringify({ vm, vmNoRiskNoOps, vmNoFields }).toLowerCase();
assert.equal(/undefined|nan/.test(visibleText), false);

console.log("customerDashboardVm smoke passed");
