import React from "react";
import { Link } from "react-router-dom";
import { fetchCustomerReportsCenter } from "../api/customerReportsCenter";
import { CustomerEmptyState } from "../components/customer";
import { buildCustomerReportsCenterVm, type CustomerReportsCenterVm } from "../viewmodels/customerReportsCenterVm";
import "../styles/customerFields.css";

export default function CustomerReportsCenterPage(): React.ReactElement {
  const [vm, setVm] = React.useState<CustomerReportsCenterVm | null>(null);

  React.useEffect(() => {
    let alive = true;
    void fetchCustomerReportsCenter().then((response) => {
      if (!alive) return;
      setVm(buildCustomerReportsCenterVm(response));
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
          <p className="customerSubtitle">{vm?.subtitle ?? "报告中心加载中。"}</p>
          <p className="customerMetricLabel">数据更新时间：{vm?.generatedAtText ?? "暂无更新时间"}</p>
          {vm ? <p className="customerMetricLabel">数据可信级别：{vm.trustText}</p> : null}
          {vm?.dataScopeNote ? <p className="customerScopeWarning">{vm.dataScopeNote}</p> : null}
        </div>
        <div className="customerActions">
          {vm ? <span className="customerPill">{vm.scopeBadgeText}</span> : null}
          <Link className="customerButton" to="/customer/export">导出总览报告</Link>
        </div>
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
                {group.key === "EVIDENCE_VALUE" ? <span className="customerPill">数据不足</span> : null}
              </div>

              {group.items.length ? (
                <div className="customerReportEntryList customerSpacingTopMd">
                  {group.items.map((item, index) => {
                    const itemKey = `${group.key}-${item.href || item.title}-${index}`;
                    return item.disabled ? (
                      <div key={itemKey} className="customerReportEntry isDisabled" aria-disabled="true">
                        <div>
                          <strong>{item.title}</strong>
                          <p>{item.subtitle}</p>
                          <small>{item.coverageText}</small>
                          <small>数据可信级别：{item.trustText}</small>
                          <small>状态：{item.statusText}</small>
                          <small>更新时间：{item.updatedAtText}</small>
                        </div>
                        <span>{item.statusText}</span>
                      </div>
                    ) : (
                      <Link key={itemKey} className="customerReportEntry" to={item.href || "/customer/reports"}>
                        <div>
                          <strong>{item.title}</strong>
                          <p>{item.subtitle}</p>
                          <small>{item.coverageText}</small>
                          <small>数据可信级别：{item.trustText}</small>
                          <small>状态：{item.statusText}</small>
                          <small>更新时间：{item.updatedAtText}</small>
                        </div>
                        <span>{item.statusText}</span>
                      </Link>
                    );
                  })}
                </div>
              ) : (
                <p className="muted customerSpacingTopMd">暂无可展示报告入口。</p>
              )}
            </article>
          ))}
        </section>
      ) : null}

      {vm && !hasAnyReport ? <CustomerEmptyState vm={vm.emptyState} /> : null}
    </div>
  );
}
