import React from "react";
import { Link } from "react-router-dom";
import { fetchCustomerDashboardAggregate } from "../api/customerReports";
import { buildCustomerDashboardVm, type CustomerDashboardPageVm } from "../viewmodels/customerDashboardVm";

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
    <div className="customerPage customerPageGapMd">
      <section className="customerReportHeader">
        <div className="customerEyebrow">GEOX / 客户看板</div>
        <h1 className="customerTitle">{vm?.header.title ?? "客户看板"}</h1>
        <p className="customerSubtitle">{vm?.header.subtitle ?? "经营结果、风险与行动摘要"}</p>
        <div className="customerActionRow">
          <Link className="customerButton customerButtonPrimary" to={vm?.header.primaryAction.href ?? "/customer/approvals"}>{vm?.header.primaryAction.label ?? "立即审批"}</Link>
          <Link className="customerButton" to={vm?.header.secondaryAction.href ?? "/customer/devices"}>{vm?.header.secondaryAction.label ?? "检查设备"}</Link>
        </div>
      </section>

      <section className="customerCard">
        <h3 className="customerCardTitle">经营总览</h3>
        <div className="customerGrid2">
          {(vm?.kpis ?? []).map((kpi) => (
            <div key={kpi.key}><strong>{kpi.label}：</strong>{kpi.valueText}</div>
          ))}
        </div>
      </section>

      <section className="customerCard">
        <h3 className="customerCardTitle">风险与待办</h3>
        <div className="customerGridAuto">
          <div>
            <div className="muted">高风险地块</div>
            {(vm?.topRiskFields ?? []).map((item) => (
              <div key={item.id} className="item"><Link to={item.href}>{item.title}</Link> · {item.summary} · {item.meta}</div>
            ))}
            {!(vm?.topRiskFields.length) ? <div className="muted">暂无风险地块数据</div> : null}
          </div>
          <div>
            <div className="muted">待处理事项</div>
            {(vm?.pendingItems ?? []).map((item) => (
              <div key={item.id} className="item">{item.title} · {item.summary} · <Link to={item.href}>{item.actionLabel}</Link></div>
            ))}
          </div>
          <div>
            <div className="muted">近期作业</div>
            {(vm?.recentOperations ?? []).map((item) => (
              <div key={item.operationId} className="item"><Link to={item.href}>{item.title}</Link> · {item.summary}</div>
            ))}
            {!(vm?.recentOperations.length) ? <div className="muted">暂无近期作业</div> : null}
          </div>
        </div>
      </section>

      <section className="customerCard">
        <h3 className="customerCardTitle">下一步建议与价值</h3>
        <div className="customerList">
          {(vm?.nextActions ?? []).map((item) => (
            <article key={item.id} className="item">
              <div><Link to={item.href}>{item.title}</Link></div>
              <div className="muted">{item.summary}</div>
            </article>
          ))}
        </div>
        <div className="customerSpacingTopSm">{vm?.roiSummary.valueText ?? "暂无价值记录"}</div>
        <div className="muted">{vm?.roiSummary.confidenceText ?? "价值记录 0 条。"}</div>
      </section>

      {error ? <div className="muted customerSpacingTopMd">{error}</div> : null}
    </div>
  );
}
