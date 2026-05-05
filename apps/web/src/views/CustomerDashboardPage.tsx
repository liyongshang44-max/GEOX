import React from "react";
import { Link } from "react-router-dom";
import { fetchCustomerDashboardAggregate } from "../api/reports";
import { buildCustomerDashboardVm, type CustomerDashboardPageVm } from "../viewmodels/customerDashboardVm";
import { PageHeader, SectionCard } from "../shared/ui";

export default function CustomerDashboardPage(): React.ReactElement {
  const [vm, setVm] = React.useState<CustomerDashboardPageVm | null>(null);
  const [error, setError] = React.useState<string>("");

  React.useEffect(() => {
    void fetchCustomerDashboardAggregate()
      .then((aggregate) => {
        setVm(buildCustomerDashboardVm(aggregate));
        setError("");
      })
      .catch(() => {
        setVm(null);
        setError("暂未获取到可展示的经营数据，请稍后刷新。");
      });
  }, []);

  return (
    <div className="demoDashboardPage">
      <PageHeader
        eyebrow="GEOX / 客户看板"
        title={vm?.header.title ?? "客户看板"}
        description={vm?.header.subtitle ?? "经营结果、风险与行动摘要"}
        actions={(
          <>
            <Link className="btn" to={vm?.header.primaryAction.href ?? "/customer/approvals"}>{vm?.header.primaryAction.label ?? "立即审批"}</Link>
            <Link className="btn" to={vm?.header.secondaryAction.href ?? "/customer/devices"}>{vm?.header.secondaryAction.label ?? "检查设备"}</Link>
          </>
        )}
      />

      <SectionCard title="KPI Grid">
        <div className="list">
          {(vm?.kpis ?? []).map((kpi) => (
            <div key={kpi.key} className="item">{kpi.label}：{kpi.valueText}</div>
          ))}
        </div>
      </SectionCard>

      <SectionCard title="三列列表">
        <div id="top-risk-fields" className="list">
          <div className="muted">Top 风险</div>
          {(vm?.topRiskFields ?? []).map((item) => (
            <div key={item.id} className="item"><Link to={item.href}>{item.title}</Link> · {item.summary} · {item.meta}</div>
          ))}
          {!(vm?.topRiskFields.length) ? <div className="muted">暂无风险地块数据</div> : null}
        </div>
        <div className="list" style={{ marginTop: 12 }}>
          <div className="muted">待处理</div>
          {(vm?.pendingItems ?? []).map((item) => (
            <div key={item.id} className="item">{item.title} · {item.summary} · <Link to={item.href}>{item.actionLabel}</Link></div>
          ))}
        </div>
        <div className="list" style={{ marginTop: 12 }}>
          <div className="muted">近期作业</div>
          {(vm?.recentOperations ?? []).map((item) => (
            <div key={item.operationId} className="item"><Link to={item.href}>{item.title}</Link> · {item.summary}</div>
          ))}
          {!(vm?.recentOperations.length) ? <div className="muted">暂无近期作业</div> : null}
        </div>
      </SectionCard>

      <SectionCard title="下一步建议">
        <div className="list">
          {(vm?.nextActions ?? []).map((item) => (
            <div key={item.id} className="item"><Link to={item.href}>{item.title}</Link></div>
          ))}
        </div>
      </SectionCard>

      <SectionCard title="价值摘要">
        <div>{vm?.roiSummary.valueText ?? "暂无价值记录"}</div>
        <div className="muted">{vm?.roiSummary.confidenceText ?? "价值记录 0 条。"}</div>
      </SectionCard>

      <SectionCard title="数据说明">
        <div className="muted">数据来自客户经营看板聚合接口，包含风险、作业、验收、设备与价值记录。</div>
      </SectionCard>

      {error ? <div className="muted" style={{ marginTop: 12 }}>{error}</div> : null}
    </div>
  );
}
