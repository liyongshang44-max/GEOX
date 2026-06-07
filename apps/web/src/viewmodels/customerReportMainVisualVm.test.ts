import assert from "node:assert/strict";
import { buildCustomerFieldReportMainVisualVm, buildCustomerOperationReportMainVisualVm } from "./customerReportMainVisualVm";

const c8LikeFieldOnly = {
  field_context: { field_id: "field_c8_demo", field_name: "C8 灌溉示范田" },
} as any;

const fieldVm = buildCustomerFieldReportMainVisualVm(c8LikeFieldOnly);
assert.equal(fieldVm.status, "INSUFFICIENT_REPORT");
assert.equal(JSON.stringify(fieldVm.rows).includes("已形成可信价值记录"), false);
assert.equal(JSON.stringify(fieldVm.rows).includes("灌溉作业已通过验收"), false);

const c8LikeOperationOnly = {
  identifiers: {
    operation_plan_id: "op_plan_c8_irrigation_formal_001",
    operation_id: "op_plan_c8_irrigation_formal_001",
    field_id: "field_c8_demo",
  },
  customer_title: "C8 灌溉作业",
} as any;

const operationVm = buildCustomerOperationReportMainVisualVm(c8LikeOperationOnly);
assert.equal(operationVm.status, "INSUFFICIENT_REPORT");
assert.equal(JSON.stringify(operationVm.rows).includes("已通过"), false);
assert.equal(JSON.stringify(operationVm.rows).includes("形成可信价值记录"), false);

console.log("customerReportMainVisualVm generic guards passed");
