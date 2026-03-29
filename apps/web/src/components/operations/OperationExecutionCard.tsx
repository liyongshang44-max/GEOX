import React from "react";
import { useLocale } from "../../lib/locale";
import type { OperationDetailPageVm } from "../../viewmodels/operationDetailViewModel";

export default function OperationExecutionCard({ model }: { model: OperationDetailPageVm }): React.ReactElement {
  const { text } = useLocale();
  return (
    <section className="card sectionBlock geoxSectionCard">
      <div className="sectionTitle">{text("执行计划", "Execution Plan")}</div>
      <div className="kv"><span className="k">{text("动作", "Action")}</span><span className="v">{model.execution.actionType}</span></div>
      <div className="kv"><span className="k">{text("设备", "Device")}</span><span className="v">{model.execution.deviceId}</span></div>
      <div className="kv"><span className="k">{text("执行窗口", "Execution Window")}</span><span className="v">{model.execution.executionWindowLabel}</span></div>
      <div className="kv"><span className="k">{text("下发时间", "Dispatched At")}</span><span className="v">{model.execution.dispatchedAtLabel}</span></div>
      <div className="kv"><span className="k">{text("确认状态", "Ack Status")}</span><span className="v">{model.execution.ackStatusLabel}</span></div>
      <div className="kv"><span className="k">{text("执行状态", "Progress")}</span><span className="v">{model.execution.progressLabel}</span></div>
      <div className="kv"><span className="k">{text("最终结果", "Final Result")}</span><span className="v">{model.execution.finalStatusLabel}</span></div>
    </section>
  );
}
