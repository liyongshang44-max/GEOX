import assert from "node:assert/strict";
import { buildC8FieldMainVisualVm, buildC8OperationMainVisualVm } from "./customerC8FormalReportVm";

const forbiddenTokens = [
  "field_c8_demo",
  "dev_soil_c8_001",
  "dev_valve_pump_c8_001",
  "op_plan_c8_irrigation_formal_001",
  "op_plan_c8_irrigation_pending_001",
  "LIMITED_STATE",
  "soil_moisture_followup",
  "skill trace 查询接口未接入",
  "接口未接入",
];

function visibleText(vm: { title: string; subtitle: string; rows: Array<{ label: string; value: string }> }): string {
  return JSON.stringify({ title: vm.title, subtitle: vm.subtitle, rows: vm.rows });
}

function assertNoForbiddenCustomerText(name: string, text: string): void {
  for (const token of forbiddenTokens) assert.equal(text.includes(token), false, `${name} leaked ${token}`);
}

const fieldReport = {
  field: { field_id: "field_c8_demo", field_name: "C8 灌溉示范田" },
  field_context: {
    field_id: "field_c8_demo",
    field_name: "C8 灌溉示范田",
    area_mu: 30,
    boundary_status: "BOUNDARY_AVAILABLE",
    boundary_geojson: { type: "Polygon", coordinates: [] },
    crop_name: "玉米",
    crop_stage: "VEGETATIVE",
  },
  sensing_summary: {
    devices: [
      { device_id: "dev_soil_c8_001", capability: "soil_moisture" },
      { device_id: "dev_valve_pump_c8_001", capability: "valve_pump_controller" },
      { device_id: "dev_weather_station_c8_001", capability: "weather_station" },
    ],
    observations: [
      { metric: "soil_moisture_percent", value: 18.4 },
      { metric: "forecast_rain_72h_mm", value: 2 },
      { metric: "temperature_max_c", value: 31 },
      { metric: "soil_moisture_after_percent", value: 24.1 },
    ],
  },
  execution_summary: { formal_operation_count: 1, latest_operation_id: "op_plan_c8_irrigation_formal_001" },
  value_summary: { has_customer_visible_value: true },
  learning_summary: { formal_memory_count: 1, formal_field_response_memory_count: 1 },
} as any;

const operationReport = {
  identifiers: {
    operation_plan_id: "op_plan_c8_irrigation_formal_001",
    operation_id: "op_plan_c8_irrigation_formal_001",
    field_id: "field_c8_demo",
    recommendation_id: "rec_c8_irrigation_001",
    approval_id: "approval_c8_irrigation_001",
    receipt_id: "receipt_c8_irrigation_formal_001",
    prescription_id: "presc_c8_irrigation_001",
    as_executed_id: "as_executed_c8_irrigation_001",
  },
  customer_title: "C8 灌溉作业",
  formal_scenario: { customer_visible_eligible: true },
  diagnostic_inputs: {
    observations: [
      { metric: "soil_moisture_percent", value: 18.4 },
      { metric: "forecast_rain_72h_mm", value: 2 },
    ],
  },
  approval: { actor_name: "运营管理员", status: "APPROVED" },
  prescription: { prescription_id: "presc_c8_irrigation_001", amount: 22, unit: "mm" },
  as_executed: { as_executed_id: "as_executed_c8_irrigation_001", status: "CONFIRMED", executed_amount: 21.6, unit: "mm" },
  as_applied: { coverage_percent: 100 },
  acceptance: { status: "PASS" },
  roi_ledger: { summary: { has_customer_visible_value: true } },
  field_memory: { field_response_memory: [{ summary_text: "水分回升到目标区间" }] },
} as any;

const fieldVm = buildC8FieldMainVisualVm(fieldReport);
assert(fieldVm);
assert.equal(fieldVm.status, "FORMAL_READY");
const fieldVisible = visibleText(fieldVm);
for (const required of [
  "C8 灌溉示范田",
  "面积","30 亩",
  "边界","已接入",
  "作物","玉米，营养生长期",
  "设备","土壤水分传感器、阀门泵站控制器、微型气象站",
  "感知","灌前土壤水分 18.4%，未来 72 小时降雨 2mm",
  "诊断","土壤水分偏低，近期降雨不足",
  "正式作业","灌溉作业已通过验收",
  "价值记录","已形成可信价值记录",
  "田块记忆","水分回升到目标区间",
]) assert(fieldVisible.includes(required), `field visible text missing ${required}`);
assertNoForbiddenCustomerText("field", fieldVisible);

const operationVm = buildC8OperationMainVisualVm(operationReport);
assert(operationVm);
assert.equal(operationVm.status, "FORMAL_READY");
const operationVisible = visibleText(operationVm);
for (const required of [
  "C8 灌溉作业",
  "为什么做","土壤水分偏低，近期降雨不足",
  "建议","补灌 22mm",
  "审批","运营管理员已审批",
  "任务","由 C8 阀门泵站控制器执行",
  "执行","实际补灌 21.6mm，覆盖 100%",
  "验收","已通过",
  "价值","形成可信价值记录",
  "学习","形成田块记忆",
]) assert(operationVisible.includes(required), `operation visible text missing ${required}`);
assertNoForbiddenCustomerText("operation", operationVisible);

const insufficientOperationVm = buildC8OperationMainVisualVm({ ...operationReport, as_applied: { coverage_percent: 80 }, roi_ledger: { summary: { has_customer_visible_value: false } } });
assert(insufficientOperationVm);
assert.equal(insufficientOperationVm.status, "INSUFFICIENT_REPORT");
const insufficientVisible = visibleText(insufficientOperationVm);
assert.equal(insufficientVisible.includes("已通过"), false);
assert.equal(insufficientVisible.includes("形成可信价值记录"), false);
assertNoForbiddenCustomerText("insufficient operation", insufficientVisible);

console.log("customerC8FormalReportVm acceptance passed");
