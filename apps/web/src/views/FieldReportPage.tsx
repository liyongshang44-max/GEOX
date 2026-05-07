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
  const canExport = Boolean(fieldId.trim());
  const hasGeometry = Boolean((report as { field?: { geometry?: unknown } }).field?.geometry);

  return (
    <div className="customerReportCanvas">
      <div className="customerReportSheet customerPageGapMd">
      <section className="customerReportHeader">
        <div className="customerEyebrow">GEOX / 地块病历</div>
        <h1 className="customerTitle">{vm.field.fieldName}</h1>
        <p className="customerSubtitle">地块ID：{vm.field.fieldId}</p>
        <div className="customerActionRow">
          <Link className="customerButton" to="/customer/dashboard">返回客户总览</Link>
          {canExport ? (
            <Link className="customerButton customerButtonPrimary" to={vm.exportHref}>打印导出</Link>
          ) : (
            <span className="muted">导出不可用：缺少地块标识</span>
          )}
        </div>
      </section>

      <section className="customerCard">
        <h3 className="customerCardTitle">当前风险</h3>
        <div><strong>风险等级：</strong>{vm.risk.levelLabel}</div>
        <ul className="customerList customerSpacingTopXs">
          {vm.risk.reasons.map((item, idx) => <li key={`${item}-${idx}`} className="customerListItem">{item}</li>)}
        </ul>
      </section>

      <section className="customerCard">
        <h3 className="customerCardTitle">诊断结论</h3>
        <div>{vm.diagnosis.headline}</div>
        <ul className="customerList">
          {vm.diagnosis.evidenceLines.map((item, idx) => (
            <li key={`${item}-${idx}`} className="customerListItem">{item}</li>
          ))}
        </ul>
      </section>

      <section className="customerCard">
        <h3 className="customerCardTitle">当前建议</h3>
        <div className="customerList">
          {vm.recommendations.map((item) => (
            <article key={item.title} className="customerListItem customerListItemOk">
              <div><strong>{item.title}</strong></div>
              <div className="muted">{item.summary}</div>
              {item.href ? <Link className="customerButton customerSpacingTopXs" to={item.href}>查看详情</Link> : null}
            </article>
          ))}
        </div>
      </section>

      <section className="customerCard">
        <h3 className="customerCardTitle">近期作业 Top 5</h3>
        <ul className="customerList">
          {vm.recentOperations.map((item) => (
            <li key={item.operationId || item.rowText} className="customerListItem">
              <div className="customerItemMain">
                <Link to={item.href}>{item.rowText.split(" · ")[0]}</Link>
              </div>
              <div className="customerItemReason">{item.rowText.split(" · ").slice(1).join(" · ")}</div>
            </li>
          ))}
          {!vm.recentOperations.length ? <li className="muted">暂无作业报告</li> : null}
        </ul>
      </section>

      <section className="customerCard">
        <h3 className="customerCardTitle">设备与监测</h3>
        <div className="customerGrid customerGridCols2">
          {vm.deviceMonitoring.map((item) => (
            <div key={item.label}><strong>{item.label}：</strong>{item.value}</div>
          ))}
        </div>
        {!hasGeometry ? <div className="muted customerSpacingTopXs">暂无地块边界数据</div> : null}
      </section>

      <section className="customerCard">
        <h3 className="customerCardTitle">ROI 摘要</h3>
        <div>{'lines' in vm.roiSummary ? vm.roiSummary.lines.join("；") : `${vm.roiSummary.title}：${vm.roiSummary.description}`}</div>
      </section>

      <section className="customerCard">
        <h3 className="customerCardTitle">地块记忆</h3>
        <div>{'lines' in vm.fieldMemory ? vm.fieldMemory.lines.join("；") : `${vm.fieldMemory.title}：${vm.fieldMemory.description}`}</div>
      </section>

      <section className="customerCard">
        <h3 className="customerCardTitle">导出</h3>
        {canExport ? <Link className="customerButton customerButtonPrimary" to={vm.exportHref}>打印导出</Link> : <span className="muted">导出不可用：缺少地块标识</span>}
      </section>
      </div>
    </div>
  );
}
