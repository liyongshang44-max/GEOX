import React from "react";
import { Link, useSearchParams } from "react-router-dom";
import { createOperatorEvidenceExportJob, fetchOperatorEvidence, fetchOperatorEvidenceJobDetail } from "../../api/operatorEvidence";
import { fetchOperationReport, type OperationReportV1 } from "../../api/reports";
import { fetchSessionMe, type SessionMe } from "../../api/session";
import { EvidenceGapPanel, EvidenceRefList, EvidenceTrustBadge, EvidenceTrustLegend } from "../../components/evidence";
import OperatorEmptyState from "../../components/operator/OperatorEmptyState";
import PermissionGate from "../../components/operator/PermissionGate";
import { OperatorAcceptanceReasonPanel, OperatorEvidenceGapPanel, OperatorFailSafePanel, OperatorFormalChainTimeline, OperatorManualTakeoverPanel, OperatorZoneMatrixPanel } from "../../components/operator/OperatorScenarioReviewPanels";
import { isPermissionDeniedError, OperatorPageStateView, sanitizeOperatorError, withOperatorLoadTimeout, type OperatorPageRuntimeState } from "../../components/operator/OperatorPageState";
import OperatorLayout from "../../layouts/OperatorLayout";
import { buildEvidenceVm } from "../../lib/evidenceViewModel";
import { replaceOperatorTerms } from "../../lib/operatorStatusLabels";
import { hasOperatorPermission, permissionReason } from "../../lib/permissions";
import "../../styles/operatorEvidence.css";
import { buildOperatorEvidenceVm, type OperatorEvidenceRowVm, type OperatorEvidenceVm } from "../../viewmodels/operatorEvidenceVm";
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
  const [session, setSession] = React.useState<SessionMe | null>(null);
  const [sessionLoading, setSessionLoading] = React.useState(true);
  const [jobActionMessage, setJobActionMessage] = React.useState("");
  const [refreshingJobId, setRefreshingJobId] = React.useState("");


  React.useEffect(() => {
    let alive = true;
    setSessionLoading(true);
    void fetchSessionMe()
      .then((nextSession) => { if (alive) setSession(nextSession); })
      .catch(() => { if (alive) setSession(null); })
      .finally(() => { if (alive) setSessionLoading(false); });
    return () => { alive = false; };
  }, []);

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

  const canExportEvidence = hasOperatorPermission(session, "export_evidence");
  const exportEvidenceReason = permissionReason(session, "export_evidence");

  async function reloadEvidenceJobs(): Promise<void> {
    const response = await fetchOperatorEvidence(operationId);
    setVm(buildOperatorEvidenceVm(response));
  }


  async function createEvidenceExportJob(): Promise<void> {
    if (!operationId) { setJobActionMessage("请先选择 operation_id 后再创建证据导出任务。"); return; }
    if (!canExportEvidence) { setJobActionMessage(exportEvidenceReason || "缺少会话权限：operator_evidence_export"); return; }
    const now = Date.now();
    const tenantScope = session?.tenant_id || "tenant_scope_pending";
    setJobActionMessage("正在创建证据导出任务...");
    try {
      const result = await createOperatorEvidenceExportJob({
        operation_id: operationId,
        scope_type: "TENANT",
        scope_id: tenantScope,
        from_ts_ms: now - 24 * 60 * 60 * 1000,
        to_ts_ms: now,
        export_format: "json",
        export_language: "zh-CN",
      });
      if (result.ok) await reloadEvidenceJobs();
      setJobActionMessage(result.ok ? `${result.message}${result.jobId ? ` job_id=${result.jobId}` : ""}` : result.message);
    } catch (error) {
      setJobActionMessage(safeMessage(error, "创建证据导出任务失败。"));
    }
  }

  async function refreshEvidenceJob(row: OperatorEvidenceRowVm): Promise<void> {
    setRefreshingJobId(row.jobId);
    setJobActionMessage("正在刷新 job detail...");
    try {
      const result = await fetchOperatorEvidenceJobDetail(row.jobId, row.objectText || operationId);
      if (result.ok) await reloadEvidenceJobs();
      setJobActionMessage(result.message);
    } catch (error) {
      setJobActionMessage(safeMessage(error, "刷新 job detail 失败。"));
    } finally {
      setRefreshingJobId("");
    }
  }

  return (
    <OperatorLayout title={meta.title} lead={meta.lead}>
      {pageState === "loading" ? <OperatorPageStateView state="loading" /> : null}
      {pageState === "error" ? <OperatorPageStateView state="error" reason={errorReason} /> : null}
      {pageState === "permission-denied" ? <OperatorPageStateView state="permission-denied" reason={errorReason} /> : null}
      {vm ? (
        <div className="operatorEvidencePage">
          <section className="operatorWorkbenchSummary"><div><span>数据范围</span><strong>{vm.dataScopeText}</strong></div><div><span>证据导出任务</span><strong>{vm.totalCount} 个证据任务</strong></div><div><span>更新时间</span><strong>{vm.generatedAtText}</strong></div></section>
          <section className="operatorEvidenceOperationPanel" aria-label="证据中心导出任务"><div><span>证据中心</span><strong>证据导出任务</strong><small>创建任务前必须通过会话权限、审计与 operation_id 校验；缺少会话权限：operator_evidence_export。</small></div><div className="operatorEvidenceOperationActions">{operationHref ? <Link to={operationHref}>去作业报告查看证据摘要</Link> : <button type="button" disabled>去作业报告查看证据摘要</button>}<PermissionGate permissionKey="export_evidence" allowed={canExportEvidence} loading={sessionLoading} disabledReason={exportEvidenceReason}>{() => <button type="button" disabled={!operationId || !canExportEvidence} onClick={() => void createEvidenceExportJob()}>创建证据导出任务</button>}</PermissionGate></div>{!operationHref ? <div className="operatorScopeWarning">请从具体作业进入证据中心，或在作业报告中查看证据摘要。</div> : null}</section>
          <div className="operatorEvidenceNotice">证据包下载链接仍由后端授权返回；页面仅展示安全状态、sha256 校验摘要和 job detail 刷新结果，不展示对象存储内部路径。</div>
          {jobActionMessage ? <div className="operatorScopeWarning">{replaceOperatorTerms(jobActionMessage)}</div> : null}
          {vm.rows.length ? <section className="operatorQueueGrid" aria-label="证据导出任务列表">{vm.rows.map((row) => <article key={row.jobId} className="operatorQueueCard"><header className="operatorQueueHead"><h2>{row.jobId}</h2><span>{row.statusText}</span></header><p>operation_id：{row.objectText}</p><p>scope：{row.scopeText}</p><p>artifact：{row.artifactText}</p><p>sha256：{row.checksumText}</p><p>下载状态：{row.downloadText}</p><p>失败原因：{row.failureReasonText}</p><button type="button" disabled={Boolean(refreshingJobId)} onClick={() => void refreshEvidenceJob(row)}>{refreshingJobId === row.jobId ? "刷新中..." : "刷新 job detail"}</button></article>)}</section> : null}
          {vm.dataScopeWarning ? <div className="operatorScopeWarning">{safeMessage(vm.dataScopeWarning)}</div> : null}
          {reportWarning ? <div className="operatorScopeWarning">{reportWarning}</div> : null}
          {!operationId ? <OperatorEmptyState title="暂无待处理事项" description="当前没有指定作业，证据中心只展示入口说明。" reason="没有作业编号时不伪造证据包、校验结果或下载任务。" /> : null}
          {operationReport ? <section className="operatorQueueGrid" aria-label="formal-scenario-review"><article className="operatorQueueCard"><header className="operatorQueueHead"><h2>ROI Trust Lane</h2></header><p>Trust level: {String((operationReport as any)?.formal_scenario?.formal_chain_status ?? "LIMITED")}</p><p>Low confidence items: {String((operationReport as any)?.roi_ledger?.summary?.low_confidence_items ?? 0)}</p><p>Insufficient evidence items: {String((operationReport as any)?.roi_ledger?.summary?.insufficient_items ?? 0)}</p></article><article className="operatorQueueCard"><header className="operatorQueueHead"><h2>Field Memory Lane</h2></header><p>Field response memory: {String((operationReport as any)?.field_memory?.field_response_memory?.length ?? 0)}</p><p>Device reliability memory: {String((operationReport as any)?.field_memory?.device_reliability_memory?.length ?? 0)}</p><p>Skill performance memory: {String((operationReport as any)?.field_memory?.skill_performance_memory?.length ?? 0)}</p></article><article className="operatorQueueCard"><header className="operatorQueueHead"><h2>Unified Evidence Viewer</h2></header>{(() => { const evidenceVm = buildEvidenceVm(operationReport); return <><EvidenceTrustLegend vm={evidenceVm} /><EvidenceTrustBadge vm={evidenceVm} /><EvidenceRefList vm={evidenceVm} mode="operator" /><EvidenceGapPanel vm={evidenceVm} /></>; })()}</article><OperatorFormalChainTimeline report={operationReport} /><OperatorEvidenceGapPanel report={operationReport} /><OperatorAcceptanceReasonPanel report={operationReport} /><OperatorFailSafePanel report={operationReport} /><OperatorManualTakeoverPanel report={operationReport} /><OperatorZoneMatrixPanel report={operationReport} /></section> : null}
        </div>
      ) : null}
    </OperatorLayout>
  );
}
