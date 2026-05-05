import React from "react";
import { fetchCustomerDashboardAggregate } from "../api/customerReports";
import { buildCustomerDashboardVm, type CustomerDashboardPageVm } from "../viewmodels/customerDashboardVm";
import { PageHeader } from "../shared/ui";
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

  if (loading) return <div className="card" style={{ padding: 16 }}>客户看板导出加载中...</div>;
  if (error || !vm) return <div className="card" style={{ padding: 16 }}>客户看板导出加载失败：{error || "暂无数据"}</div>;

  return (
    <div className="demoDashboardPage reportPrintPage printPage">
      <PageHeader
        eyebrow="GEOX"
        title={vm.header.title}
        description={`生成时间：${new Date().toLocaleString()}`}
        actions={<button type="button" className="btn noPrint" onClick={() => window.print()}>打印导出</button>}
      />
      <DashboardExportBlocks vm={vm} />
    </div>
  );
}
