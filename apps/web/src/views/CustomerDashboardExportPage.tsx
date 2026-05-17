import React from "react";
import { fetchCustomerDashboardAggregate } from "../api/reports";
import { buildCustomerDashboardVm, type CustomerDashboardPageVm } from "../viewmodels/customerDashboardVm";
import { DashboardExportBlocks } from "../components/customer/CustomerExportBlocks";
import PrintReportScaffold from "../components/customer/PrintReportScaffold";

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
    <PrintReportScaffold
      title="客户看板报告"
      subtitle="客户经营总览打印版"
      generatedAt={vm.generatedAtText}
      backTo="/customer/dashboard"
    >
      <DashboardExportBlocks vm={vm} />
    </PrintReportScaffold>
  );
}
