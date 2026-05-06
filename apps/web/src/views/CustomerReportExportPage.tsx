import React from "react";
import { useLocation, useParams } from "react-router-dom";
import { fetchCustomerDashboardAggregate, fetchFieldReport, fetchOperationReport } from "../api/customerReports";
import { buildCustomerDashboardVm } from "../viewmodels/customerDashboardVm";
import { buildFieldReportVm } from "../viewmodels/fieldReportVm";
import { buildOperationReportVm } from "../viewmodels/operationReportVm";
import { DashboardExportBlocks, FieldExportBlocks, OperationExportBlocks } from "../components/customer/CustomerExportBlocks";

export default function CustomerReportExportPage(): React.ReactElement {
  const { fieldId = "", operationId = "" } = useParams();
  const location = useLocation();
  const mode = location.pathname.includes("/customer/fields/") ? "field" : location.pathname.includes("/customer/operations/") ? "operation" : "dashboard";

  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState("");
  const [content, setContent] = React.useState<React.ReactElement | null>(null);

  React.useEffect(() => {
    let alive = true;
    setLoading(true);
    setError("");
    const load = async (): Promise<void> => {
      if (mode === "field") {
        const report = await fetchFieldReport(fieldId);
        const vm = buildFieldReportVm(report);
        if (!alive) return;
        setContent(<FieldExportBlocks vm={vm} />);
        return;
      }
      if (mode === "operation") {
        const report = await fetchOperationReport(operationId);
        const vm = buildOperationReportVm(report);
        if (!alive) return;
        setContent(<OperationExportBlocks vm={vm} />);
        return;
      }
      const aggregate = await fetchCustomerDashboardAggregate();
      const vm = buildCustomerDashboardVm(aggregate);
      if (!alive) return;
      setContent(<DashboardExportBlocks vm={vm} />);
    };

    void load().catch((e: unknown) => {
      if (!alive) return;
      setContent(null);
      setError(String(e instanceof Error ? e.message : "加载失败"));
    }).finally(() => {
      if (!alive) return;
      setLoading(false);
    });

    return () => { alive = false; };
  }, [fieldId, operationId, mode]);

  if (loading) return <div className="customerReportCanvas"><div className="customerReportSheet">导出页加载中...</div></div>;
  if (error || !content) return <div className="customerReportCanvas"><div className="customerReportSheet">导出页加载失败：{error || "暂无数据"}</div></div>;

  return (
    <div className="customerReportCanvas">
      <div className="customerReportSheet printPage">
        <header className="customerReportHeader">
          <div className="customerReportHeaderBar">
            <div>
              <div className="customerReportLogo">GEOX</div>
              <h1 className="customerTitle">客户看板报告</h1>
              <p className="customerReportMeta">生成时间：{new Date().toLocaleString()}</p>
            </div>
            <button type="button" className="customerButton noPrint" onClick={() => window.print()}>打印导出</button>
          </div>
        </header>
        {content}
        <footer className="customerFooterNote">报告由 GEOX 生成，用于客户经营复盘与沟通。</footer>
      </div>
    </div>
  );
}
