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
  const hasHighPriorityRisk = vm.risk.tone !== "neutral";
  const suggestedAction = vm.recommendations[0];

  return (
    <div className="customerReportCanvas">
      <div className="customerReportSheet customerPageGapMd">
      <section className="customerReportHeader">
        <div className="customerEyebrow">GEOX / 地块病历</div>
        <h1 className="customerTitle">{vm.field.fieldName}</h1>
        <p className="customerSubtitle">地块ID：{vm.field.fieldId}</p>
        <div className="customerGrid customerGridCols2 customerSpacingTopXs">
          <div><strong>作物：</strong>{vm.field.cropText}</div>
          <div><strong>阶段：</strong>{vm.field.stageText}</div>
          <div><strong>风险等级：</strong>{vm.risk.levelLabel}</div>
          <div><strong>设备状态摘要：</strong>{`在线 ${vm.deviceSummary.onlineText}/${vm.deviceSummary.totalText}，离线 ${vm.deviceSummary.offlineText}`}</div>
          <div><strong>更新时间：</strong>{vm.field.updatedAtText}</div>
        </div>
        <div className="customerActionRow">
          <Link className="customerButton" to="/customer/dashboard">返回客户总览</Link>
          {canExport ? (
            <Link className="customerButton customerButtonPrimary" to={vm.exportHref}>导出地块报告</Link>
          ) : (
            <span className="muted">导出不可用：缺少地块标识</span>
          )}
        </div>
      </section>

      <section className="customerCard">
        <h3 className="customerCardTitle">当前风险</h3>
        <div><strong>当前风险等级：</strong>{vm.risk.levelLabel}</div>
        {hasHighPriorityRisk ? (
          <>
            <div className="customerSpacingTopXs"><strong>风险原因：</strong></div>
            <ul className="customerList">
              {vm.risk.reasons.map((item, idx) => <li key={`${item}-${idx}`} className="customerListItem">{item}</li>)}
            </ul>
          </>
        ) : (
          <div className="muted customerSpacingTopXs">暂无高优先级风险</div>
        )}
        <div className="customerSpacingTopXs"><strong>影响说明：</strong>{vm.diagnosis.headline}</div>
        <div className="customerSpacingTopXs">
          <strong>建议查看动作：</strong>
          {suggestedAction?.href ? <Link to={suggestedAction.href}>{suggestedAction.title}</Link> : <span className="muted"> 暂无建议动作</span>}
        </div>
      </section>

      <section className="customerCard">
        <h3 className="customerCardTitle">诊断结论</h3>
        <div><strong>主问题一句话：</strong>{vm.diagnosis.headline}</div>
        <div className="customerSpacingTopXs"><strong>诊断依据：</strong></div>
        <ul className="customerList">
          {vm.diagnosis.evidenceLines.map((item, idx) => (
            <li key={`${item}-${idx}`} className="customerListItem">{item}</li>
          ))}
        </ul>
        <div className="customerSpacingTopXs"><strong>数据质量：</strong>{vm.diagnosis.dataQualityText}</div>
        <div className="customerSpacingTopXs"><strong>最新观测摘要：</strong>{vm.diagnosis.latestObservationText}</div>
      </section>

      <section className="customerCard">
        <h3 className="customerCardTitle">当前建议</h3>
        {vm.nextAction ? (
          <article className="customerListItem customerListItemOk">
            <div><strong>当前建议：</strong>{vm.nextAction.title}</div>
            <div className="customerSpacingTopXs"><strong>处方摘要：</strong>{vm.nextAction.explainText}</div>
            <div className="customerSpacingTopXs"><strong>下一步建议：</strong>{vm.nextAction.objectiveText}</div>
            <div className="customerSpacingTopXs">
              <strong>查看相关作业：</strong>
              {vm.recommendations[0]?.href ? <Link to={vm.recommendations[0].href}>查看相关作业</Link> : <span className="muted"> 暂无可查看作业</span>}
            </div>
          </article>
        ) : <div className="muted">暂无新的处理建议</div>}
      </section>

      <section className="customerCard">
        <h3 className="customerCardTitle">近期作业 Top 5</h3>
        <ul className="customerList">
          {vm.recentOperations.map((item) => (
            <li key={item.operationId || item.title} className="customerListItem">
              <div><strong>作业名称：</strong>{item.title}</div>
              <div><strong>状态：</strong>{item.statusText}</div>
              <div><strong>验收结果：</strong>{item.acceptanceText}</div>
              <div><strong>证据状态：</strong>{item.evidenceText}</div>
              <div><strong>更新时间：</strong>{item.updatedAtText}</div>
              <div><strong>查看作业：</strong><Link to={item.href}>查看作业</Link></div>
            </li>
          ))}
          {!vm.recentOperations.length ? <li className="muted">暂无近期作业记录</li> : null}
        </ul>
      </section>

      <section className="customerCard">
        <h3 className="customerCardTitle">设备与监测</h3>
        {Number(vm.deviceSummary.totalText) > 0 ? (
          <>
            <div><strong>设备状态摘要：</strong>{`在线 ${vm.deviceSummary.onlineText}/${vm.deviceSummary.totalText}，离线 ${vm.deviceSummary.offlineText}`}</div>
            <div className="customerSpacingTopXs"><strong>最近监测摘要：</strong>{`最近监测更新时间 ${vm.deviceSummary.lastUpdateText}`}</div>
            <div className="customerSpacingTopXs"><strong>异常提示：</strong>{Number(vm.deviceSummary.offlineText) > 0 ? `存在 ${vm.deviceSummary.offlineText} 台离线设备，建议尽快排查。` : "暂无设备异常"}</div>
          </>
        ) : (
          <div className="muted">暂无设备状态摘要</div>
        )}
        {!hasGeometry ? <div className="muted customerSpacingTopXs">暂无地块边界数据</div> : null}
      </section>

      <section className="customerCard">
        <h3 className="customerCardTitle">价值记录摘要</h3>
        <div>{'lines' in vm.roiSummary ? vm.roiSummary.lines.join("；") : `${vm.roiSummary.title}：${vm.roiSummary.description}`}</div>
      </section>

      <section className="customerCard">
        <h3 className="customerCardTitle">地块记忆</h3>
        <div>{'lines' in vm.fieldMemory ? vm.fieldMemory.lines.join("；") : `${vm.fieldMemory.title}：${vm.fieldMemory.description}`}</div>
      </section>

      <section className="customerCard">
        <h3 className="customerCardTitle">导出</h3>
        {canExport ? <Link className="customerButton customerButtonPrimary" to={vm.exportHref}>导出地块报告</Link> : <span className="muted">导出不可用：缺少地块标识</span>}
      </section>
      </div>
    </div>
  );
}
