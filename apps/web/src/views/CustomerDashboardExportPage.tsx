import React from "react";
import { fetchCustomerDashboardAggregate } from "../api/customerReports";
import { buildCustomerDashboardVm, type CustomerDashboardPageVm } from "../viewmodels/customerDashboardVm";
import { DashboardExportBlocks } from "../components/customer/CustomerExportBlocks";

export default function CustomerDashboardExportPage(): React.ReactElement {
  const [vm, setVm] = React.useState<CustomerDashboardPageVm | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState("");

  React.useEffect(() => {
    let alive = true;
    setLoading(true);
    void fetchCustomerDashboardAggregate()
      .then((aggregate) => {
        if (!alive) return;
        setVm(buildCustomerDashboardVm(aggregate));
        setError("");
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
    return () => {
      alive = false;
    };
  }, []);

  if (loading) return <div className="customerCard" style={{ padding: 16 }}>客户看板导出加载中...</div>;
  if (error || !vm) return <div className="customerCard" style={{ padding: 16 }}>客户看板导出加载失败：{error || "暂无数据"}</div>;

  return (
    <div className="customerReportCanvas">
      <div className="customerReportSheet printPage">
        <header className="customerReportHeader">
          <div className="customerHeroTop">
            <div>
              <div className="customerEyebrow">GEOX</div>
              <h1 className="customerTitle">客户看板报告</h1>
              <p className="customerSubtitle">生成时间：{vm.generatedAtText}</p>
            </div>
            <button type="button" className="customerButton noPrint" onClick={() => window.print()}>打印导出</button>
          </div>
        </header>
        <DashboardExportBlocks vm={vm} />
      </div>
    </div>
  );
}
