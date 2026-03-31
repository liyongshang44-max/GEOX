
import React from "react";
import { useLocale } from "../../lib/locale";
import type { OperationDetailPageVm } from "../../viewmodels/operationDetailViewModel";

type DecisionCardProps = {
  recommendation: OperationDetailPageVm["recommendation"];
  approval: OperationDetailPageVm["approval"];
  businessEffect: OperationDetailPageVm["businessEffect"];
};

export default function OperationDecisionCard({ recommendation, approval, businessEffect }: DecisionCardProps): React.ReactElement {
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
          <strong>{recommendation.title}</strong>
          <p>{recommendation.summary}</p>
        </div>
        <div className="detailMeaningItem">
          <span className="detailMeaningLabel">{text("触发原因", "Why it was triggered")}</span>
          <strong>{recommendation.reasonCodesLabel}</strong>
          <p>{recommendation.triggerSummary}</p>
        </div>
        <div className="detailMeaningItem">
          <span className="detailMeaningLabel">{text("审批结论", "Approval decision")}</span>
          <strong>{approval.decisionLabel}</strong>
          <p>{approval.decisionSummary}</p>
        </div>
      </div>
      <div className="detailSectionLead" style={{ marginTop: 12 }}>
        <strong>执行该作业：</strong>
        <div>→ 预计效果：{businessEffect.expectedImpact}</div>
        <div>→ 不执行风险：{businessEffect.riskIfNotExecute}</div>
      </div>
    </section>
  );
}
