import React from "react";
import { fetchCustomerDashboardAggregate } from "../api/customerReports";
import { buildCustomerDashboardVm, type CustomerDashboardPageVm } from "../viewmodels/customerDashboardVm";
import { PageHeader, SectionCard } from "../shared/ui";

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
    <div className="demoDashboardPage reportPrintPage">
      <PageHeader eyebrow="GEOX / 客户看板" title={vm.header.title} description={vm.header.subtitle} actions={[{ label: "打印导出", onClick: () => window.print() }]} />

      <SectionCard title="KPI Grid">
        <div className="list">{vm.kpis.map((kpi) => <div key={kpi.key} className="item">{kpi.label}：{kpi.valueText}</div>)}</div>
      </SectionCard>

      <SectionCard title="Top 风险地块">
        <div className="list">{vm.topRiskFields.map((item) => <div key={item.id} className="item">{item.title} · {item.summary} · {item.meta}</div>)}</div>
      </SectionCard>

      <SectionCard title="待处理事项">
        <div className="list">{vm.pendingItems.map((item) => <div key={item.id} className="item">{item.title} · {item.summary} · {item.actionLabel}</div>)}</div>
      </SectionCard>

      <SectionCard title="近期作业">
        <div className="list">{vm.recentOperations.map((item) => <div key={item.operationId} className="item">{item.title} · {item.summary}</div>)}</div>
      </SectionCard>

      <SectionCard title="价值摘要">
        <div>{vm.roiSummary.valueText}</div>
        <div className="muted">{vm.roiSummary.confidenceText}</div>
      </SectionCard>
    </div>
  );
}
