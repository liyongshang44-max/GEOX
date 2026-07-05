// apps/web/src/views/CustomerReportsCenterPage.tsx
import React from "react";
import { Link } from "react-router-dom";
import { fetchCustomerReportsCenter } from "../api/customerReportsCenter";
import { localizedText, useLocale } from "../lib/locale";
import { buildCustomerReportsCenterVm, type CustomerReportsCenterVm } from "../viewmodels/customerReportsCenterVm";
import "../styles/customerFields.css";

const COPY = {
  eyebrow: { zh: "GEOX / 报告", en: "GEOX / Reports" },
  title: { zh: "报告中心", en: "Reports" },
  loading: { zh: "报告中心加载中。", en: "Reports are loading." },
  updatedAt: { zh: "数据更新时间", en: "Data updated at" },
  noUpdatedAt: { zh: "暂无更新时间", en: "No update time" },
  trust: { zh: "数据可信级别", en: "Data trust level" },
  exportDashboard: { zh: "导出总览报告", en: "Export Dashboard Report" },
  status: { zh: "状态", en: "Status" },
  noEntry: { zh: "暂无可展示报告入口。", en: "No report entry is available." },
};

export default function CustomerReportsCenterPage(): React.ReactElement {
  const { locale } = useLocale();
  const [vm, setVm] = React.useState<CustomerReportsCenterVm | null>(null);

  React.useEffect(() => {
    let alive = true;
    void fetchCustomerReportsCenter().then((response) => {
      if (!alive) return;
      setVm(buildCustomerReportsCenterVm(response));
    });
    return () => { alive = false; };
  }, []);

  return (
    <div className="customerPageGapMd customerIndexPage">
      <section className="customerCard customerIndexHero">
        <div>
          <div className="customerEyebrow">{localizedText(COPY.eyebrow, locale)}</div>
          <h2 className="customerTitle">{localizedText(COPY.title, locale)}</h2>
          <p className="customerSubtitle">{vm?.subtitle ?? localizedText(COPY.loading, locale)}</p>
          <p className="customerMetricLabel">{localizedText(COPY.updatedAt, locale)}：{vm?.generatedAtText ?? localizedText(COPY.noUpdatedAt, locale)}</p>
          {vm ? <p className="customerMetricLabel">{localizedText(COPY.trust, locale)}：{vm.trustText}</p> : null}
          {vm?.dataScopeNote ? <p className="customerScopeWarning">{vm.dataScopeNote}</p> : null}
        </div>
        <div className="customerActions">
          {vm ? <span className="customerPill">{vm.scopeBadgeText}</span> : null}
          <Link className="customerButton" to="/customer/export">{localizedText(COPY.exportDashboard, locale)}</Link>
        </div>
      </section>

      {vm ? (
        <section className="customerReportsCenterGrid">
          {vm.groups.map((group) => (
            <article key={group.key} className="customerCard customerReportsGroupCard">
              <div className="customerCardHeaderRow"><div><h3 className="customerCardTitle">{group.title}</h3><p className="customerMetricLabel">{group.description}</p></div></div>
              {group.items.length ? <div className="customerReportEntryList customerSpacingTopMd">{group.items.map((item, index) => <Link key={`${group.key}-${item.href || item.title}-${index}`} className="customerReportEntry" to={item.href || "/customer/reports"}><div><strong>{item.title}</strong><p>{item.subtitle}</p><small>{item.coverageText}</small><small>{localizedText(COPY.trust, locale)}：{item.trustText}</small><small>{localizedText(COPY.status, locale)}：{item.statusText}</small><small>{localizedText(COPY.updatedAt, locale)}：{item.updatedAtText}</small></div><span>{item.statusText}</span></Link>)}</div> : <p className="muted customerSpacingTopMd">{localizedText(COPY.noEntry, locale)}</p>}
            </article>
          ))}
        </section>
      ) : null}
    </div>
  );
}
