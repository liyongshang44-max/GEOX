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

  const parseRow = (text: string): string[] => text.split(" · ").map((x) => x.trim()).filter(Boolean);

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
        <div className="customerMetrics">
          {(vm?.kpis ?? []).slice(0, 6).map((kpi) => (
            <article key={kpi.key} className="customerMetricCard">
              <div className="customerMetricLabel">{kpi.label}</div>
              <div className="customerMetricValue">{kpi.valueText}</div>
              <div className="muted">{kpi.detailText}</div>
            </article>
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
                  {(() => {
                    const [fieldName = "地块", riskTag = "风险关注", reason = "待复核"] = parseRow(item.rowText);
                    return (
                      <>
                        <Link to={item.href}>{fieldName}</Link>
                        <span className="customerPill customerPillHigh">{riskTag}</span>
                        <div className="customerItemReason">{reason}</div>
                      </>
                    );
                  })()}
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
                {(() => {
                  const [operationType = "作业", fieldName = "地块", timeText = "时间未知", statusText = "待确认"] = parseRow(item.rowText);
                  return (
                    <>
                      <Link className="customerItemTitle" to={item.href}>{operationType}</Link>
                      <div className="customerItemReason">{fieldName} · {timeText}</div>
                      <span className="customerPill">{statusText}</span>
                    </>
                  );
                })()}
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
        <div className="customerGrid3">
          {(vm?.nextActions ?? []).map((item) => (
            <article key={item.id} className="customerCard" style={{ border: "1px solid var(--line, #e5e7eb)", padding: 12 }}>
              <div className="customerItemTitle">{item.title}</div>
              <div className="customerItemReason" style={{ marginTop: 6 }}>{item.summary}</div>
              <Link className="customerButton customerSpacingTopSm" to={item.href}>立即处理</Link>
            </article>
          ))}
        </div>
      </section>

      <section className="customerCard">
        <h3 className="customerCardTitle">收益摘要</h3>
        <div className="customerMetrics">
          <article className="customerMetricCard">
            <div className="customerMetricLabel">ROI 条目</div>
            <div className="customerMetricValue">{vm?.roiSummary.totalRoiItems ?? 0}</div>
          </article>
          <article className="customerMetricCard">
            <div className="customerMetricLabel">节水条目</div>
            <div className="customerMetricValue">{vm?.roiSummary.waterSavedItems ?? 0}</div>
          </article>
          <article className="customerMetricCard">
            <div className="customerMetricLabel">客户价值</div>
            <div className="muted">{vm?.roiSummary.customerValueText ?? "--"}</div>
          </article>
        </div>
      </section>

      {!vm && error ? <div className="muted customerSpacingTopMd">{error}</div> : null}
    </div>
  );
}
