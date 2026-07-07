// apps/web/src/features/customer/pages/CustomerReportExportPage.tsx
import React from "react";
import { useLocation, useParams } from "react-router-dom";
import { fetchCustomerDashboardAggregate, fetchFieldReport, fetchOperationReport } from "../../../api/customerReports";
import { ProductErrorState, ProductLoadingState, ProductPrintReportScaffold, ProductStatusBadge } from "../../../design-system/product";
import { localizedText, useLocale, type LocalizedCopy } from "../../../lib/locale";
import { CUSTOMER_COMMON_COPY, customerProductFallback, customerStatusLabel } from "../../../lib/productCopy/customerLocale";
import { buildCustomerDashboardVm } from "../../../viewmodels/customerDashboardVm";
import { buildFieldReportVm } from "../../../viewmodels/fieldReportVm";
import { buildOperationReportVm } from "../../../viewmodels/operationReportVm";

export const F1D_CUSTOMER_EXPORT_COPY = [
  "Dashboard", "Fields", "Field Report", "Operations", "Operation Report", "Reports", "Export", "Report", "Download", "Unavailable", "No authorized fields", "Authorized scope",
  "经营总览", "地块", "地块报告", "作业", "作业报告", "报告", "导出", "下载", "不可用", "暂无授权地块", "授权范围",
] as const;

const COPY = {
  fieldTitle: { zh: "地块报告", en: "Field Report" },
  operationTitle: { zh: "作业报告", en: "Operation Report" },
  dashboardTitle: { zh: "经营总览报告", en: "Operating Overview Report" },
  subtitle: { zh: "客户打印交付视图", en: "Customer print delivery view" },
  loading: { zh: "正在加载客户报告导出", en: "Loading Customer Report Export" },
  unavailable: { zh: "报告导出暂不可用", en: "Report Export Unavailable" },
  summary: { zh: "报告摘要", en: "Report Summary" },
  item: { zh: "项目", en: "Item" },
  value: { zh: "内容", en: "Value" },
  status: { zh: "状态", en: "Status" },
  field: { zh: "地块", en: "Field" },
  operation: { zh: "作业", en: "Operation" },
  section: { zh: "章节", en: "Section" },
  updated: { zh: "更新时间", en: "Updated" },
  noRows: { zh: "暂无可交付记录", en: "No deliverable records available" },
  dataUnavailable: { zh: "暂不可用", en: "Unavailable" },
  footer: { zh: "仅用于客户打印交付；交互控制、内部审批和诊断工具不属于本导出。", en: "Customer print delivery only; interactive controls, internal approval, and diagnostic tools are not part of this export." },
} as const satisfies Record<string, LocalizedCopy>;

type ExportState = { title: string; subtitle: string; generatedAt: string; backTo: string; rows: React.ReactNode[][]; headers: string[] };

function ExportTable({ state, emptyText }: { state: ExportState; emptyText: string }): React.ReactElement {
  if (!state.rows.length) return <p className="customerMetricLabel customerSpacingTopSm">{emptyText}</p>;
  return <table className="printTable customerSpacingTopSm"><thead><tr>{state.headers.map((header) => <th key={header}>{header}</th>)}</tr></thead><tbody>{state.rows.map((row, index) => <tr key={index}>{row.map((cell, cellIndex) => <td key={cellIndex}>{cell}</td>)}</tr>)}</tbody></table>;
}

export default function CustomerReportExportPage(): React.ReactElement {
  const { fieldId = "", operationId = "" } = useParams();
  const location = useLocation();
  const { locale } = useLocale();
  const t = React.useCallback((copy: LocalizedCopy) => localizedText(copy, locale), [locale]);
  const mode = location.pathname.includes("/customer/fields/") ? "field" : location.pathname.includes("/customer/operations/") ? "operation" : "dashboard";
  const [state, setState] = React.useState<ExportState | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [failed, setFailed] = React.useState(false);

  React.useEffect(() => {
    let active = true;
    setState(null);
    setLoading(true);
    const load = async (): Promise<ExportState> => {
      if (mode === "field") {
        const vm = buildFieldReportVm(await fetchFieldReport(fieldId));
        return {
          title: t(COPY.fieldTitle), subtitle: vm.field.fieldName || t(COPY.subtitle), generatedAt: vm.generatedAtText, backTo: `/customer/fields/${encodeURIComponent(fieldId)}`,
          headers: [t(COPY.item), t(COPY.value)],
          rows: [[t(COPY.field), vm.field.fieldName], [t(COPY.status), <ProductStatusBadge key="field-status" status="readOnly" label={customerStatusLabel(vm.risk.levelLabel, locale)} />], [t(COPY.updated), vm.generatedAtText]],
        };
      }
      if (mode === "operation") {
        const vm = buildOperationReportVm(await fetchOperationReport(operationId));
        return {
          title: vm.operation.title || t(COPY.operationTitle), subtitle: t(COPY.subtitle), generatedAt: vm.generatedAtText, backTo: `/customer/operations/${encodeURIComponent(operationId)}`,
          headers: [t(COPY.section), t(COPY.status), t(COPY.summary)],
          rows: vm.sections.map((section) => [customerProductFallback(section.title, locale, COPY.section), <ProductStatusBadge key={section.key} status="readOnly" label={customerStatusLabel(section.status, locale)} />, customerProductFallback(section.summary || section.emptyState?.description, locale, COPY.dataUnavailable)]),
        };
      }
      const vm = buildCustomerDashboardVm(await fetchCustomerDashboardAggregate());
      return {
        title: t(COPY.dashboardTitle), subtitle: t(COPY.subtitle), generatedAt: vm.generatedAtText, backTo: "/customer/dashboard",
        headers: [t(COPY.item), t(COPY.value), t(COPY.status)],
        rows: vm.kpis.slice(0, 5).map((item) => [item.label, `${item.value}${item.unit ? ` ${item.unit}` : ""}`, <ProductStatusBadge key={item.key} status="readOnly" label={customerStatusLabel(item.tone, locale)} />]),
      };
    };
    void load().then((next) => { if (active) { setState(next); setFailed(false); } }).catch(() => { if (active) { setState(null); setFailed(true); } }).finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [fieldId, operationId, mode, locale, t]);

  if (loading) return <div className="customerReportCanvas"><div className="customerReportSheet"><ProductLoadingState surface="customer" label={t(COPY.loading)} description={t(CUSTOMER_COMMON_COPY.safeLoading)} /></div></div>;
  if (failed || !state) return <div className="customerReportCanvas"><div className="customerReportSheet"><ProductErrorState surface="customer" title={t(COPY.unavailable)} message={t(CUSTOMER_COMMON_COPY.safeError)} /></div></div>;

  return <ProductPrintReportScaffold title={state.title} subtitle={state.subtitle} generatedAt={state.generatedAt || "--"} backTo={state.backTo} ariaLabel={state.title}><section className="customerCard"><h2 className="customerCardTitle">{t(COPY.summary)}</h2><ExportTable state={state} emptyText={t(COPY.noRows)} /></section><footer className="customerMetricLabel customerSpacingTopMd">{t(COPY.footer)}</footer></ProductPrintReportScaffold>;
}
