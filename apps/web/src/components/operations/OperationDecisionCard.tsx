
import React from "react";
import { useLocale } from "../../lib/locale";
import type { OperationDetailPageVm } from "../../viewmodels/operationDetailViewModel";

export default function OperationDecisionCard({ model }: { model: OperationDetailPageVm }): React.ReactElement {
  const { text } = useLocale();
  return (
    <section className="card sectionBlock geoxSectionCard operationDecisionCardV2">
      <div className="sectionTitle">{text("为什么执行这次作业", "Why this operation exists")}</div>
      <div className="muted detailSectionLead">
        {text("先看触发原因与审批结论，再看执行与证据。", "Start with the trigger and approval, then move to execution and evidence.")}
      </div>
      <div className="detailMeaningGrid">
        <div className="detailMeaningItem">
          <span className="detailMeaningLabel">{text("系统建议", "System recommendation")}</span>
          <strong>{model.recommendation.title}</strong>
          <p>{model.recommendation.summary}</p>
        </div>
        <div className="detailMeaningItem">
          <span className="detailMeaningLabel">{text("触发原因", "Why it was triggered")}</span>
          <strong>{model.recommendation.reasonCodes.join(" / ") || text("暂无", "None")}</strong>
          <p>{text("这些信号共同触发了作业建议。", "These signals together triggered the recommendation.")}</p>
        </div>
        <div className="detailMeaningItem">
          <span className="detailMeaningLabel">{text("审批结论", "Approval decision")}</span>
          <strong>{model.approval.decisionLabel}</strong>
          <p>{text("由", "By")} {model.approval.actorLabel} · {model.approval.decidedAtLabel}</p>
        </div>
      </div>
    </section>
  );
}
