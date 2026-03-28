import React from "react";
import type { OperationDetailPageVm } from "../../viewmodels/operationDetailViewModel";

export default function OperationDecisionCard({ model }: { model: OperationDetailPageVm }): React.ReactElement {
  return (
    <section className="card sectionBlock">
      <div className="sectionTitle">为什么做这次作业</div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(300px, 1fr))", gap: 12 }}>
        <article className="card" style={{ border: "1px solid #eaecf0", boxShadow: "none", padding: 12 }}>
          <div className="muted" style={{ marginBottom: 6 }}>建议</div>
          <div className="kv"><span className="k">建议标题</span><span className="v">{model.recommendation.title}</span></div>
          <div className="kv"><span className="k">建议摘要</span><span className="v">{model.recommendation.summary}</span></div>
          <div className="kv"><span className="k">原因说明</span><span className="v">{model.recommendation.reasonCodes.length ? model.recommendation.reasonCodes.join(" / ") : "系统根据作物与环境状态触发该作业"}</span></div>
          <div className="kv"><span className="k">建议时间</span><span className="v">{model.recommendation.createdAtLabel}</span></div>
        </article>
        <article className="card" style={{ border: "1px solid #eaecf0", boxShadow: "none", padding: 12 }}>
          <div className="muted" style={{ marginBottom: 6 }}>审批</div>
          <div className="kv"><span className="k">审批状态</span><span className="v">{model.approval.decisionLabel}</span></div>
          <div className="kv"><span className="k">审批人</span><span className="v">{model.approval.actorLabel}</span></div>
          <div className="kv"><span className="k">审批时间</span><span className="v">{model.approval.decidedAtLabel}</span></div>
          <div className="kv"><span className="k">审批请求号</span><span className="v mono">{model.approval.requestId}</span></div>
        </article>
      </div>
    </section>
  );
}
