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
    <div style={{ display: "grid", gap: 16 }}>
      <header className="customerHero">
        <div className="customerHeroTop">
          <div>
            <div className="customerLabel">GEOX / 客户看板</div>
            <h1 className="customerTitle">{vm?.header.title ?? "客户看板"}</h1>
            <p className="customerSub">{vm?.header.subtitle ?? "经营结果、风险与行动摘要"}</p>
          </div>
          <div className="customerActions">
            <Link className="customerButton customerButtonPrimary noPrint" to={vm?.header.exportAction.href ?? "/customer/export"}>
              {vm?.header.exportAction.label ?? "打印导出"}
            </Link>
          </div>
        </div>
      </header>

      <section className="customerCard">
        <h3 className="customerCardTitle">经营总览</h3>
        <div className="kvGrid2">
          {(vm?.kpis ?? []).map((kpi) => (
            <div key={kpi.key}><strong>{kpi.label}：</strong>{kpi.valueText} <span className="muted">{kpi.detailText}</span></div>
          ))}
        </div>
      </section>

      <section className="customerGrid3">
        <article className="customerCard">
          <h3 className="customerCardTitle">高风险地块 Top 5</h3>
          <ul className="customerList">
            {(vm?.topRiskFields ?? []).map((item) => (
              <li key={item.id} className="customerListItem">
                <div className="customerItemMain">
                  <Link to={item.href}>{item.rowText}</Link>
                  <span className="customerPill customerPillHigh">风险关注</span>
                </div>
              </li>
            ))}
            {!(vm?.topRiskFields.length) ? (
              <li className="customerListItem customerItemReason">暂无风险地块数据</li>
            ) : null}
          </ul>
        </article>

        <article className="customerCard">
          <h3 className="customerCardTitle">待处理事项 Top 5</h3>
          <ul className="customerList">
            {(vm?.pendingItems ?? []).map((item) => (
              <li key={item.id} className="customerListItem">
                <div className="customerItemReason">{item.sentence}</div>
                <Link className="customerButton customerSpacingTopSm" to={item.href}>
                  处理
                </Link>
              </li>
            ))}
            {!(vm?.pendingItems.length) ? (
              <li className="customerListItem customerItemReason">暂无待处理事项</li>
            ) : null}
          </ul>
        </article>

        <article className="customerCard">
          <h3 className="customerCardTitle">近期作业 Top 5</h3>
          <ul className="customerList">
            {(vm?.recentOperations ?? []).map((item) => (
              <li key={item.operationId} className="customerListItem">
                <Link className="customerItemTitle" to={item.href}>{item.rowText}</Link>
              </li>
            ))}
            {!(vm?.recentOperations.length) ? (
              <li className="customerListItem customerItemReason">暂无近期作业</li>
            ) : null}
          </ul>
        </article>
      </section>

      <section className="customerCard">
        <h3 className="customerCardTitle">下一步建议</h3>
        <div className="list">
          {(vm?.nextActions ?? []).map((item) => (
            <li key={item.id} className="customerListItem">
              <div><Link to={item.href}>{item.title}</Link></div>
              <div className="muted">{item.summary}</div>
            </li>
          ))}
        </div>
      </section>

      {error ? <div className="muted customerSpacingTopMd">{error}</div> : null}
    </div>
  );
}
