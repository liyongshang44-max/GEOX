
import React from "react";
import { useLocale } from "../../lib/locale";
import type { OperationDetailPageVm } from "../../viewmodels/operationDetailViewModel";

export default function OperationExecutionCard({ model }: { model: OperationDetailPageVm }): React.ReactElement {
  const { text } = useLocale();
  return (
    <section className="card sectionBlock geoxSectionCard operationExecutionCardV2">
      <div className="sectionTitle">{text("执行层", "Execution layer")}</div>
      <div className="muted detailSectionLead">
        {text("聚焦执行者、执行时间和回执状态，快速确认动作是否真正落地。", "Focus on executor, execution time, and receipt state to verify the action landed in field.")}
      </div>
      <div className="operationsSummaryGrid detailSummaryGridV4">
        <div className="operationsSummaryMetric"><span className="operationsSummaryLabel">{text("执行者（human/device）", "Executor (human/device)")}</span><strong>{model.execution.executorTypeLabel}</strong></div>
        <div className="operationsSummaryMetric"><span className="operationsSummaryLabel">{text("执行者标识", "Executor ID")}</span><strong>{model.execution.executorLabel}</strong></div>
        <div className="operationsSummaryMetric"><span className="operationsSummaryLabel">{text("执行时间", "Execution time")}</span><strong>{model.execution.executionWindowLabel}</strong></div>
        <div className="operationsSummaryMetric"><span className="operationsSummaryLabel">{text("receipt 状态", "Receipt status")}</span><strong>{model.execution.ackStatusLabel}</strong></div>
      </div>
    </section>
  );
}
