import React from "react";
import type { OperationDetailPageVm } from "../../viewmodels/operationDetailViewModel";

export default function OperationExecutionCard({ model }: { model: OperationDetailPageVm }): React.ReactElement {
  return (
    <section className="card sectionBlock">
      <div className="sectionTitle">C. 怎么执行（执行计划）</div>
      <div className="kv"><span className="k">动作</span><span className="v">{model.execution.actionType}</span></div>
      <div className="kv"><span className="k">设备</span><span className="v">{model.execution.deviceId}</span></div>
      <div className="kv"><span className="k">下发时间</span><span className="v">{model.execution.dispatchedAtLabel}</span></div>
      <div className="kv"><span className="k">执行状态</span><span className="v">{model.execution.progressLabel}</span></div>
      <div className="kv"><span className="k">最终结果</span><span className="v">{model.execution.finalStatusLabel}</span></div>
    </section>
  );
}
