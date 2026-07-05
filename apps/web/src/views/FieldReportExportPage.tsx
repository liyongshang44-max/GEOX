// apps/web/src/views/FieldReportExportPage.tsx
import React from "react";
import { useParams } from "react-router-dom";
import { fetchFieldReport, type FieldReportDetailV1 } from "../api/customerReports";
import { FieldExportBlocks } from "../components/customer/CustomerExportBlocks";
import PrintReportScaffold from "../components/customer/PrintReportScaffold";
import { localizedText, useLocale } from "../lib/locale";
import { buildFieldReportVm, type FieldReportPageVm } from "../viewmodels/fieldReportVm";

const COPY = {
  loading: { zh: "地块导出页加载中...", en: "Field export page is loading..." },
  failed: { zh: "地块导出页加载失败", en: "Field export page failed to load" },
  noData: { zh: "暂无数据", en: "No data" },
  title: { zh: "GEOX 地块报告", en: "GEOX Field Report" },
  fieldNamePending: { zh: "地块名称待补充", en: "Field name pending" },
};

export default function FieldReportExportPage(): React.ReactElement {
  const { locale } = useLocale();
  const { fieldId = "" } = useParams();
  const [vm, setVm] = React.useState<FieldReportPageVm | null>(null);
  const [report, setReport] = React.useState<FieldReportDetailV1 | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState("");

  React.useEffect(() => {
    let alive = true;
    setLoading(true);
    setError("");
    void fetchFieldReport(fieldId)
      .then((nextReport) => {
        if (!alive) return;
        setReport(nextReport);
        setVm(buildFieldReportVm(nextReport));
      })
      .catch((e: unknown) => {
        if (!alive) return;
        setReport(null);
        setVm(null);
        setError(String(e instanceof Error ? e.message : localizedText(COPY.failed, locale)));
      })
      .finally(() => {
        if (!alive) return;
        setLoading(false);
      });
    return () => { alive = false; };
  }, [fieldId, locale]);

  if (loading) return <div className="customerReportCanvas"><div className="customerReportSheet">{localizedText(COPY.loading, locale)}</div></div>;
  if (error || !vm) return <div className="customerReportCanvas"><div className="customerReportSheet">{localizedText(COPY.failed, locale)}：{error || localizedText(COPY.noData, locale)}</div></div>;

  return (
    <PrintReportScaffold
      title={localizedText(COPY.title, locale)}
      subtitle={vm.field.fieldName || localizedText(COPY.fieldNamePending, locale)}
      generatedAt={vm.generatedAtText}
      backTo={`/customer/fields/${encodeURIComponent(fieldId)}`}
    >
      <FieldExportBlocks vm={vm} report={report} />
    </PrintReportScaffold>
  );
}
