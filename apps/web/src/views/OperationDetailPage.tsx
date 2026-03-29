import React from "react";
import { Link, useParams } from "react-router-dom";
import ErrorState from "../components/common/ErrorState";
import SectionSkeleton from "../components/common/SectionSkeleton";
import ReceiptEvidenceCard from "../components/evidence/ReceiptEvidenceCard";
import OperationDecisionCard from "../components/operations/OperationDecisionCard";
import OperationEvidenceDownloadCard from "../components/operations/OperationEvidenceDownloadCard";
import OperationExecutionCard from "../components/operations/OperationExecutionCard";
import OperationStoryTimeline from "../components/operations/OperationStoryTimeline";
import { useOperationDetail } from "../hooks/useOperationDetail";
import { buildOperationDetailViewModel } from "../viewmodels/operationDetailViewModel";
import { mapOperationActionLabel, mapOperationStatusLabel, mapDeviceDisplayName, mapFieldDisplayName } from "../lib/operationLabels";

const COPY = {
  detailUnavailable: "作业详情暂不可用",
  operationNotFound: "未找到对应作业",
  backToList: "返回作业列表",
  evidenceBundle: "证据包",
  executionEvidence: "执行证据",
  acceptanceResult: "验收结果",
  timeline: "全链路时间线",
} as const;

function buildResultSummary(model: ReturnType<typeof buildOperationDetailViewModel>): string {
  const finalStatus = mapOperationStatusLabel(model.finalStatus || model.statusLabel);
  if (model.receiptEvidence?.constraintCheckLabel === "符合约束") {
    return `已回传执行结果，当前状态为${finalStatus}，约束校验通过。`;
  }
  if (model.receiptEvidence?.violationSummary && model.receiptEvidence.violationSummary !== "-") {
    return `已回传执行结果，当前状态为${finalStatus}，存在复核提示。`;
  }
  if (!model.receiptEvidence) {
    return `当前状态为${finalStatus}，等待设备回传执行证据。`;
  }
  return `已回传执行结果，当前状态为${finalStatus}。`;
}

export default function OperationDetailPage(): React.ReactElement {
  const { operationPlanId = "" } = useParams();
  const { loading, error, detail, reload } = useOperationDetail(operationPlanId);

  if (loading) return <SectionSkeleton kind="detail" />;
  if (error || !detail) return <ErrorState title={COPY.detailUnavailable} message={error || COPY.operationNotFound} onRetry={() => void reload()} />;
  const model = buildOperationDetailViewModel(detail);
  const topStatusLabel = mapOperationStatusLabel(model.finalStatus || model.statusLabel);
  const actionLabel = mapOperationActionLabel(model.execution.actionType || model.actionLabel);
  const fieldLabel = mapFieldDisplayName(model.fieldLabel, model.fieldLabel);
  const deviceLabel = mapDeviceDisplayName(model.execution.deviceId || model.deviceLabel, model.deviceLabel);
  const minimumAcceptanceLabel = !model.receiptEvidence
    ? "待回传执行证据"
    : model.receiptEvidence.constraintCheckLabel === "符合约束"
      ? "已满足（已回传证据且符合约束）"
      : "未满足（需人工复核）";
  const resultSummary = buildResultSummary(model);

  return (
    <div className="productPage operationDetailPageV3" style={{ display: "grid", gap: 14 }}>
      <section className="card sectionBlock detailHeroCard detailHeroCardV3">
        <div className="sectionHeader">
          <div>
            <div className="eyebrow">GEOX / 作业复盘页</div>
            <h1 className="pageTitle" style={{ marginBottom: 6 }}>{actionLabel} · {fieldLabel} · {topStatusLabel}</h1>
            <div className="pageLead">{resultSummary}</div>
          </div>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            <span className="statusTag tone-neutral">{topStatusLabel}</span>
            <Link className="btn" to="/operations">{COPY.backToList}</Link>
            <button className="btn" type="button" onClick={() => void reload()}>刷新</button>
          </div>
        </div>

        <div className="operationsSummaryGrid detailSummaryGridV3">
          <div className="operationsSummaryMetric"><span className="operationsSummaryLabel">田块</span><strong>{fieldLabel}</strong></div>
          <div className="operationsSummaryMetric"><span className="operationsSummaryLabel">设备</span><strong>{deviceLabel}</strong></div>
          <div className="operationsSummaryMetric"><span className="operationsSummaryLabel">执行状态</span><strong>{model.execution.progressLabel}</strong></div>
          <div className="operationsSummaryMetric"><span className="operationsSummaryLabel">最新更新时间</span><strong>{model.latestUpdatedAtLabel}</strong></div>
        </div>

        <details className="traceDetails" style={{ marginTop: 14 }}>
          <summary>技术追踪信息</summary>
          <div className="traceGrid">
            <span>建议编号：{model.technicalRefs.recommendationId}</span>
            <span>审批编号：{model.technicalRefs.approvalRequestId}</span>
            <span>作业计划编号：{model.technicalRefs.operationPlanId}</span>
            <span>执行任务编号：{model.technicalRefs.actTaskId}</span>
          </div>
        </details>
      </section>

      <OperationDecisionCard model={model} />
      <OperationExecutionCard model={model} />
      <OperationEvidenceDownloadCard model={model} title={COPY.evidenceBundle} />

      <section className="card sectionBlock detailEvidenceCardV3">
        <div className="sectionTitle">{COPY.executionEvidence}</div>
        <div className="muted detailSectionLead">优先查看最近一次回执、资源消耗和约束校验，再决定是否需要人工复核。</div>
        <ReceiptEvidenceCard data={model.receiptEvidence} />
      </section>

      <section className="card sectionBlock detailAcceptanceCardV3">
        <div className="sectionTitle">{COPY.acceptanceResult}</div>
        <div className="kv"><span className="k">最终结果</span><span className="v">{model.execution.finalStatusLabel}</span></div>
        <div className="kv"><span className="k">约束校验</span><span className="v">{model.receiptEvidence?.constraintCheckLabel ?? "待回传证据后判断"}</span></div>
        {model.receiptEvidence?.violationSummary ? (
          <div className="kv"><span className="k">风险提示</span><span className="v">{model.receiptEvidence.violationSummary}</span></div>
        ) : null}
        <div className="kv"><span className="k">最低验收</span><span className="v">{minimumAcceptanceLabel}</span></div>
      </section>

      <OperationStoryTimeline items={model.timeline} title={COPY.timeline} />
    </div>
  );
}
