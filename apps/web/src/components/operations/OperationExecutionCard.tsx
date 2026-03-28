import React from "react";
import type { OperationDetailPageVm } from "../../viewmodels/operationDetailViewModel";

export default function OperationExecutionCard({ model }: { model: OperationDetailPageVm }): React.ReactElement {
  return (
    <section className="card sectionBlock">
      <div className="sectionTitle">执行计划与下发</div>
      <div className="kv"><span className="k">动作类型</span><span className="v">{model.execution.actionType}</span></div>
      <div className="kv"><span className="k">任务 ID</span><span className="v mono">{model.execution.taskId}</span></div>
      <div className="kv"><span className="k">设备 ID</span><span className="v mono">{model.execution.deviceId}</span></div>
      <div className="kv"><span className="k">执行器</span><span className="v">{model.execution.executorLabel}</span></div>
      <div className="kv"><span className="k">下发时间</span><span className="v">{model.execution.dispatchedAtLabel}</span></div>
      <div className="kv"><span className="k">Ack 时间</span><span className="v">{model.execution.ackedAtLabel}</span></div>
    </section>
  );
}
