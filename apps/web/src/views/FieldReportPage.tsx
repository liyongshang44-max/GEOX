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
  const sanitizeUiText = (value: unknown): string => String(value ?? "")
    .replace(/field_c8_demo/gi, "")
    .replace(/地块id/gi, "")
    .replace(/field_/gi, "")
    .trim();
  const isHighRisk = /高风险|严重|high/i.test(vm.overview.riskText ?? "");
  const hasAbnormalReason = vm.currentStatus.reasons.some((item) => item && !/暂无|正常|无异常/.test(item));
  const showStatusAlert = isHighRisk || hasAbnormalReason;
  const nextSteps = [
    vm.nextAction?.title ? `优先执行：${sanitizeUiText(vm.nextAction.title)}` : "优先完成待验收作业，缩短处置闭环时间。",
    vm.nextAction?.objectiveText ? `执行目标：${sanitizeUiText(vm.nextAction.objectiveText)}` : "安排下一次现场巡检，并复核关键传感器数据。",
  ];

  return (
    <div className="customerReportCanvas">
      <div className="customerReportSheet customerPageGapMd">
      <section className="customerReportHeader">
        <div className="customerEyebrow">GEOX / C8-03 地块报告</div>
        <h1 className="customerTitle">当前状态与近期作业执行情况</h1>
        <p className="customerSubtitle">打印导出</p>
        <div className="customerActionRow">
          <Link className="customerButton" to="/customer/dashboard">返回客户总览</Link>
          <Link className="customerButton customerButtonPrimary" to={`/customer/fields/${encodeURIComponent(fieldId)}/export`}>打印导出</Link>
        </div>
        </div>
      </section>

      <section className="customerCard">
        <h3 className="customerCardTitle">诊断依据</h3>
        <ul className="customerList">
          {vm.diagnosticCards.map((item) => (
            <li key={item.title} className="customerListItem">
              <div>
                <strong>{item.title}</strong>：{item.value}
              </div>
              <div className="customerItemReason">{item.detail}</div>
            </li>
          ))}
        </ul>
      </section>

      {showStatusAlert ? <section className="customerCard" style={{ background: "#fef2f2", borderColor: "#fecaca" }}>
        <h3 className="customerCardTitle">当前状态说明</h3>
        <div>{sanitizeUiText(vm.currentStatus.summary)}</div>
        <ul className="customerSpacingTopXs">
          {vm.currentStatus.reasons.map((item, idx) => (<li key={`${item}-${idx}`}>{sanitizeUiText(item)}</li>))}
        </ul>
      </section> : null}

      <section className="customerCard">
        <h3 className="customerCardTitle">近期作业 Top 5</h3>
        <ul className="customerList">
          {vm.recentOperationsTop5.map((item) => (
            <li key={item.id} className="customerListItem">
              <div className="customerItemMain">
                <Link to={item.href}>{sanitizeUiText(item.title)}</Link>
                <span className="customerItemReason">{sanitizeUiText(item.generatedAtText)}</span>
              </div>
              <div className="customerItemReason">状态：{sanitizeUiText(item.statusText)}</div>
              <div className="customerItemReason">验收：{sanitizeUiText(item.acceptanceText)}</div>
            </li>
          ))}
          {!vm.recentOperationsTop5.length ? <li className="muted">暂无作业报告</li> : null}
        </ul>
      </section>

      <section className="customerCard">
        <h3 className="customerCardTitle">处方与下一步建议</h3>
        <div className="customerList">
          {vm.prescriptionCards.map((item) => (
            <article key={item.title} className={item.title === "审批要求" ? "customerListItem customerListItemWarn" : "customerListItem customerListItemOk"}>
              <div><strong>{item.title}</strong>：{item.value}</div>
              <div className="muted">{item.detail}</div>
            </article>
          ))}
        </div>
      </section>

      <section className="customerCard">
        <h3 className="customerCardTitle">设备与监测</h3>
        <div className="customerGrid2">
          {vm.deviceMonitoring.map((item) => (
            <div key={item.label}>
              <strong>{sanitizeUiText(item.label)}：</strong>
              {sanitizeUiText(item.value)}
            </div>
          ))}
        </div>
      </section>

      <section className="customerCard" style={{ background: "#ecfdf3", borderColor: "#a7f3d0" }}>
        <h3 className="customerCardTitle">下一步建议</h3>
        <ul className="customerSpacingTopXs">
          {nextSteps.map((item, idx) => <li key={`${item}-${idx}`}>{item}</li>)}
        </ul>
      </section>
    </div>
  );
}
