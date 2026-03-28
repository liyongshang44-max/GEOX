import React from "react";
import type { OperationDetailPageVm } from "../../viewmodels/operationDetailViewModel";

export default function OperationExecutionCard({ model }: { model: OperationDetailPageVm }): React.ReactElement {
  return (
    <section className="card sectionBlock">
      <div className="sectionTitle">怎么执行的</div>
      <div className="kv"><span className="k">执行计划</span><span className="v mono">{model.execution.planId}</span></div>
      <div className="kv"><span className="k">任务下发</span><span className="v mono">{model.execution.taskId}</span></div>
      <div className="kv"><span className="k">执行动作</span><span className="v">{model.execution.actionType}</span></div>
      <div className="kv"><span className="k">设备/执行器</span><span className="v">{model.execution.deviceId} / {model.execution.executorLabel}</span></div>
      <div className="kv"><span className="k">执行时段</span><span className="v">{model.execution.executionWindowLabel}</span></div>
      <div className="kv"><span className="k">下发时间</span><span className="v">{model.execution.dispatchedAtLabel}</span></div>
      <div className="kv"><span className="k">ACK 状态</span><span className="v">{model.execution.ackStatusLabel}（{model.execution.ackedAtLabel}）</span></div>
      <div className="kv"><span className="k">最终状态</span><span className="v">{model.execution.finalStatusLabel}</span></div>
    </section>
  );
}
