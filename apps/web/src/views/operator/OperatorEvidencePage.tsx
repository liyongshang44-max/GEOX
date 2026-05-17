import React from "react";
import { Link, useSearchParams } from "react-router-dom";
import { fetchOperatorEvidence } from "../../api/operatorEvidence";
import { fetchOperationReport, type OperationReportV1 } from "../../api/reports";
import { OperatorAcceptanceReasonPanel, OperatorEvidenceGapPanel, OperatorFailSafePanel, OperatorFormalChainTimeline, OperatorManualTakeoverPanel, OperatorZoneMatrixPanel } from "../../components/operator/OperatorScenarioReviewPanels";
import OperatorLayout from "../../layouts/OperatorLayout";
import { replaceOperatorTerms } from "../../lib/operatorStatusLabels";
import "../../styles/operatorEvidence.css";
import { buildOperatorEvidenceVm, type OperatorEvidenceVm } from "../../viewmodels/operatorEvidenceVm";
import { OPERATOR_PAGE_META } from "./operatorPageMeta";
import { buildEvidenceVm } from "../../lib/evidenceViewModel";
import { EvidenceGapPanel, EvidenceRefList, EvidenceTrustBadge, EvidenceTrustLegend } from "../../components/evidence";

function safeMessage(value: unknown, fallback = "暂无状态说明。") {
  const text = String(value ?? "").trim();
  if (!text || text === "--") return fallback;
  if (/token|secret|credential|private\s*key|password|stack\s*trace|debug\s*json|access[_-]?key/i.test(text)) return fallback;
  return replaceOperatorTerms(text);
}

export default function OperatorEvidencePage(): React.ReactElement {
  const [searchParams] = useSearchParams();
  const operationId = searchParams.get("operation_id") ?? "";
  const meta = OPERATOR_PAGE_META.evidence;
  const [loading, setLoading] = React.useState(true);
  const [vm, setVm] = React.useState<OperatorEvidenceVm | null>(null);
  const [operationReport, setOperationReport] = React.useState<OperationReportV1 | null>(null);

  React.useEffect(() => {
    let alive = true;
    setLoading(true);
    void fetchOperatorEvidence(operationId)
      .then((response) => {
        if (!alive) return;
        setVm(buildOperatorEvidenceVm(response));
      })
      .catch(() => {
        if (!alive) return;
        setVm(null);
      })
      .finally(() => {
        if (!alive) return;
        setLoading(false);
      });
    if (operationId) {
      void fetchOperationReport(operationId).then((res) => { if (alive) setOperationReport(res); }).catch(() => { if (alive) setOperationReport(null); });
    } else {
      setOperationReport(null);
    }
    return () => {
      alive = false;
    };
  }, [operationId]);

  const operationHref = operationId ? `/customer/operations/${encodeURIComponent(operationId)}` : "";

  return (
    <OperatorLayout title={meta.title} lead={meta.lead}>
      {loading ? <div className="operatorEmptyState">证据中心加载中...</div> : null}
      {!loading ? (
        <div className="operatorEvidencePage">
          <section className="operatorWorkbenchSummary">
            <div><span>数据范围</span><strong>{vm?.dataScopeText ?? "证据中心暂未开放"}</strong></div>
            <div><span>证据导出任务</span><strong>暂未开放</strong></div>
            <div><span>更新时间</span><strong>{vm?.generatedAtText ?? "暂无更新时间"}</strong></div>
          </section>

          <section className="operatorEvidenceOperationPanel" aria-label="证据中心未开放说明">
            <div>
              <span>证据中心</span>
              <strong>证据导出任务暂未开放</strong>
              <small>当前仅支持在作业报告中查看证据摘要。待权限、审计和错误码收口后开放导出任务。</small>
            </div>
            <div className="operatorEvidenceOperationActions">
              {operationHref ? <Link to={operationHref}>去作业报告查看证据摘要</Link> : <button type="button" disabled>去作业报告查看证据摘要</button>}
              <button type="button" disabled>创建证据导出任务</button>
            </div>
            {!operationHref ? <div className="operatorScopeWarning">请从具体作业进入证据中心，或在作业报告中查看证据摘要。</div> : null}
          </section>

          <div className="operatorEvidenceNotice">当前页面为只读未开放状态，不创建导出任务，不提供下载入口，不展示文件校验或证据包内部结构。</div>
          {vm?.dataScopeWarning ? <div className="operatorScopeWarning">{safeMessage(vm.dataScopeWarning)}</div> : null}
          {operationReport ? (
            <section className="operatorQueueGrid" aria-label="formal-scenario-review">
              <article className="operatorQueueCard"><header className="operatorQueueHead"><h2>ROI Trust Lane</h2></header><p>Trust level: {String((operationReport as any)?.formal_scenario?.formal_chain_status ?? "LIMITED")}</p><p>Low confidence items: {String((operationReport as any)?.roi_ledger?.summary?.low_confidence_items ?? 0)}</p><p>Insufficient evidence items: {String((operationReport as any)?.roi_ledger?.summary?.insufficient_items ?? 0)}</p></article>
              <article className="operatorQueueCard"><header className="operatorQueueHead"><h2>Field Memory Lane</h2></header><p>Field response memory: {String((operationReport as any)?.field_memory?.field_response_memory?.length ?? 0)}</p><p>Device reliability memory: {String((operationReport as any)?.field_memory?.device_reliability_memory?.length ?? 0)}</p><p>Skill performance memory: {String((operationReport as any)?.field_memory?.skill_performance_memory?.length ?? 0)}</p></article>
              <article className="operatorQueueCard"><header className="operatorQueueHead"><h2>Unified Evidence Viewer</h2></header>{(() => { const evidenceVm = buildEvidenceVm(operationReport); return <><EvidenceTrustLegend vm={evidenceVm} /><EvidenceTrustBadge vm={evidenceVm} /><EvidenceRefList vm={evidenceVm} mode="operator" /><EvidenceGapPanel vm={evidenceVm} /></>; })()}</article>
              <OperatorFormalChainTimeline report={operationReport} />
              <OperatorEvidenceGapPanel report={operationReport} />
              <OperatorAcceptanceReasonPanel report={operationReport} />
              <OperatorFailSafePanel report={operationReport} />
              <OperatorManualTakeoverPanel report={operationReport} />
              <OperatorZoneMatrixPanel report={operationReport} />
            </section>
          ) : null}
        </div>
      ) : null}
    </OperatorLayout>
  );
}
