import React from "react";
import type { OperationDetailPageVm } from "../../viewmodels/operationDetailViewModel";

export default function OperationDecisionCard({ model }: { model: OperationDetailPageVm }): React.ReactElement {
  return (
    <section className="card sectionBlock">
      <div className="sectionTitle">B. 为什么做</div>
      <div className="kv"><span className="k">建议标题</span><span className="v">{model.recommendation.title}</span></div>
      <div className="kv"><span className="k">建议摘要</span><span className="v">{model.recommendation.summary}</span></div>
      <div className="kv"><span className="k">原因说明</span><span className="v">{model.recommendation.reasonCodes.length ? model.recommendation.reasonCodes.join("；") : "基于当前田间信号和作物状态，系统建议尽快执行本次作业。"}</span></div>
      <div className="kv"><span className="k">审批状态</span><span className="v">{model.approval.decisionLabel}</span></div>
      <div className="kv"><span className="k">审批人</span><span className="v">{model.approval.actorLabel}</span></div>
      <div className="kv"><span className="k">审批时间</span><span className="v">{model.approval.decidedAtLabel}</span></div>
    </section>
  );
}
