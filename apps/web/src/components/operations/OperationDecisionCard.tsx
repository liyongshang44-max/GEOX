import React from "react";
import type { OperationDetailPageVm } from "../../viewmodels/operationDetailViewModel";

export default function OperationDecisionCard({ model }: { model: OperationDetailPageVm }): React.ReactElement {
  return (
    <section className="card sectionBlock">
      <div className="sectionTitle">B. 为什么做（决策 + 审批）</div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))", gap: 12 }}>
        <section style={{ border: "1px solid var(--line)", borderRadius: 10, padding: 12 }}>
          <div style={{ fontWeight: 700, marginBottom: 10 }}>系统建议</div>
          <div className="kv"><span className="k">建议标题</span><span className="v">{model.recommendation.title}</span></div>
          <div className="kv"><span className="k">摘要</span><span className="v">{model.recommendation.summary}</span></div>
        </section>
        <section style={{ border: "1px solid var(--line)", borderRadius: 10, padding: 12 }}>
          <div style={{ fontWeight: 700, marginBottom: 10 }}>审批</div>
          <div className="kv"><span className="k">状态</span><span className="v">{model.approval.decisionLabel}</span></div>
          <div className="kv"><span className="k">审批人</span><span className="v">{model.approval.actorLabel}</span></div>
          <div className="kv"><span className="k">时间</span><span className="v">{model.approval.decidedAtLabel}</span></div>
        </section>
      </div>
    </section>
  );
}
