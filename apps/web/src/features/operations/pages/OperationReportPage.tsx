// apps/web/src/features/operations/pages/OperationReportPage.tsx
import React from "react";
import { Link, useParams } from "react-router-dom";
import { fetchOperationReport } from "../../../api/customerReports";
import { ProductBoundaryBanner, ProductDataTable, ProductEmptyState, ProductErrorState, ProductLoadingState, ProductMetricTile, ProductPageHeader, ProductPageShell, ProductScopeBar, ProductSectionCard, ProductStateBlock, ProductStatusBadge } from "../../../design-system/product";
import { localizedText, useLocale, type LocaleCode, type LocalizedCopy } from "../../../lib/locale";
import { CUSTOMER_COMMON_COPY, CUSTOMER_OPERATIONS_COPY, customerProductFallback, customerStatusLabel } from "../../../lib/productCopy/customerLocale";
import { buildOperationReportVm, type OperationReportPageVm } from "../../../viewmodels/operationReportVm";

const COPY = {
  moved: { zh: "作业索引已迁移", en: "Operation Index Moved" },
  movedLead: { zh: "请从客户门户打开作业报告索引。", en: "Open operation reports from the Customer Portal." },
  title: { zh: "作业报告", en: "Operation Report" },
  loading: { zh: "正在加载作业报告", en: "Loading Operation Report" },
  unavailable: { zh: "作业报告暂不可用", en: "Operation Report Unavailable" },
  export: { zh: "导出作业报告", en: "Export Operation Report" },
  back: { zh: "返回作业报告", en: "Back to Operation Reports" },
  nonclaim: { zh: "作业报告是客户只读报告界面，不提供执行或写入能力。", en: "The operation report is a read-only Customer Portal surface and provides no execution or write capability." },
  boundary: { zh: "客户安全作业报告", en: "Customer-safe Operation Report" },
  boundaryLead: { zh: "本报告汇总作业、里程碑、证据摘要和交付状态供客户回查。", en: "This report summarizes the operation, milestones, evidence summary, and delivery status for customer review." },
  operation: { zh: "作业", en: "Operation" },
  field: { zh: "地块", en: "Field" },
  operationSummary: { zh: "作业摘要", en: "Operation Summary" },
  operationSummaryLead: { zh: "客户可读的作业状态与上下文。", en: "Customer-readable operation status and context." },
  finalStatus: { zh: "最终状态", en: "Final Status" },
  evidenceSummary: { zh: "证据摘要", en: "Evidence Summary" },
  deliveryStatus: { zh: "交付状态", en: "Delivery Status" },
  reportUpdated: { zh: "报告更新时间", en: "Report updated timestamp" },
  reportSections: { zh: "报告章节", en: "Report Sections" },
  reportSectionsLead: { zh: "客户只读报告章节。", en: "Read-only customer report sections." },
  section: { zh: "章节", en: "Section" },
  status: { zh: "状态", en: "Status" },
  caption: { zh: "作业报告章节", en: "Operation Report Sections" },
  noSections: { zh: "暂无报告章节", en: "No Report Sections" },
  noSectionsLead: { zh: "当前没有可用的客户报告章节。", en: "No customer report sections are currently available." },
  mobileNote: { zh: "在窄屏中可横向滚动查看各章节。", en: "On narrow screens, scroll horizontally to review each section." },
  timeline: { zh: "里程碑摘要", en: "Milestone Summary" },
  timelineLead: { zh: "客户可读的作业里程碑顺序。", en: "Customer-readable operation milestone sequence." },
  noTimeline: { zh: "暂无里程碑摘要", en: "No Milestone Summary" },
  noTimelineLead: { zh: "当前没有可用的客户里程碑摘要。", en: "No customer milestone summary is currently available." },
  genericSection: { zh: "报告内容", en: "Report Content" },
  genericSummary: { zh: "暂无摘要。", en: "No summary available." },
  dataUnavailable: { zh: "暂不可用", en: "Unavailable" },
} as const satisfies Record<string, LocalizedCopy>;

function sectionTone(status: string): "available" | "partial" | "degraded" | "disabled" {
  return status === "AVAILABLE" ? "available" : status === "PENDING" ? "degraded" : status === "NOT_APPLICABLE" ? "disabled" : "partial";
}

function sectionLabel(status: string, locale: LocaleCode): string {
  if (status === "AVAILABLE") return customerStatusLabel("AVAILABLE", locale);
  if (status === "PENDING") return customerStatusLabel("REQUIRES_REVIEW", locale);
  if (status === "NOT_APPLICABLE") return localizedText({ zh: "不适用", en: "Not Applicable" }, locale);
  return customerStatusLabel("UNAVAILABLE", locale);
}

function milestoneStatus(status: OperationReportPageVm["timeline"][number]["status"], locale: LocaleCode): string {
  const copy: Record<string, LocalizedCopy> = {
    DONE: { zh: "已完成", en: "Completed" },
    PENDING: { zh: "等待复核", en: "Awaiting Review" },
    MISSING: { zh: "暂不可用", en: "Unavailable" },
    NOT_APPLICABLE: { zh: "不适用", en: "Not Applicable" },
    AVAILABLE: { zh: "可查看", en: "Available to View" },
  };
  return localizedText(copy[status] ?? copy.AVAILABLE, locale);
}

export default function OperationReportPageRoute(): React.ReactElement {
  const { operationId = "" } = useParams();
  const { locale } = useLocale();
  const t = React.useCallback((copy: LocalizedCopy) => localizedText(copy, locale), [locale]);
  const [vm, setVm] = React.useState<OperationReportPageVm | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [failed, setFailed] = React.useState(false);

  React.useEffect(() => {
    let active = true;
    void fetchOperationReport(operationId)
      .then((data) => { if (active) { setVm(buildOperationReportVm(data)); setFailed(false); } })
      .catch(() => { if (active) { setVm(null); setFailed(true); } })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [operationId]);

  if (operationId === "index") return <ProductPageShell surface="customer" ariaLabel={t(COPY.moved)}><ProductStateBlock kind="urlOnly" surface="customer" title={t(COPY.moved)} description={t(COPY.movedLead)} /></ProductPageShell>;
  if (loading) return <ProductPageShell surface="customer" ariaLabel={t(COPY.title)}><ProductLoadingState surface="customer" label={t(COPY.loading)} description={t(CUSTOMER_COMMON_COPY.safeLoading)} /></ProductPageShell>;
  if (failed || !vm) return <ProductPageShell surface="customer" ariaLabel={t(COPY.unavailable)}><ProductErrorState surface="customer" title={t(COPY.unavailable)} message={t(CUSTOMER_COMMON_COPY.safeError)} /></ProductPageShell>;

  const operationTitle = vm.header.title || vm.operation.title || t(COPY.title);
  return (
    <ProductPageShell surface="customer" ariaLabel={t(COPY.title)} top={<ProductPageHeader eyebrow={`${t(CUSTOMER_COMMON_COPY.portalEyebrow)} / ${t(COPY.title)}`} title={operationTitle} lead={t(COPY.operationSummaryLead)} metadata={`${t(CUSTOMER_COMMON_COPY.updatedAtPrefix)}: ${vm.generatedAtText}`} primaryAction={<Link className="customerButton customerButtonPrimary" to={vm.exportHref}>{t(COPY.export)}</Link>} secondaryActions={<Link className="customerButton" to="/customer/operations">{t(COPY.back)}</Link>} nonclaim={t(COPY.nonclaim)} />}>
      <ProductBoundaryBanner tone="readOnly" title={t(COPY.boundary)} description={t(COPY.boundaryLead)} />
      <ProductScopeBar surface="customer" items={[{ label: t(COPY.operation), value: vm.operation.operationId }, { label: t(COPY.field), value: vm.operation.fieldName }, { label: t(CUSTOMER_COMMON_COPY.updated), value: vm.generatedAtText }]} />
      <ProductSectionCard title={t(COPY.operationSummary)} subtitle={t(COPY.operationSummaryLead)} status={<ProductStatusBadge status="readOnly" label={customerStatusLabel(vm.operation.finalStatusLabel, locale)} />}>
        <div className="customerDashboardGuidanceGrid">
          <ProductMetricTile label={t(COPY.finalStatus)} value={customerStatusLabel(vm.conclusion.finalStatusText, locale)} description={customerProductFallback(vm.conclusion.resultText, locale, COPY.operationSummaryLead)} source={t(COPY.title)} />
          <ProductMetricTile label={t(COPY.evidenceSummary)} value={customerStatusLabel(vm.evidenceSummary.statusText, locale)} description={customerProductFallback(vm.evidenceSummary.summary, locale, COPY.boundaryLead)} source={t(COPY.title)} />
          <ProductMetricTile label={t(COPY.deliveryStatus)} value={vm.operation.updatedAtText} description={t(COPY.reportUpdated)} source={t(COPY.title)} />
        </div>
      </ProductSectionCard>
      <ProductSectionCard title={t(COPY.reportSections)} subtitle={t(COPY.reportSectionsLead)}>
        <ProductDataTable<OperationReportPageVm["sections"][number]> caption={t(COPY.caption)} rows={vm.sections} getRowKey={(row) => row.key} emptyState={<ProductEmptyState surface="customer" title={t(COPY.noSections)} description={t(COPY.noSectionsLead)} />} mobileFallbackNote={t(COPY.mobileNote)} columns={[
          { key: "section", header: t(COPY.section), render: (row) => customerProductFallback(row.title, locale, COPY.genericSection) },
          { key: "status", header: t(COPY.status), render: (row) => <ProductStatusBadge status={sectionTone(row.status)} label={sectionLabel(row.status, locale)} /> },
          { key: "summary", header: t(CUSTOMER_COMMON_COPY.summary), render: (row) => customerProductFallback(row.summary || row.emptyState?.description, locale, COPY.genericSummary) },
        ]} />
      </ProductSectionCard>
      <ProductSectionCard title={t(COPY.timeline)} subtitle={t(COPY.timelineLead)}>
        {vm.timeline.length ? <ul className="customerList">{vm.timeline.map((item) => <li key={item.key} className="customerListItem"><strong>{customerProductFallback(item.label, locale, COPY.genericSection)}</strong> — {item.timeText || milestoneStatus(item.status, locale)}</li>)}</ul> : <ProductEmptyState surface="customer" title={t(COPY.noTimeline)} description={t(COPY.noTimelineLead)} />}
      </ProductSectionCard>
    </ProductPageShell>
  );
}
