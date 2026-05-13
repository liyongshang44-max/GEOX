import React from "react";
import { useParams } from "react-router-dom";
import { fetchFieldReport, type FieldReportDetailV1 } from "../api/customerReports";
import { buildFieldReportVm, type FieldReportPageVm } from "../viewmodels/fieldReportVm";
import { FieldExportBlocks } from "../components/customer/CustomerExportBlocks";
import PrintReportScaffold from "../components/customer/PrintReportScaffold";

export default function FieldReportExportPage(): React.ReactElement {
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
        setError(String(e instanceof Error ? e.message : "加载失败"));
      })
      .finally(() => {
        if (!alive) return;
        setLoading(false);
      });
    return () => { alive = false; };
  }, [fieldId]);

  if (loading) return <div className="customerReportCanvas"><div className="customerReportSheet">地块导出页加载中...</div></div>;
  if (error || !vm) return <div className="customerReportCanvas"><div className="customerReportSheet">地块导出页加载失败：{error || "暂无数据"}</div></div>;

  return (
    <PrintReportScaffold
      title="GEOX 地块报告"
      subtitle={vm.field.fieldName || "地块名称待补充"}
      generatedAt={vm.generatedAtText}
      backTo={`/customer/fields/${encodeURIComponent(fieldId)}`}
    >
      <FieldExportBlocks vm={vm} report={report} />
    </PrintReportScaffold>
  );
}
