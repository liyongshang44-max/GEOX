import React from "react";
import type { OperationDetailPageVm } from "../../viewmodels/operationDetailViewModel";

export default function OperationEffectEvaluationCard({
  effect,
}: {
  effect: OperationDetailPageVm["effectAssessment"];
}): React.ReactElement {
  return (
    <section className="card" style={{ marginTop: 12 }}>
      <div className="sectionTitle">效果评估</div>
      <div className="decisionList" style={{ marginTop: 10 }}>
        <div className="decisionItemStatic"><div className="decisionItemMeta">{effect.beforeMetricsLabel}</div></div>
        <div className="decisionItemStatic"><div className="decisionItemMeta">{effect.afterMetricsLabel}</div></div>
        <div className="decisionItemStatic"><div className="decisionItemMeta">{effect.actualEffectLabel}</div></div>
        <div className="decisionItemStatic"><div className="decisionItemMeta">{effect.effectVerdictLabel}</div></div>
      </div>
    </section>
  );
}
