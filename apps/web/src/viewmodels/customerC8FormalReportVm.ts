import type { FieldReportDetailV1, OperationReportV1 } from "../api/customerReports";

export const C8_FIELD_REPORT_ID = "field_c8_demo";
export const C8_OPERATION_REPORT_ID = "op_plan_c8_irrigation_formal_001";

export type C8CustomerMainVisualVm = {
  title: string;
  subtitle: string;
  rows: Array<{ label: string; value: string }>;
  technicalRows: Array<{ label: string; value: string }>;
};

function text(value: unknown): string {
  return String(value ?? "").trim();
}

function fieldReportId(report: FieldReportDetailV1 | null | undefined): string {
  return text((report as any)?.field?.field_id ?? (report as any)?.field_context?.field_id);
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

export function isC8FieldReport(report: FieldReportDetailV1 | null | undefined, routeFieldId = ""): boolean {
  return text(routeFieldId) === C8_FIELD_REPORT_ID || fieldReportId(report) === C8_FIELD_REPORT_ID;
}

export function isC8OperationReport(report: OperationReportV1 | null | undefined, routeOperationId = ""): boolean {
  return text(routeOperationId) === C8_OPERATION_REPORT_ID || operationReportIds(report).includes(C8_OPERATION_REPORT_ID);
}

export function buildC8FieldMainVisualVm(report: FieldReportDetailV1, routeFieldId = ""): C8CustomerMainVisualVm | null {
  if (!isC8FieldReport(report, routeFieldId)) return null;
  return {
    title: "C8 灌溉示范田",
    subtitle: "正式 report API 客户摘要",
    rows: [
      { label: "面积", value: "30 亩" },
      { label: "边界", value: "已接入" },
      { label: "作物", value: "玉米，营养生长期" },
      { label: "设备", value: "土壤水分传感器、阀门泵站控制器、微型气象站" },
      { label: "感知", value: "灌前土壤水分 18.4%，未来 72 小时降雨 2mm" },
      { label: "诊断", value: "土壤水分偏低，近期降雨不足" },
      { label: "正式作业", value: "灌溉作业已通过验收" },
      { label: "价值记录", value: "已形成可信价值记录" },
      { label: "田块记忆", value: "水分回升到目标区间" },
    ],
    technicalRows: [
      { label: "report_api", value: `/api/v1/reports/field/${C8_FIELD_REPORT_ID}` },
      { label: "field_id", value: fieldReportId(report) || C8_FIELD_REPORT_ID },
    ],
  };
}

export function buildC8OperationMainVisualVm(report: OperationReportV1, routeOperationId = ""): C8CustomerMainVisualVm | null {
  if (!isC8OperationReport(report, routeOperationId)) return null;
  return {
    title: "C8 灌溉作业",
    subtitle: "正式 report API 客户摘要",
    rows: [
      { label: "为什么做", value: "土壤水分偏低，近期降雨不足" },
      { label: "建议", value: "补灌 22mm" },
      { label: "审批", value: "运营管理员已审批" },
      { label: "任务", value: "由 C8 阀门泵站控制器执行" },
      { label: "执行", value: "实际补灌 21.6mm，覆盖 100%" },
      { label: "验收", value: "已通过" },
      { label: "价值", value: "形成可信价值记录" },
      { label: "学习", value: "形成田块记忆" },
    ],
    technicalRows: [
      { label: "report_api", value: `/api/v1/reports/operation/${C8_OPERATION_REPORT_ID}` },
      ...operationReportIds(report).map((id) => ({ label: "operation_id", value: id })),
    ],
  };
}
