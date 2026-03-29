import React from "react";
import { useLocale } from "../../lib/locale";
import type { OperationDetailPageVm } from "../../viewmodels/operationDetailViewModel";

export default function OperationDecisionCard({ model }: { model: OperationDetailPageVm }): React.ReactElement {
  const { text } = useLocale();
  return (
    <section className="card sectionBlock geoxSectionCard">
      <div className="sectionTitle">{text("为什么执行这次作业", "Why this operation exists")}</div>
      <div className="kv"><span className="k">{text("建议标题", "Recommendation")}</span><span className="v">{model.recommendation.title}</span></div>
      <div className="kv"><span className="k">{text("建议摘要", "Summary")}</span><span className="v">{model.recommendation.summary}</span></div>
      <div className="kv"><span className="k">{text("原因标签", "Reason Codes")}</span><span className="v">{model.recommendation.reasonCodes.join(" / ") || text("暂无", "None")}</span></div>
      <div className="kv"><span className="k">{text("审批结果", "Approval")}</span><span className="v">{model.approval.decisionLabel}</span></div>
      <div className="kv"><span className="k">{text("审批人", "Actor")}</span><span className="v">{model.approval.actorLabel}</span></div>
      <div className="kv"><span className="k">{text("审批时间", "Approved At")}</span><span className="v">{model.approval.decidedAtLabel}</span></div>
    </section>
  );
}
