import React from "react";
import { Link, useParams } from "react-router-dom";
import { fetchFieldReport, type FieldReportDetailV1 } from "../api/customerReports";
import ErrorState from "../components/common/ErrorState";
import SectionSkeleton from "../components/common/SectionSkeleton";
import CustomerEmptyState from "../components/customer/CustomerEmptyState";
import RoiLedgerDrawer from "../components/customer/RoiLedgerDrawer";
import { getCustomerEmptyState } from "../lib/customerEmptyStates";
import { buildFieldReportVm } from "../viewmodels/fieldReportVm";

export default function FieldReportPage(): React.ReactElement {
  const { fieldId = "" } = useParams();
  const [loading, setLoading] = React.useState(true);
  const [report, setReport] = React.useState<FieldReportDetailV1 | null>(null);
  const [error, setError] = React.useState("");
  const [roiDrawerOpen, setRoiDrawerOpen] = React.useState(false);

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
  if (error || !report) return <ErrorState title="地块病历加载失败" message={error || "暂无地块病历"} onRetry={() => window.location.reload()} />;

  const vm = buildFieldReportVm(report);
  const canExport = Boolean(fieldId.trim());
  const geometry = (report as { field?: { geometry?: unknown } }).field?.geometry;
  const hasGeometry = Boolean(geometry);
  const hasOperationForRisk = Boolean(vm.recentOperations[0]?.operationId);
  const riskOperationHref = hasOperationForRisk ? vm.recentOperations[0].href : undefined;
  const evidenceSummaryExists = vm.diagnosis.evidenceLines.some((line) => line && !line.includes("暂无"));
  const suggestionOperation = vm.recentOperations.find((item) => Boolean(item.operationId));
  const hasRoiSummary = "lines" in vm.roiSummary && Array.isArray(vm.roiSummary.lines) && vm.roiSummary.lines.length > 0;
  const hasFieldMemory = "lines" in vm.fieldMemory && Array.isArray(vm.fieldMemory.lines) && vm.fieldMemory.lines.length > 0;
  const roiEmptyState = getCustomerEmptyState("NO_ROI");
  const fieldMemoryEmptyState = getCustomerEmptyState("NO_FIELD_MEMORY");
  const mapEmptyState = getCustomerEmptyState("MAP_UNAVAILABLE");
  const noRecentOperationsState = getCustomerEmptyState("NO_RECENT_OPERATIONS");
  const noPendingActionsState = getCustomerEmptyState("NO_PENDING_ACTIONS");
  const noEvidenceState = getCustomerEmptyState("NO_EVIDENCE");

  return (
    <div className="customerReportCanvas">
      <div className="customerReportSheet customerPageGapMd fieldReportLayout">
        <section className="customerCard fieldHeaderCard">
          <div>
            <div className="customerEyebrow">GEOX / 地块病历</div>
            <h1 className="customerTitle">{vm.field.fieldName}</h1>
            <div className="customerMetaRow">
              <span>作物阶段：{vm.field.stageText}</span>
              <span className={`riskBadge riskBadge${vm.risk.tone}`}>风险：{vm.risk.levelLabel}</span>
            </div>
          </div>
          <div className="customerActionRow">
            {canExport ? <Link className="customerButton customerButtonPrimary" to={vm.exportHref}>导出</Link> : <span className="muted">导出不可用</span>}
          </div>
        </section>

        <section className="fieldGrid fieldGrid3">
          <article className="customerCard">
            <h3 className="customerCardTitle">当前风险</h3>
            <div>{vm.diagnosis.headline}</div>
            {riskOperationHref ? <Link to={riskOperationHref}>查看相关作业</Link> : <span className="muted">暂无可关联作业</span>}
          </article>
          <article className="customerCard">
            <h3 className="customerCardTitle">诊断依据</h3>
            {evidenceSummaryExists ? (
              <ul className="customerList">
                {vm.diagnosis.evidenceLines.map((item, idx) => <li key={`${item}-${idx}`} className="customerListItem">{item}</li>)}
              </ul>
            ) : <CustomerEmptyState vm={noEvidenceState} />}
            {evidenceSummaryExists ? <Link to="#">查看证据摘要</Link> : null}
          </article>
          <article className="customerCard">
            <h3 className="customerCardTitle">当前建议</h3>
            {vm.nextAction ? (
              <>
                <div>{vm.nextAction.title}</div>
                <div className="customerSpacingTopXs">{vm.nextAction.explainText}</div>
                <div className="customerActionRow">
                  <Link to={suggestionOperation?.href || `/customer/fields/${encodeURIComponent(vm.field.fieldId)}`}>{suggestionOperation ? "查看作业" : "查看建议"}</Link>
                </div>
              </>
            ) : <CustomerEmptyState vm={noPendingActionsState} />}
          </article>
        </section>

        <section className="fieldGrid fieldGrid2">
          <article className="customerCard">
            <h3 className="customerCardTitle">近期作业</h3>
            {vm.recentOperations.length ? (
              <ul className="customerList">
                {vm.recentOperations.map((item) => (
                  <li key={item.operationId || item.title} className="customerListItem">
                    <div><strong>{item.title}</strong></div>
                    <div>{item.statusText} · {item.updatedAtText}</div>
                    <Link to={item.href}>查看作业</Link>
                  </li>
                ))}
              </ul>
            ) : <CustomerEmptyState vm={noRecentOperationsState} />}
          </article>
          <article className="customerCard">
            <h3 className="customerCardTitle">设备与监测摘要</h3>
            <div>在线 {vm.deviceSummary.onlineText}/{vm.deviceSummary.totalText}，离线 {vm.deviceSummary.offlineText}</div>
            <div className="customerSpacingTopXs">最近更新：{vm.deviceSummary.lastUpdateText}</div>
          </article>
        </section>

        <section className="fieldGrid fieldGrid3">
          <article className="customerCard">
            <div className="customerCardHeaderRow">
              <h3 className="customerCardTitle">价值记录</h3>
              <button type="button" className="customerLinkButton" onClick={() => setRoiDrawerOpen(true)}>查看明细</button>
            </div>
            {hasRoiSummary ? <div>{vm.roiSummary.displayText}</div> : <CustomerEmptyState vm={roiEmptyState} />}
          </article>
          <article className="customerCard">
            <h3 className="customerCardTitle">田块记忆</h3>
            {hasFieldMemory ? <div>{vm.fieldMemory.displayText}</div> : <CustomerEmptyState vm={fieldMemoryEmptyState} />}
          </article>
          <article className="customerCard mapPlaceholderCard" aria-disabled="true">
            <h3 className="customerCardTitle">地块范围</h3>
            {hasGeometry ? <div className="muted">已接入地块范围数据，当前以列表方式展示。</div> : <CustomerEmptyState vm={mapEmptyState} />}
          </article>
        </section>
      </div>
      <RoiLedgerDrawer
        open={roiDrawerOpen}
        fieldId={vm.field.fieldId}
        embeddedRoi={(report as any).roi_ledger ?? (report as any).roi ?? (report as any).value_summary}
        onClose={() => setRoiDrawerOpen(false)}
      />
    </div>
  );
}
