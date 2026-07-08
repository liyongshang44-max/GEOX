// apps/web/src/features/fields/pages/FieldReportExportPage.tsx
import React from "react";
import { useParams } from "react-router-dom";
import { fetchFieldReport } from "../../../api/customerReports";
import { ProductErrorState, ProductLoadingState, ProductPrintReportScaffold, ProductStatusBadge } from "../../../design-system/product";
import { localizedText, useLocale, type LocalizedCopy } from "../../../lib/locale";
import { CUSTOMER_COMMON_COPY, customerProductFallback, customerStatusLabel } from "../../../lib/productCopy/customerLocale";
import { buildFieldReportVm, type FieldReportPageVm } from "../../../viewmodels/fieldReportVm";

const COPY = {
  title: { zh: "地块报告", en: "Field Report" },
  subtitle: { zh: "客户打印交付视图", en: "Customer print delivery view" },
  loading: { zh: "正在加载地块报告导出", en: "Loading Field Report Export" },
  unavailable: { zh: "地块报告导出暂不可用", en: "Field Report Export Unavailable" },
  summary: { zh: "地块摘要", en: "Field Summary" },
  item: { zh: "项目", en: "Item" },
  value: { zh: "内容", en: "Value" },
  fieldName: { zh: "地块名称", en: "Field Name" },
  crop: { zh: "作物", en: "Crop" },
  stage: { zh: "阶段", en: "Stage" },
  status: { zh: "报告状态", en: "Report Status" },
  operations: { zh: "近期作业报告", en: "Recent Operation Reports" },
  evidence: { zh: "证据摘要", en: "Evidence Summary" },
  noEvidence: { zh: "暂无客户安全证据摘要。", en: "No customer-safe evidence summary is available." },
  unavailableValue: { zh: "暂不可用", en: "Unavailable" },
  footer: { zh: "仅用于客户打印交付；交互控制不属于本导出。", en: "Customer print delivery only; interactive controls are not part of this export." },
} as const satisfies Record<string, LocalizedCopy>;

export default function FieldReportExportPage(): React.ReactElement {
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

  if (loading) return <div className="customerReportCanvas"><div className="customerReportSheet"><ProductLoadingState surface="customer" label={t(COPY.loading)} description={t(CUSTOMER_COMMON_COPY.safeLoading)} /></div></div>;
  if (failed || !vm) return <div className="customerReportCanvas"><div className="customerReportSheet"><ProductErrorState surface="customer" title={t(COPY.unavailable)} message={t(CUSTOMER_COMMON_COPY.safeError)} /></div></div>;

  const rows: Array<[string, React.ReactNode]> = [
    [t(COPY.fieldName), vm.field.fieldName],
    [t(COPY.crop), customerProductFallback(vm.field.cropText, locale, COPY.unavailableValue)],
    [t(COPY.stage), customerProductFallback(vm.field.stageText, locale, COPY.unavailableValue)],
    [t(COPY.status), <ProductStatusBadge key="status" status="readOnly" label={customerStatusLabel(vm.risk.levelLabel, locale)} />],
    [t(COPY.operations), String(vm.recentOperations.length)],
  ];

  return (
    <ProductPrintReportScaffold title={t(COPY.title)} subtitle={vm.field.fieldName || t(COPY.subtitle)} generatedAt={vm.generatedAtText} backTo={`/customer/fields/${encodeURIComponent(fieldId)}`} ariaLabel={t(COPY.title)}>
      <section className="customerCard"><h2 className="customerCardTitle">{t(COPY.summary)}</h2><table className="printTable customerSpacingTopSm"><thead><tr><th>{t(COPY.item)}</th><th>{t(COPY.value)}</th></tr></thead><tbody>{rows.map(([label, value]) => <tr key={label}><td>{label}</td><td>{value}</td></tr>)}</tbody></table></section>
      <section className="customerCard"><h2 className="customerCardTitle">{t(COPY.evidence)}</h2>{vm.diagnosis.evidenceLines.length ? <ul className="customerList customerSpacingTopSm">{vm.diagnosis.evidenceLines.slice(0, 6).map((line, index) => <li key={`${index}-${line}`} className="customerListItem">{customerProductFallback(line, locale, COPY.noEvidence)}</li>)}</ul> : <p className="customerMetricLabel customerSpacingTopSm">{t(COPY.noEvidence)}</p>}</section>
      <footer className="customerMetricLabel customerSpacingTopMd">{t(COPY.footer)}</footer>
    </ProductPrintReportScaffold>
  );
}
