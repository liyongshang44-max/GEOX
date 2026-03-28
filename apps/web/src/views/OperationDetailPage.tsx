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

const COPY = {
  detailUnavailable: "作业详情暂不可用",
  operationNotFound: "未找到对应作业",
  detailTitle: "A. 顶部概览",
  backToList: "返回作业列表",
  evidenceBundle: "D. 证据包",
  executionEvidence: "E. 执行证据",
  acceptanceResult: "F. 验收结果",
  timeline: "G. 全链路时间线",
} as const;

export default function OperationDetailPage(): React.ReactElement {
  const { operationPlanId = "" } = useParams();
  const { loading, error, detail, reload } = useOperationDetail(operationPlanId);

  if (loading) return <SectionSkeleton kind="detail" />;
  if (error || !detail) return <ErrorState title={COPY.detailUnavailable} message={error || COPY.operationNotFound} onRetry={() => void reload()} />;
  const model = buildOperationDetailViewModel(detail);
  const minimumAcceptanceLabel = !model.receiptEvidence
    ? "待回传执行证据"
    : model.receiptEvidence.constraintCheckLabel === "符合约束"
      ? "已满足（已回传证据且符合约束）"
      : "未满足（需人工复核）";
  const topStatusLabel = ["SUCCEEDED", "SUCCESS", "EXECUTED"].includes(String(model.finalStatus).toUpperCase()) ? "已完成" : "进行中";

  return (
    <div className="productPage" style={{ display: "grid", gap: 14 }}>
      <section className="card sectionBlock">
        <div className="sectionHeader">
          <div>
            <div className="sectionTitle">{COPY.detailTitle}</div>
            <div style={{ fontSize: 20, fontWeight: 700, marginTop: 8 }}>作业详情</div>
            <div className="muted" style={{ marginTop: 4 }}>{model.fieldLabel} · {model.programLabel}</div>
          </div>
          <div style={{ display: "flex", gap: 8 }}>
            <span className="badge neutral">{topStatusLabel}</span>
            <Link className="btn" to="/operations">{COPY.backToList}</Link>
            <button className="btn" type="button" onClick={() => void reload()}>刷新</button>
          </div>
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(2, minmax(0, 1fr))", gap: 10 }}>
          <div className="kv"><span className="k">动作</span><span className="v">{model.execution.actionType}</span></div>
          <div className="kv"><span className="k">执行器</span><span className="v">{model.execution.deviceId} / {model.execution.executorLabel}</span></div>
          <div className="kv"><span className="k">更新时间</span><span className="v">{model.latestUpdatedAtLabel}</span></div>
          <div className="kv"><span className="k">当前状态</span><span className="v">{model.statusLabel}</span></div>
        </div>
        <details style={{ marginTop: 10 }}>
          <summary className="muted" style={{ cursor: "pointer" }}>展开查看次级信息</summary>
          <div className="kv"><span className="k">作业编号</span><span className="v mono">{model.operationPlanId}</span></div>
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
