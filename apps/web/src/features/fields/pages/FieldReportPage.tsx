// apps/web/src/features/fields/pages/FieldReportPage.tsx
import React from "react";
import { Link, useParams } from "react-router-dom";
import { fetchFieldReport } from "../../../api/customerReports";
import { ProductBoundaryBanner, ProductDataTable, ProductEmptyState, ProductErrorState, ProductLoadingState, ProductMetricTile, ProductPageHeader, ProductPageShell, ProductScopeBar, ProductSectionCard, ProductStateBlock, ProductStatusBadge } from "../../../design-system/product";
import { localizedText, useLocale, type LocalizedCopy } from "../../../lib/locale";
import { CUSTOMER_COMMON_COPY, CUSTOMER_FIELDS_COPY, customerProductFallback, customerStatusLabel } from "../../../lib/productCopy/customerLocale";
import { buildFieldReportVm, type FieldReportPageVm } from "../../../viewmodels/fieldReportVm";

const COPY = {
  moved: { zh: "地块索引已迁移", en: "Field Index Moved" },
  movedLead: { zh: "请从客户门户打开地块报告索引。", en: "Open the field-report index from the Customer Portal." },
  title: { zh: "地块报告", en: "Field Report" },
  loading: { zh: "正在加载地块报告", en: "Loading Field Report" },
  unavailable: { zh: "地块报告暂不可用", en: "Field Report Unavailable" },
  export: { zh: "导出地块报告", en: "Export Field Report" },
  back: { zh: "返回地块报告", en: "Back to Field Reports" },
  nonclaim: { zh: "地块报告是客户只读报告，不暴露原始证据记录或命令流程。", en: "The field report is read-only customer reporting and exposes no raw evidence records or command workflow." },
  boundary: { zh: "客户安全地块报告", en: "Customer-safe Field Report" },
  boundaryLead: { zh: "本报告汇总地块状态、客户安全证据、近期作业和报告交付入口。", en: "This report summarizes field status, customer-safe evidence, recent operations, and report delivery entries." },
  field: { zh: "地块", en: "Field" },
  crop: { zh: "作物", en: "Crop" },
  stage: { zh: "阶段", en: "Stage" },
  statusSummary: { zh: "地块状态摘要", en: "Field Status Summary" },
  statusLead: { zh: "客户可读的状态、上下文和观测摘要。", en: "Customer-readable status, context, and observation summary." },
  currentStatus: { zh: "当前状态", en: "Current Status" },
  latestObservation: { zh: "最新观测", en: "Latest Observation" },
  recentOperations: { zh: "近期作业报告", en: "Recent Operation Reports" },
  reportEntries: { zh: "报告条目", en: "Report Entries" },
  evidence: { zh: "证据摘要", en: "Evidence Summary" },
  evidenceLead: { zh: "仅显示客户安全证据说明，不展示原始载荷或存储细节。", en: "Customer-safe evidence explanation only, without raw payloads or storage details." },
  evidenceLine: { zh: "客户证据摘要可用。", en: "Customer evidence summary available." },
  noEvidence: { zh: "暂无证据摘要", en: "No Evidence Summary" },
  noEvidenceLead: { zh: "当前没有可用的客户安全证据摘要。", en: "No customer-safe evidence summary is currently available." },
  recentLead: { zh: "该地块的客户可见作业历史。", en: "Customer-visible operation history for this field." },
  caption: { zh: "近期地块作业报告", en: "Recent Field Operation Reports" },
  noOperations: { zh: "暂无近期作业报告", en: "No Recent Operation Reports" },
  noOperationsLead: { zh: "当前没有关联到该地块的作业报告。", en: "No operation report is currently linked to this field." },
  operation: { zh: "作业", en: "Operation" },
  dataUnavailable: { zh: "暂不可用", en: "Unavailable" },
} as const satisfies Record<string, LocalizedCopy>;

function fieldStatus(tone: FieldReportPageVm["risk"]["tone"]): "available" | "partial" | "degraded" | "blocked" {
  return tone === "danger" ? "blocked" : tone === "warning" ? "degraded" : tone === "neutral" ? "partial" : "available";
}

export default function FieldReportPageRoute(): React.ReactElement {
  const { fieldId = "" } = useParams();
  const { locale } = useLocale();
  const t = React.useCallback((copy: LocalizedCopy) => localizedText(copy, locale), [locale]);
  const [vm, setVm] = React.useState<FieldReportPageVm | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [failed, setFailed] = React.useState(false);

  React.useEffect(() => {
    let active = true;
    void fetchFieldReport(fieldId)
      .then((data) => { if (active) { setVm(buildFieldReportVm(data)); setFailed(false); } })
      .catch(() => { if (active) { setVm(null); setFailed(true); } })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [fieldId]);

  if (fieldId === "index") return <ProductPageShell surface="customer" ariaLabel={t(COPY.moved)}><ProductStateBlock kind="urlOnly" surface="customer" title={t(COPY.moved)} description={t(COPY.movedLead)} /></ProductPageShell>;
  if (loading) return <ProductPageShell surface="customer" ariaLabel={t(COPY.title)}><ProductLoadingState surface="customer" label={t(COPY.loading)} description={t(CUSTOMER_COMMON_COPY.safeLoading)} /></ProductPageShell>;
  if (failed || !vm) return <ProductPageShell surface="customer" ariaLabel={t(COPY.unavailable)}><ProductErrorState surface="customer" title={t(COPY.unavailable)} message={t(CUSTOMER_COMMON_COPY.safeError)} /></ProductPageShell>;

  return (
    <ProductPageShell surface="customer" ariaLabel={t(COPY.title)} top={<ProductPageHeader eyebrow={`${t(CUSTOMER_COMMON_COPY.portalEyebrow)} / ${t(COPY.title)}`} title={vm.field.fieldName || t(COPY.title)} lead={t(COPY.statusLead)} metadata={`${t(CUSTOMER_COMMON_COPY.updatedAtPrefix)}: ${vm.generatedAtText}`} primaryAction={<Link className="customerButton customerButtonPrimary" to={vm.exportHref}>{t(COPY.export)}</Link>} secondaryActions={<Link className="customerButton" to="/customer/fields">{t(COPY.back)}</Link>} nonclaim={t(COPY.nonclaim)} />}>
      <ProductBoundaryBanner tone="readOnly" title={t(COPY.boundary)} description={t(COPY.boundaryLead)} />
      <ProductScopeBar surface="customer" items={[{ label: t(COPY.field), value: vm.field.fieldId }, { label: t(COPY.crop), value: customerProductFallback(vm.field.cropText, locale, COPY.dataUnavailable) }, { label: t(COPY.stage), value: customerProductFallback(vm.field.stageText, locale, COPY.dataUnavailable) }, { label: t(CUSTOMER_COMMON_COPY.updated), value: vm.generatedAtText }]} />
      <ProductSectionCard title={t(COPY.statusSummary)} subtitle={t(COPY.statusLead)} status={<ProductStatusBadge status={fieldStatus(vm.risk.tone)} label={fieldStatus(vm.risk.tone) === "blocked" ? customerStatusLabel("BLOCKED", locale) : fieldStatus(vm.risk.tone) === "degraded" ? customerStatusLabel("REQUIRES_REVIEW", locale) : customerStatusLabel("AVAILABLE", locale)} />}>
        <div className="customerDashboardGuidanceGrid">
          <ProductMetricTile label={t(COPY.currentStatus)} value={customerProductFallback(vm.cropContext.statusText, locale, COPY.dataUnavailable)} description={t(COPY.statusLead)} source={t(COPY.title)} />
          <ProductMetricTile label={t(COPY.latestObservation)} value={customerProductFallback(vm.diagnosis.latestObservationText, locale, COPY.dataUnavailable)} description={customerProductFallback(vm.diagnosis.dataQualityText, locale, COPY.evidenceLead)} source={t(COPY.title)} />
          <ProductMetricTile label={t(COPY.recentOperations)} value={String(vm.recentOperations.length)} unit={locale === "en-US" ? "reports" : "份报告"} description={t(COPY.recentLead)} source={t(COPY.title)} />
        </div>
      </ProductSectionCard>
      <ProductSectionCard title={t(COPY.evidence)} subtitle={t(COPY.evidenceLead)}>
        {vm.diagnosis.evidenceLines.length ? <ul className="customerList">{vm.diagnosis.evidenceLines.slice(0, 6).map((line, index) => <li key={`${index}-${line}`} className="customerListItem">{customerProductFallback(line, locale, COPY.evidenceLine)}</li>)}</ul> : <ProductEmptyState surface="customer" title={t(COPY.noEvidence)} description={t(COPY.noEvidenceLead)} />}
      </ProductSectionCard>
      <ProductSectionCard title={t(COPY.reportEntries)} subtitle={t(COPY.recentLead)}>
        <ProductDataTable<FieldReportPageVm["recentOperations"][number]> caption={t(COPY.caption)} rows={vm.recentOperations} getRowKey={(row) => row.operationId || row.title} emptyState={<ProductEmptyState surface="customer" title={t(COPY.noOperations)} description={t(COPY.noOperationsLead)} />} mobileFallbackNote={t(CUSTOMER_FIELDS_COPY.mobileNote)} columns={[
          { key: "operation", header: t(COPY.operation), render: (row) => <Link to={row.href}>{row.title}</Link> },
          { key: "status", header: t(CUSTOMER_COMMON_COPY.reportStatus), render: (row) => <ProductStatusBadge status="readOnly" label={customerStatusLabel(row.statusText, locale)} /> },
          { key: "evidence", header: t(COPY.evidence), render: (row) => customerProductFallback(row.evidenceText, locale, COPY.evidenceLine) },
          { key: "updated", header: t(CUSTOMER_COMMON_COPY.updated), render: (row) => row.updatedAtText },
        ]} />
      </ProductSectionCard>
    </ProductPageShell>
  );
}
