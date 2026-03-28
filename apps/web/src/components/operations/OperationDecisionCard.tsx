import React from "react";
import type { OperationDetailPageVm } from "../../viewmodels/operationDetailViewModel";

export default function OperationDecisionCard({ model }: { model: OperationDetailPageVm }): React.ReactElement {
  return (
    <section className="card sectionBlock">
      <div className="sectionTitle">决策信息</div>
      <div className="kv"><span className="k">建议 ID</span><span className="v mono">{model.recommendation.id}</span></div>
      <div className="kv"><span className="k">建议标题</span><span className="v">{model.recommendation.title}</span></div>
      <div className="kv"><span className="k">建议摘要</span><span className="v">{model.recommendation.summary}</span></div>
      <div className="kv"><span className="k">原因码</span><span className="v">{model.recommendation.reasonCodes.length ? model.recommendation.reasonCodes.join(" / ") : "-"}</span></div>
      <div className="kv"><span className="k">建议生成时间</span><span className="v">{model.recommendation.createdAtLabel}</span></div>
      <div className="kv"><span className="k">审批请求</span><span className="v mono">{model.approval.requestId}</span></div>
      <div className="kv"><span className="k">审批结论</span><span className="v">{model.approval.decisionLabel}</span></div>
      <div className="kv"><span className="k">审批人</span><span className="v">{model.approval.actorLabel}</span></div>
      <div className="kv"><span className="k">审批时间</span><span className="v">{model.approval.decidedAtLabel}</span></div>
    </section>
  );
}
