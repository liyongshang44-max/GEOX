
import React from "react";
import { useLocale } from "../../lib/locale";
import type { OperationDetailPageVm } from "../../viewmodels/operationDetailViewModel";

export default function OperationExecutionCard({ model }: { model: OperationDetailPageVm }): React.ReactElement {
  const { text } = useLocale();
  return (
    <section className="card sectionBlock geoxSectionCard operationExecutionCardV2">
      <div className="sectionTitle">{text("执行结果（谁干的）", "Execution result (who executed)")}</div>
      <div className="muted detailSectionLead">
        {text("给业务方直接说明：由谁执行、何时执行、执行到什么状态。", "Business-facing summary: who executed, when, and current execution status.")}
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
