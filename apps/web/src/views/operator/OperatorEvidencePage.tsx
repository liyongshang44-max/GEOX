import React from "react";
import { Link, useSearchParams } from "react-router-dom";
import { fetchOperatorEvidence } from "../../api/operatorEvidence";
import { fetchOperationReport, type OperationReportV1 } from "../../api/reports";
import { EvidenceGapPanel, EvidenceRefList, EvidenceTrustBadge, EvidenceTrustLegend } from "../../components/evidence";
import OperatorEmptyState from "../../components/operator/OperatorEmptyState";
import { OperatorAcceptanceReasonPanel, OperatorEvidenceGapPanel, OperatorFailSafePanel, OperatorFormalChainTimeline, OperatorManualTakeoverPanel, OperatorZoneMatrixPanel } from "../../components/operator/OperatorScenarioReviewPanels";
import { isPermissionDeniedError, OperatorPageStateView, sanitizeOperatorError, withOperatorLoadTimeout, type OperatorPageRuntimeState } from "../../components/operator/OperatorPageState";
import OperatorLayout from "../../layouts/OperatorLayout";
import { buildEvidenceVm } from "../../lib/evidenceViewModel";
import { replaceOperatorTerms } from "../../lib/operatorStatusLabels";
import "../../styles/operatorEvidence.css";
import { buildOperatorEvidenceVm, type OperatorEvidenceVm } from "../../viewmodels/operatorEvidenceVm";
import { OPERATOR_PAGE_META } from "./operatorPageMeta";

const PAGE_NAME = "证据中心";

function safeMessage(value: unknown, fallback = "暂无状态说明。") {
  return sanitizeOperatorError(value, fallback);
}

export default function OperatorEvidencePage(): React.ReactElement {
  const [searchParams] = useSearchParams();
  const operationId = searchParams.get("operation_id") ?? "";
  const meta = OPERATOR_PAGE_META.evidence;
  const [pageState, setPageState] = React.useState<OperatorPageRuntimeState>("loading");
  const [errorReason, setErrorReason] = React.useState("");
  const [vm, setVm] = React.useState<OperatorEvidenceVm | null>(null);
  const [operationReport, setOperationReport] = React.useState<OperationReportV1 | null>(null);
  const [reportWarning, setReportWarning] = React.useState("");

  React.useEffect(() => {
    let alive = true;
    setPageState("loading");
    setErrorReason("");
    setReportWarning("");
    setVm(null);
    setOperationReport(null);
    void withOperatorLoadTimeout(fetchOperatorEvidence(operationId), PAGE_NAME)
      .then((response) => {
        if (!alive) return;
        const nextVm = buildOperatorEvidenceVm(response);
        setVm(nextVm);
        setPageState("data-ready");
      })
      .catch((error: unknown) => {
        if (!alive) return;
        setVm(null);
        setErrorReason(sanitizeOperatorError(error));
        setPageState(isPermissionDeniedError(error) ? "permission-denied" : "error");
      });

    if (operationId) {
      void withOperatorLoadTimeout(fetchOperationReport(operationId), "作业证据摘要", 10_000)
        .then((res) => { if (alive) setOperationReport(res); })
        .catch((error: unknown) => { if (alive) setReportWarning(safeMessage(error, "作业证据摘要暂时不可用，证据中心仍保持只读说明。")); });
    }
    return () => { alive = false; };
  }, [operationId]);

  const operationHref = operationId ? `/customer/operations/${encodeURIComponent(operationId)}` : "";

  return (
    <OperatorLayout title={meta.title} lead={meta.lead}>
      {pageState === "loading" ? <OperatorPageStateView state="loading" /> : null}
      {pageState === "error" ? <OperatorPageStateView state="error" reason={errorReason} /> : null}
      {pageState === "permission-denied" ? <OperatorPageStateView state="permission-denied" reason={errorReason} /> : null}
      {vm ? (
        <div className="operatorEvidencePage">
          <section className="operatorWorkbenchSummary"><div><span>数据范围</span><strong>{vm.dataScopeText}</strong></div><div><span>证据导出任务</span><strong>暂未开放</strong></div><div><span>更新时间</span><strong>{vm.generatedAtText}</strong></div></section>
          <section className="operatorEvidenceOperationPanel" aria-label="证据中心未开放说明"><div><span>证据中心</span><strong>证据导出任务暂未开放</strong><small>当前仅支持在作业报告中查看证据摘要。待权限、审计和错误码收口后开放导出任务。</small></div><div className="operatorEvidenceOperationActions">{operationHref ? <Link to={operationHref}>去作业报告查看证据摘要</Link> : <button type="button" disabled>去作业报告查看证据摘要</button>}<button type="button" disabled>创建证据导出任务</button></div>{!operationHref ? <div className="operatorScopeWarning">请从具体作业进入证据中心，或在作业报告中查看证据摘要。</div> : null}</section>
          <div className="operatorEvidenceNotice">当前页面为只读未开放状态，不创建导出任务，不提供下载入口，不展示文件校验或证据包内部结构。</div>
          {vm.dataScopeWarning ? <div className="operatorScopeWarning">{safeMessage(vm.dataScopeWarning)}</div> : null}
          {reportWarning ? <div className="operatorScopeWarning">{reportWarning}</div> : null}
          {!operationId ? <OperatorEmptyState title="暂无待处理事项" description="当前没有指定作业，证据中心只展示入口说明。" reason="没有作业编号时不伪造证据包、校验结果或下载任务。" /> : null}
          {operationReport ? <section className="operatorQueueGrid" aria-label="formal-scenario-review"><article className="operatorQueueCard"><header className="operatorQueueHead"><h2>ROI Trust Lane</h2></header><p>Trust level: {String((operationReport as any)?.formal_scenario?.formal_chain_status ?? "LIMITED")}</p><p>Low confidence items: {String((operationReport as any)?.roi_ledger?.summary?.low_confidence_items ?? 0)}</p><p>Insufficient evidence items: {String((operationReport as any)?.roi_ledger?.summary?.insufficient_items ?? 0)}</p></article><article className="operatorQueueCard"><header className="operatorQueueHead"><h2>Field Memory Lane</h2></header><p>Field response memory: {String((operationReport as any)?.field_memory?.field_response_memory?.length ?? 0)}</p><p>Device reliability memory: {String((operationReport as any)?.field_memory?.device_reliability_memory?.length ?? 0)}</p><p>Skill performance memory: {String((operationReport as any)?.field_memory?.skill_performance_memory?.length ?? 0)}</p></article><article className="operatorQueueCard"><header className="operatorQueueHead"><h2>Unified Evidence Viewer</h2></header>{(() => { const evidenceVm = buildEvidenceVm(operationReport); return <><EvidenceTrustLegend vm={evidenceVm} /><EvidenceTrustBadge vm={evidenceVm} /><EvidenceRefList vm={evidenceVm} mode="operator" /><EvidenceGapPanel vm={evidenceVm} /></>; })()}</article><OperatorFormalChainTimeline report={operationReport} /><OperatorEvidenceGapPanel report={operationReport} /><OperatorAcceptanceReasonPanel report={operationReport} /><OperatorFailSafePanel report={operationReport} /><OperatorManualTakeoverPanel report={operationReport} /><OperatorZoneMatrixPanel report={operationReport} /></section> : null}
        </div>
      ) : null}
    </OperatorLayout>
  );
}
