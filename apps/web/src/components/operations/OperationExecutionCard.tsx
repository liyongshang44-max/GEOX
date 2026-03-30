
import React from "react";
import type { OperationDetailPageVm } from "../../viewmodels/operationDetailViewModel";

export default function OperationExecutionCard({ model }: { model: OperationDetailPageVm }): React.ReactElement {
  return (
    <section className="card sectionBlock geoxSectionCard operationBusinessCard">
      <div className="sectionTitle">执行结果（谁干的）</div>
      <div className="muted detailSectionLead">给业务方直接说明：由谁执行、何时执行、执行到什么状态。</div>
      <div className="operationsSummaryGrid detailSummaryGridV4">
        <div className="operationsSummaryMetric"><span className="operationsSummaryLabel">执行方式</span><strong>{model.execution.executorTypeLabel}</strong></div>
        <div className="operationsSummaryMetric"><span className="operationsSummaryLabel">执行主体</span><strong>{model.execution.executorLabel}</strong></div>
        <div className="operationsSummaryMetric"><span className="operationsSummaryLabel">执行时间</span><strong>{model.execution.executionWindowLabel}</strong></div>
        <div className="operationsSummaryMetric"><span className="operationsSummaryLabel">执行状态</span><strong>{model.execution.ackStatusLabel}</strong></div>
      </div>
    </section>
  );
}
