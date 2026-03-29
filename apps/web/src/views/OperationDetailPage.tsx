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
import { mapOperationActionLabel, mapOperationStatusLabel } from "../lib/operationLabels";

const COPY = {
  detailUnavailable: "作业详情暂不可用",
  operationNotFound: "未找到对应作业",
  backToList: "返回作业列表",
  evidenceBundle: "证据包",
  executionEvidence: "执行证据",
  acceptanceResult: "验收结果",
  timeline: "全链路时间线",
} as const;

export default function OperationDetailPage(): React.ReactElement {
  const { operationPlanId = "" } = useParams();
  const { loading, error, detail, reload } = useOperationDetail(operationPlanId);

  if (loading) return <SectionSkeleton kind="detail" />;
  if (error || !detail) return <ErrorState title={COPY.detailUnavailable} message={error || COPY.operationNotFound} onRetry={() => void reload()} />;
  const model = buildOperationDetailViewModel(detail);
  const topStatusLabel = mapOperationStatusLabel(model.finalStatus || model.statusLabel);
  const actionLabel = mapOperationActionLabel(model.execution.actionType || model.actionLabel);
  const minimumAcceptanceLabel = !model.receiptEvidence
    ? "待回传执行证据"
    : model.receiptEvidence.constraintCheckLabel === "符合约束"
      ? "已满足（已回传证据且符合约束）"
      : "未满足（需人工复核）";

  return (
    <div className="productPage operationDetailPageV2" style={{ display: "grid", gap: 14 }}>
      <section className="card sectionBlock detailHeroCard">
        <div className="sectionHeader">
          <div>
            <div className="eyebrow">GEOX / 作业闭环详情</div>
            <h1 className="pageTitle" style={{ marginBottom: 6 }}>{actionLabel}</h1>
            <div className="pageLead">{topStatusLabel} · {model.fieldLabel} · {model.execution.deviceId || model.deviceLabel}</div>
          </div>
          <div style={{ display: "flex", gap: 8 }}>
            <span className="statusTag tone-neutral">{topStatusLabel}</span>
            <Link className="btn" to="/operations">{COPY.backToList}</Link>
            <button className="btn" type="button" onClick={() => void reload()}>刷新</button>
          </div>
        </div>

        <div className="operationsSummaryGrid">
          <div className="operationsSummaryMetric"><span className="operationsSummaryLabel">田块</span><strong>{model.fieldLabel}</strong></div>
          <div className="operationsSummaryMetric"><span className="operationsSummaryLabel">设备</span><strong>{model.execution.deviceId}</strong></div>
          <div className="operationsSummaryMetric"><span className="operationsSummaryLabel">执行状态</span><strong>{model.execution.progressLabel}</strong></div>
          <div className="operationsSummaryMetric"><span className="operationsSummaryLabel">更新时间</span><strong>{model.latestUpdatedAtLabel}</strong></div>
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

      <section className="card sectionBlock">
        <div className="sectionTitle">{COPY.executionEvidence}</div>
        <ReceiptEvidenceCard data={model.receiptEvidence} />
      </section>

      <section className="card sectionBlock">
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
