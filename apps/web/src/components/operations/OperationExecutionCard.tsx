
import React from "react";
import { useLocale } from "../../lib/locale";
import type { OperationDetailPageVm } from "../../viewmodels/operationDetailViewModel";

export default function OperationExecutionCard({ model }: { model: OperationDetailPageVm }): React.ReactElement {
  const { text } = useLocale();
  return (
    <section className="card sectionBlock geoxSectionCard operationExecutionCardV2">
      <div className="sectionTitle">{text("系统如何执行", "How the system executed it")}</div>
      <div className="muted detailSectionLead">
        {text("把设备、执行窗口、确认状态与终态放在同一组，方便判断链路是否闭合。", "Device, execution window, acknowledgement, and final state are grouped together so you can judge whether the chain closed properly.")}
      </div>
      <div className="operationsSummaryGrid detailSummaryGridV4">
        <div className="operationsSummaryMetric"><span className="operationsSummaryLabel">{text("执行方式", "Execution mode")}</span><strong>{model.execution.executionModeLabel}</strong></div>
        <div className="operationsSummaryMetric"><span className="operationsSummaryLabel">{text("执行者类型", "Executor type")}</span><strong>{model.execution.executorTypeLabel}</strong></div>
        <div className="operationsSummaryMetric"><span className="operationsSummaryLabel">{text("动作", "Action")}</span><strong>{model.execution.actionType}</strong></div>
        <div className="operationsSummaryMetric"><span className="operationsSummaryLabel">{text("执行者", "Executor")}</span><strong>{model.execution.executorLabel}</strong></div>
        <div className="operationsSummaryMetric"><span className="operationsSummaryLabel">{text("设备", "Device")}</span><strong>{model.execution.deviceId}</strong></div>
        <div className="operationsSummaryMetric"><span className="operationsSummaryLabel">{text("执行窗口", "Window")}</span><strong>{model.execution.executionWindowLabel}</strong></div>
        <div className="operationsSummaryMetric"><span className="operationsSummaryLabel">{text("链路状态", "Pipeline state")}</span><strong>{model.execution.progressLabel}</strong></div>
      </div>
      <div className="traceChipRow" style={{ marginTop: 12 }}>
        <span className="traceChip">{model.execution.dispatchedChipLabel}</span>
        <span className="traceChip">{model.execution.ackChipLabel}</span>
        <span className="traceChip">{model.execution.finalChipLabel}</span>
      </div>
    </section>
  );
}
