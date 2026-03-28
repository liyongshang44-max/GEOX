import React from "react";
import type { OperationDetailPageVm } from "../../viewmodels/operationDetailViewModel";

export default function OperationExecutionCard({ model }: { model: OperationDetailPageVm }): React.ReactElement {
  return (
    <section className="card sectionBlock">
      <div className="sectionTitle">C. 怎么执行</div>
      <div className="kv"><span className="k">动作类型</span><span className="v">{model.execution.actionType}</span></div>
      <div className="kv"><span className="k">设备 / 执行器</span><span className="v">{model.execution.deviceId} / {model.execution.executorLabel}</span></div>
      <div className="kv"><span className="k">下发时间</span><span className="v">{model.execution.dispatchedAtLabel}</span></div>
      <div className="kv"><span className="k">执行状态</span><span className="v">{model.execution.progressLabel}</span></div>
      <div className="kv"><span className="k">最终结果</span><span className="v">{model.execution.finalStatusLabel}</span></div>
      <div className="kv"><span className="k">执行时段</span><span className="v">{model.execution.executionWindowLabel}</span></div>

      <details style={{ marginTop: 10 }}>
        <summary className="muted" style={{ cursor: "pointer" }}>技术标识（次级）</summary>
        <div className="kv"><span className="k">作业编号</span><span className="v mono">{model.operationPlanId}</span></div>
        <div className="kv"><span className="k">计划标识</span><span className="v mono">{model.execution.planId}</span></div>
        <div className="kv"><span className="k">任务标识</span><span className="v mono">{model.execution.taskId}</span></div>
      </details>
    </section>
  );
}
