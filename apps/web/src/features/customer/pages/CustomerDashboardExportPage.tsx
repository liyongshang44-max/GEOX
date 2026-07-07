// apps/web/src/features/customer/pages/CustomerDashboardExportPage.tsx
import React from "react";
import { fetchCustomerDashboardAggregate } from "../../../api/customerReports";
import { ProductErrorState, ProductLoadingState, ProductPrintReportScaffold, ProductStatusBadge } from "../../../design-system/product";
import { localizedText, useLocale, type LocalizedCopy } from "../../../lib/locale";
import { CUSTOMER_COMMON_COPY, CUSTOMER_DASHBOARD_COPY, customerStatusLabel } from "../../../lib/productCopy/customerLocale";
import { buildCustomerDashboardVm, type CustomerDashboardPageVm } from "../../../viewmodels/customerDashboardVm";

const COPY = {
  title: { zh: "经营总览报告", en: "Operating Overview Report" },
  subtitle: { zh: "客户打印交付视图", en: "Customer print delivery view" },
  loading: { zh: "正在加载经营总览报告", en: "Loading Operating Overview Report" },
  unavailable: { zh: "经营总览导出暂不可用", en: "Operating Overview Export Unavailable" },
  summary: { zh: "报告摘要", en: "Report Summary" },
  metric: { zh: "指标", en: "Metric" },
  value: { zh: "数值", en: "Value" },
  status: { zh: "状态", en: "Status" },
  fields: { zh: "地块报告条目", en: "Field Report Entries" },
  operations: { zh: "作业报告条目", en: "Operation Report Entries" },
  name: { zh: "名称", en: "Name" },
  updated: { zh: "更新时间", en: "Updated" },
  noRows: { zh: "暂无记录", en: "No records available" },
  footer: { zh: "仅用于客户报告交付；本导出不包含内部控制、审批或诊断工具。", en: "Customer report delivery only; this export contains no internal control, approval, or diagnostic tooling." },
} as const satisfies Record<string, LocalizedCopy>;

function PrintTable({ headers, rows, emptyText }: { headers: string[]; rows: React.ReactNode[][]; emptyText: string }): React.ReactElement {
  if (!rows.length) return <p className="customerMetricLabel customerSpacingTopSm">{emptyText}</p>;
  return <table className="printTable customerSpacingTopSm"><thead><tr>{headers.map((header) => <th key={header}>{header}</th>)}</tr></thead><tbody>{rows.map((row, index) => <tr key={index}>{row.map((cell, cellIndex) => <td key={cellIndex}>{cell}</td>)}</tr>)}</tbody></table>;
}

export default function CustomerDashboardExportPage(): React.ReactElement {
  const { locale } = useLocale();
  const t = React.useCallback((copy: LocalizedCopy) => localizedText(copy, locale), [locale]);
  const [vm, setVm] = React.useState<CustomerDashboardPageVm | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [failed, setFailed] = React.useState(false);

  React.useEffect(() => {
    let active = true;
    void fetchCustomerDashboardAggregate()
      .then((data) => { if (active) { setVm(buildCustomerDashboardVm(data)); setFailed(false); } })
      .catch(() => { if (active) { setVm(null); setFailed(true); } })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, []);

  if (loading) return <div className="customerReportCanvas"><div className="customerReportSheet"><ProductLoadingState surface="customer" label={t(COPY.loading)} description={t(CUSTOMER_COMMON_COPY.safeLoading)} /></div></div>;
  if (failed || !vm) return <div className="customerReportCanvas"><div className="customerReportSheet"><ProductErrorState surface="customer" title={t(COPY.unavailable)} message={t(CUSTOMER_COMMON_COPY.safeError)} /></div></div>;

  const kpiRows = vm.kpis.slice(0, 5).map((item) => [item.label, `${item.value}${item.unit ? ` ${item.unit}` : ""}`, <ProductStatusBadge key={item.key} status="readOnly" label={customerStatusLabel(item.tone, locale)} />]);
  const fieldRows = vm.topRiskFields.slice(0, 5).map((item) => [item.fieldName, customerStatusLabel(item.riskTone, locale)]);
  const operationRows = vm.recentOperations.slice(0, 5).map((item) => [item.operationName, item.fieldName, item.updatedAtText, customerStatusLabel(item.stateText, locale)]);

  return (
    <ProductPrintReportScaffold title={t(COPY.title)} subtitle={t(COPY.subtitle)} generatedAt={vm.generatedAtText} backTo="/customer/dashboard" ariaLabel={t(COPY.title)}>
      <section className="customerCard"><h2 className="customerCardTitle">{t(COPY.summary)}</h2><PrintTable headers={[t(COPY.metric), t(COPY.value), t(COPY.status)]} rows={kpiRows} emptyText={t(COPY.noRows)} /></section>
      <section className="customerCard"><h2 className="customerCardTitle">{t(COPY.fields)}</h2><PrintTable headers={[t(COPY.name), t(COPY.status)]} rows={fieldRows} emptyText={t(COPY.noRows)} /></section>
      <section className="customerCard"><h2 className="customerCardTitle">{t(COPY.operations)}</h2><PrintTable headers={[t(COPY.name), t(CUSTOMER_DASHBOARD_COPY.fieldReports), t(COPY.updated), t(COPY.status)]} rows={operationRows} emptyText={t(COPY.noRows)} /></section>
      <footer className="customerMetricLabel customerSpacingTopMd">{t(COPY.footer)}</footer>
    </ProductPrintReportScaffold>
  );
}
