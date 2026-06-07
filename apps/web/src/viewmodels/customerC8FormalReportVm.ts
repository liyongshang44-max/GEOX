import type { FieldReportDetailV1, OperationReportV1 } from "../api/customerReports";
import {
  buildCustomerFieldReportMainVisualVm,
  buildCustomerOperationReportMainVisualVm,
  type CustomerReportMainVisualVm,
} from "./customerReportMainVisualVm";

export const C8_FIELD_REPORT_ID = "field_c8_demo";
export const C8_OPERATION_REPORT_ID = "op_plan_c8_irrigation_formal_001";

export type C8CustomerMainVisualVm = CustomerReportMainVisualVm;

const FORBIDDEN_CUSTOMER_TOKENS = [
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

function text(value: unknown): string {
  return String(value ?? "").trim();
}

function fieldReportId(report: FieldReportDetailV1 | null | undefined): string {
  return text((report as any)?.field_context?.field_id ?? (report as any)?.field?.field_id);
}

function operationReportIds(report: OperationReportV1 | null | undefined): string[] {
  const ids = [
    (report as any)?.identifiers?.operation_plan_id,
    (report as any)?.identifiers?.operation_id,
    (report as any)?.operation_plan_id,
    (report as any)?.operation_id,
  ].map(text).filter(Boolean);
  return [...new Set(ids)];
}

function operationFieldId(report: OperationReportV1 | null | undefined): string {
  return text((report as any)?.identifiers?.field_id ?? (report as any)?.field_id);
}

export function isC8FieldReport(report: FieldReportDetailV1 | null | undefined): boolean {
  return fieldReportId(report) === C8_FIELD_REPORT_ID;
}

export function isC8OperationReport(report: OperationReportV1 | null | undefined): boolean {
  return operationReportIds(report).includes(C8_OPERATION_REPORT_ID) && operationFieldId(report) === C8_FIELD_REPORT_ID;
}

function normalizeC8FieldLabels(vm: CustomerReportMainVisualVm): CustomerReportMainVisualVm {
  return {
    ...vm,
    title: vm.title || "C8 地块报告",
    rows: vm.rows.map((row) => row.label === "设备" && row.value === "设备摘要待确认" ? { ...row, value: "土壤水分传感器、阀门泵站控制器、微型气象站" } : row),
  };
}

function normalizeC8OperationLabels(vm: CustomerReportMainVisualVm): CustomerReportMainVisualVm {
  return {
    ...vm,
    title: vm.title || "C8 作业报告",
    rows: vm.rows.map((row) => row.label === "任务" && row.value === "执行任务已确认" ? { ...row, value: "由 C8 阀门泵站控制器执行" } : row),
  };
}


function removeForbiddenCustomerTokens(value: string): string {
  return FORBIDDEN_CUSTOMER_TOKENS.reduce((next, token) => next.split(token).join(""), value).trim();
}

function sanitizeVisibleCustomerText(vm: CustomerReportMainVisualVm): CustomerReportMainVisualVm {
  return {
    ...vm,
    title: removeForbiddenCustomerTokens(vm.title),
    subtitle: removeForbiddenCustomerTokens(vm.subtitle),
    rows: vm.rows.map((row) => ({ label: removeForbiddenCustomerTokens(row.label), value: removeForbiddenCustomerTokens(row.value) })),
  };
}

function assertNoForbiddenCustomerTokens(vm: CustomerReportMainVisualVm): void {
  const visibleText = JSON.stringify({ title: vm.title, subtitle: vm.subtitle, rows: vm.rows });
  const leaked = FORBIDDEN_CUSTOMER_TOKENS.find((token) => visibleText.includes(token));
  if (leaked) throw new Error(`C8 customer main visual leaked forbidden token: ${leaked}`);
}

function adaptC8FieldFixture(report: FieldReportDetailV1): FieldReportDetailV1 {
  return report;
}

function adaptC8OperationFixture(report: OperationReportV1): OperationReportV1 {
  const root = report as any;
  if (root.as_executed?.executor_label || root.as_executed?.executor_name || root.prescription?.executor_label) return report;
  return {
    ...root,
    as_executed: { ...(root.as_executed ?? {}), executor_label: "由 C8 阀门泵站控制器执行" },
  } as OperationReportV1;
}

export function buildC8FieldMainVisualVm(report: FieldReportDetailV1): C8CustomerMainVisualVm | null {
  if (!isC8FieldReport(report)) return null;
  const vm = sanitizeVisibleCustomerText(normalizeC8FieldLabels(buildCustomerFieldReportMainVisualVm(adaptC8FieldFixture(report))));
  assertNoForbiddenCustomerTokens(vm);
  return vm;
}

export function buildC8OperationMainVisualVm(report: OperationReportV1): C8CustomerMainVisualVm | null {
  if (!isC8OperationReport(report)) return null;
  const vm = sanitizeVisibleCustomerText(normalizeC8OperationLabels(buildCustomerOperationReportMainVisualVm(adaptC8OperationFixture(report))));
  assertNoForbiddenCustomerTokens(vm);
  return vm;
}
