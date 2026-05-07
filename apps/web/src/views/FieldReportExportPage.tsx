import React from "react";
import { useParams } from "react-router-dom";
import { fetchFieldReport } from "../api/customerReports";
import { buildFieldReportVm, type FieldReportPageVm } from "../viewmodels/fieldReportVm";
import { FieldExportBlocks } from "../components/customer/CustomerExportBlocks";

export default function FieldReportExportPage(): React.ReactElement {
  const { fieldId = "" } = useParams();
  const [vm, setVm] = React.useState<FieldReportPageVm | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState("");

  React.useEffect(() => {
    let alive = true;
    setLoading(true);
    setError("");
    void fetchFieldReport(fieldId)
      .then((report) => {
        if (!alive) return;
        setVm(buildFieldReportVm(report));
      })
      .catch((e: unknown) => {
        if (!alive) return;
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
    <div className="customerReportCanvas">
      <div className="customerReportSheet printPage">
        <header className="customerReportHeader">
          <div className="customerHeroTop">
            <div>
              <div className="customerEyebrow">GEOX</div>
              <h1 className="customerTitle">{vm.field.fieldName || "地块报告"}</h1>
              <p className="customerSubtitle">生成时间：{vm.generatedAtText}</p>
            </div>
            <button type="button" className="customerButton noPrint" onClick={() => window.print()}>打印导出</button>
          </div>
        </header>
        <FieldExportBlocks vm={vm} />
      </div>
    </div>
  );
}
