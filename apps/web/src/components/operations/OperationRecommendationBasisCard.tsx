import React from "react";
import type { OperationDetailPageVm } from "../../viewmodels/operationDetailViewModel";

export default function OperationRecommendationBasisCard({ basis }: { basis: OperationDetailPageVm["recommendationBasis"] }): React.ReactElement {
  return (
    <section className="card" style={{ marginTop: 12 }}>
      <div className="sectionTitle">建议依据</div>
      <div className="operationsSummaryGrid" style={{ marginTop: 10 }}>
        <div className="operationsSummaryMetric"><span className="operationsSummaryLabel">rule_id</span><strong>{basis.ruleId}</strong></div>
        <div className="operationsSummaryMetric"><span className="operationsSummaryLabel">crop_code</span><strong>{basis.cropCode}</strong></div>
        <div className="operationsSummaryMetric"><span className="operationsSummaryLabel">crop_stage</span><strong>{basis.cropStage}</strong></div>
        <div className="operationsSummaryMetric"><span className="operationsSummaryLabel">reason_codes</span><strong>{basis.reasonCodesLabel}</strong></div>
        <div className="operationsSummaryMetric"><span className="operationsSummaryLabel">expected_effect</span><strong>{basis.expectedEffectLabel}</strong></div>
      </div>
    </section>
  );
}
