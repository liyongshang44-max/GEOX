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
    <div className="demoDashboardPage">
      <section className="card" style={{ marginBottom: 16 }}>
        <div className="muted">{vm?.header.eyebrow ?? "GEOX / 客户看板"}</div>
        <h1 style={{ margin: "8px 0 4px" }}>{vm?.header.title ?? "客户看板"}</h1>
        <p className="muted" style={{ margin: 0 }}>{vm?.header.subtitle ?? "经营结果、风险与行动摘要"}</p>
        <div style={{ marginTop: 12 }}>
          <Link className="btn" to={vm?.header.exportAction.href ?? "/customer/reports"}>{vm?.header.exportAction.label ?? "打印导出"}</Link>
        </div>
      </section>

      <section style={{ display: "grid", gridTemplateColumns: "repeat(6, minmax(0, 1fr))", gap: 12, marginBottom: 16 }}>
        {(vm?.kpis ?? []).map((kpi) => (
          <article key={kpi.key} className="card">
            <div className="muted">{kpi.label}</div>
            <div style={{ fontSize: 28, fontWeight: 700, lineHeight: 1.2, margin: "8px 0" }}>{kpi.valueText}</div>
            <div className="muted">{kpi.detailText}</div>
          </article>
        ))}
      </section>

      <section style={{ display: "grid", gridTemplateColumns: "repeat(3, minmax(0, 1fr))", gap: 12, marginBottom: 16 }}>
        <article id="top-risk-fields" className="card">
          <h3 style={{ marginTop: 0 }}>高风险地块</h3>
          {(vm?.topRiskFields ?? []).map((item) => (
            <div key={item.id} className="item"><Link to={item.href}>{item.rowText}</Link></div>
          ))}
          {!(vm?.topRiskFields.length) ? <div className="muted">暂无风险地块数据</div> : null}
        </article>

        <article className="card">
          <h3 style={{ marginTop: 0 }}>待处理事项</h3>
          {(vm?.pendingItems ?? []).map((item) => (
            <div key={item.id} className="item"><Link to={item.href}>{item.sentence}</Link></div>
          ))}
        </article>

        <article className="card">
          <h3 style={{ marginTop: 0 }}>近期作业 Top 5</h3>
          {(vm?.recentOperations ?? []).map((item) => (
            <div key={item.operationId} className="item"><Link to={item.href}>{item.rowText}</Link></div>
          ))}
          {!(vm?.recentOperations.length) ? <div className="muted">暂无近期作业</div> : null}
        </article>
      </section>

      <section className="card">
        <h3 style={{ marginTop: 0 }}>下一步建议</h3>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(2, minmax(0, 1fr))", gap: 12 }}>
          {(vm?.nextActions ?? []).map((item) => (
            <article key={item.id} className="item">
              <div><Link to={item.href}>{item.title}</Link></div>
              <div className="muted">{item.summary}</div>
            </article>
          ))}
        </div>
      </section>

      {error ? <div className="muted" style={{ marginTop: 12 }}>{error}</div> : null}
    </div>
  );
}
