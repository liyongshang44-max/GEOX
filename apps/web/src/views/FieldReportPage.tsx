import React from "react";
import { Link, useParams } from "react-router-dom";
import { fetchFieldReport, type FieldReportDetailV1 } from "../api/customerReports";
import ErrorState from "../components/common/ErrorState";
import SectionSkeleton from "../components/common/SectionSkeleton";
import { buildFieldReportVm } from "../viewmodels/fieldReportVm";

export default function FieldReportPage(): React.ReactElement {
  const { fieldId = "" } = useParams();
  const [loading, setLoading] = React.useState(true);
  const [report, setReport] = React.useState<FieldReportDetailV1 | null>(null);
  const [error, setError] = React.useState("");

  React.useEffect(() => {
    let alive = true;
    setLoading(true);
    void fetchFieldReport(fieldId)
      .then((res) => {
        if (!alive) return;
        setReport(res);
        setError("");
      })
      .catch((e: unknown) => {
        if (!alive) return;
        setError(String(e instanceof Error ? e.message : "加载失败"));
      })
      .finally(() => {
        if (!alive) return;
        setLoading(false);
      });
    return () => {
      alive = false;
    };
  }, [fieldId]);

  if (loading) return <SectionSkeleton kind="detail" />;
  if (error || !report) return <ErrorState title="地块报告加载失败" message={error || "暂无地块报告"} onRetry={() => window.location.reload()} />;

  const vm = buildFieldReportVm(report);

  return (
    <div className="customerReportCanvas">
      <div className="customerReportSheet customerPageGapMd">
      <section className="customerReportHeader">
        <div className="customerReportHeaderBar">
          <div>
            <div className="customerReportLogo">GEOX</div>
        <h1 className="customerTitle">C8-03 地块报告</h1>
        <p className="customerSubtitle">{vm.hero.subtitle}</p>
        </div>
          <div className="customerActionRow">
          <Link className="customerButton" to="/customer/dashboard">返回客户总览</Link>
          <Link className="customerButton customerButtonPrimary" to={`/customer/fields/${encodeURIComponent(fieldId)}/export`}>打印导出</Link>
        </div>
        </div>
      </section>

      <section className="customerCard">
        <h3 className="customerReportSectionTitle">地块概况</h3>
        <div className="customerGrid2">
          {vm.landOverview.map((item) => (
            <div key={item.label}>
              <strong>{item.label}：</strong>
              {item.value}
            </div>
          ))}
        </div>
      </section>

      <section className="customerCard">
        <h3 className="customerReportSectionTitle">诊断依据</h3>
        <div className="customerList">
          {vm.diagnosticCards.map((item) => (
            <li key={item.title} className="customerListItem">
              <div>
                <strong>{item.title}</strong>：{item.value}
              </div>
              <div className="customerItemReason">{item.detail}</div>
            </li>
          ))}
        </div>
      </section>

      <section className="customerCard">
        <h3 className="customerReportSectionTitle">当前状态说明</h3>
        <div>{vm.currentStatus.summary}</div>
        <ul className="customerSpacingTopXs">
          {vm.currentStatus.reasons.map((item, idx) => (<li key={`${item}-${idx}`}>{item}</li>))}
        </ul>
      </section>

      <section className="customerCard">
        <h3 className="customerReportSectionTitle">近期作业 Top 5</h3>
        <div className="customerList">
          {vm.recentOperationsTop5.map((item) => (
            <li key={item.id} className="customerListItem">
              <div className="customerItemMain">
                <Link to={item.href}>{item.title}</Link>
                <span className="customerItemReason">{item.generatedAtText}</span>
              </div>
              <div className="customerItemReason">状态：{item.statusText}</div>
              <div className="customerItemReason">验收：{item.acceptanceText}</div>
            </li>
          ))}
          {!vm.recentOperationsTop5.length ? <div className="muted">暂无作业报告</div> : null}
        </div>
      </section>

      <section className="customerCard">
        <h3 className="customerReportSectionTitle">处方与下一步建议</h3>
        <div className="customerList">
          {vm.prescriptionCards.map((item) => (
            <article key={item.title} className={item.title === "审批要求" ? "item customerListItemWarn" : "item"}>
              <div><strong>{item.title}</strong>：{item.value}</div>
              <div className="muted">{item.detail}</div>
            </article>
          ))}
        </div>
      </section>

      <section className="customerCard">
        <h3 className="customerReportSectionTitle">设备与监测</h3>
        <div className="customerGrid2">
          {vm.deviceMonitoring.map((item) => (
            <div key={item.label}>
              <strong>{item.label}：</strong>
              {item.value}
            </div>
          ))}
        </div>
      </section>
      <footer className="customerFooterNote">报告由 GEOX 生成，用于客户经营复盘与沟通。</footer>
      </div>
    </div>
  );
}
