import React from "react";
import type { OperationDetailPageVm } from "../../viewmodels/operationDetailViewModel";

export default function OperationDecisionCard({ model }: { model: OperationDetailPageVm }): React.ReactElement {
  return (
    <section className="card sectionBlock">
      <div className="sectionTitle">审批信息</div>
      <div className="kv"><span className="k">作业目的</span><span className="v">{model.recommendation.title}</span></div>
      <div className="kv"><span className="k">作业原因</span><span className="v">{model.recommendation.summary}</span></div>
      <div className="kv"><span className="k">触发依据</span><span className="v">{model.recommendation.reasonCodes.length ? model.recommendation.reasonCodes.join(" / ") : "系统根据作物与环境状态触发该作业"}</span></div>
      <div className="kv"><span className="k">审批结果</span><span className="v">{model.approval.decisionLabel}</span></div>
      <div className="kv"><span className="k">批准人</span><span className="v">{model.approval.actorLabel}</span></div>
      <div className="kv"><span className="k">批准时间</span><span className="v">{model.approval.decidedAtLabel}</span></div>
    </section>
  );
}
