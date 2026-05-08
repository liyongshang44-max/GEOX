import React from "react";
import { Link } from "react-router-dom";
import { fetchCustomerReportsCenter } from "../api/customerReportsCenter";
import { CustomerEmptyState } from "../components/customer";
import { buildCustomerReportsCenterVm, type CustomerReportsCenterVm } from "../viewmodels/customerReportsCenterVm";
import "../styles/customerFields.css";

export default function CustomerReportsCenterPage(): React.ReactElement {
  const [vm, setVm] = React.useState<CustomerReportsCenterVm | null>(null);
  const [error, setError] = React.useState("");

  React.useEffect(() => {
    let alive = true;
    void fetchCustomerReportsCenter()
      .then((response) => {
        if (!alive) return;
        setVm(buildCustomerReportsCenterVm(response));
        setError("");
      })
      .catch(() => {
        if (!alive) return;
        setVm(null);
        setError("暂未获取到可展示的报告入口，请稍后刷新。");
      });
    return () => {
      alive = false;
    };
  }, []);

  const hasAnyReport = Boolean(vm?.groups.some((group) => group.items.length > 0));

  return (
    <div className="customerPageGapMd customerIndexPage">
      <section className="customerCard customerIndexHero">
        <div>
          <div className="customerEyebrow">GEOX / 报告中心</div>
          <h2 className="customerTitle">报告中心</h2>
          <p className="customerSubtitle">{vm?.subtitle ?? "查看可交付报告入口。"}</p>
          <p className="customerMetricLabel">数据更新时间：{vm?.generatedAtText ?? "暂无更新时间"}</p>
          {vm?.isFallback ? <p className="customerScopeWarning">{vm.dataScopeNote || "当前仅展示驾驶舱与近期可见对象对应报告入口，非全部报告列表"}</p> : null}
        </div>
        <Link className="customerButton" to="/customer/export">导出总览报告</Link>
      </section>

      {vm ? (
        <section className="customerReportsCenterGrid">
          {vm.groups.map((group) => (
            <article key={group.key} className="customerCard customerReportsGroupCard">
              <div className="customerCardHeaderRow">
                <div>
                  <h3 className="customerCardTitle">{group.title}</h3>
                  <p className="customerMetricLabel">{group.description}</p>
                </div>
                {group.key === "EVIDENCE_VALUE" ? <span className="customerPill">待接入</span> : null}
              </div>

              {group.items.length ? (
                <div className="customerReportEntryList customerSpacingTopMd">
                  {group.items.map((item) => item.disabled ? (
                    <div key={`${group.key}-${item.title}`} className="customerReportEntry isDisabled" aria-disabled="true">
                      <div>
                        <strong>{item.title}</strong>
                        <p>{item.subtitle}</p>
                        <small>更新时间：{item.updatedAtText}</small>
                      </div>
                      <span>{item.statusText}</span>
                    </div>
                  ) : (
                    <Link key={`${group.key}-${item.title}`} className="customerReportEntry" to={item.href || "/customer/reports"}>
                      <div>
                        <strong>{item.title}</strong>
                        <p>{item.subtitle}</p>
                        <small>更新时间：{item.updatedAtText}</small>
                      </div>
                      <span>{item.statusText}</span>
                    </Link>
                  ))}
                </div>
              ) : (
                <p className="muted customerSpacingTopMd">{group.key === "EVIDENCE_VALUE" ? "证据包生成能力待接入。" : "暂无可展示报告入口。"}</p>
              )}
            </article>
          ))}
        </section>
      ) : null}

      {vm && !hasAnyReport ? <CustomerEmptyState vm={vm.emptyState} /> : null}
      {error ? <p className="muted customerSpacingTopMd">{error}</p> : null}
    </div>
  );
}
