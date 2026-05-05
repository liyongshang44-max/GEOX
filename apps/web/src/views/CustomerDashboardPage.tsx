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
            <article key={kpi.key} className="customerMetricCard">
              <div className="customerMetricValue">{kpi.valueText}</div>
              <div className="customerMetricLabel">{kpi.label}</div>
            </article>
          ))}
        </div>
      </section>

      <section className="customerCard">
        <h3 className="customerCardTitle">风险与待办</h3>
        <div className="customerGridAuto">
          <div>
            <div className="muted">高风险地块</div>
            {(vm?.topRiskFields ?? []).map((item) => (
              <li key={item.id} className="customerListItem">
                <div className="customerHeroTop">
                  <Link to={item.href}>{item.title}</Link>
                  <span className="customerPill">风险关注</span>
                </div>
                <div className="muted">{item.summary}</div>
                <div className="muted">{item.meta}</div>
              </li>
            ))}
            {!(vm?.topRiskFields.length) ? <li className="customerListItem muted">暂无风险地块数据</li> : null}
          </ul>
        </article>

        <article className="customerCard">
          <h3 className="customerCardTitle">待处理事项</h3>
          <ul className="customerList">
            {(vm?.pendingItems ?? []).map((item) => (
              <li key={item.id} className="customerListItem">
                <div>{item.title}</div>
                <div className="muted">{item.summary}</div>
                <Link to={item.href}>{item.actionLabel}</Link>
              </li>
            ))}
          </ul>
        </article>

        <article className="customerCard">
          <h3 className="customerCardTitle">近期作业</h3>
          <ul className="customerList">
            {(vm?.recentOperations ?? []).map((item) => (
              <li key={item.operationId} className="customerListItem">
                <Link to={item.href}>{item.title}</Link>
                <div className="muted">{item.summary}</div>
              </li>
            ))}
            {!(vm?.recentOperations.length) ? <li className="customerListItem muted">暂无近期作业</li> : null}
          </ul>
        </article>
      </section>

      <section className="customerCard">
        <h3 className="customerCardTitle">下一步建议与价值</h3>
        <div className="customerList">
          {(vm?.nextActions ?? []).map((item) => (
            <li key={item.id} className="customerListItem">
              <div><Link to={item.href}>{item.title}</Link></div>
              <div className="muted">{item.summary}</div>
            </li>
          ))}
        </div>
        <div className="customerSpacingTopSm">{vm?.roiSummary.valueText ?? "暂无价值记录"}</div>
        <div className="muted">{vm?.roiSummary.confidenceText ?? "价值记录 0 条。"}</div>
      </section>

      {error ? <div className="muted customerSpacingTopMd">{error}</div> : null}
    </div>
  );
}
