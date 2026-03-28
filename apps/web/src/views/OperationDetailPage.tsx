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

export default function OperationDetailPage(): React.ReactElement {
  const { operationPlanId = "" } = useParams();
  const { loading, error, detail, reload } = useOperationDetail(operationPlanId);

  if (loading) return <SectionSkeleton kind="detail" />;
  if (error || !detail) return <ErrorState title="作业详情暂不可用" message={error || "未找到对应作业"} onRetry={() => void reload()} />;
  const model = buildOperationDetailViewModel(detail);

  return (
    <div className="productPage" style={{ display: "grid", gap: 14 }}>
      <section className="card sectionBlock">
        <div className="sectionHeader">
          <div>
            <div className="sectionTitle">作业详情</div>
            <div className="muted">operation_plan_id：{model.operationPlanId}</div>
          </div>
          <div style={{ display: "flex", gap: 8 }}>
            <Link className="btn" to="/operations">返回作业列表</Link>
            <button className="btn" type="button" onClick={() => void reload()}>刷新</button>
          </div>
        </div>
        <div className="kv"><span className="k">作业状态</span><span className="v">{model.statusLabel}</span></div>
        <div className="kv"><span className="k">所属田块</span><span className="v">{model.fieldLabel}</span></div>
        <div className="kv"><span className="k">所属经营方案</span><span className="v">{model.programLabel}</span></div>
      </section>

      <OperationDecisionCard model={model} />
      <OperationExecutionCard model={model} />

      <section className="card sectionBlock">
        <div className="sectionTitle">最新执行证据</div>
        <ReceiptEvidenceCard data={model.receiptEvidence} />
      </section>

      <OperationStoryTimeline items={model.timeline} />
      <OperationEvidenceDownloadCard model={model} />
    </div>
  );
}
