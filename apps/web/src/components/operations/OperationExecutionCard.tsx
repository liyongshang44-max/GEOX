import React from "react";
import type { OperationDetailPageVm } from "../../viewmodels/operationDetailViewModel";

export default function OperationExecutionCard({ model }: { model: OperationDetailPageVm }): React.ReactElement {
  return (
    <section className="card sectionBlock">
      <div className="sectionTitle">执行计划</div>
      <div className="kv"><span className="k">执行动作</span><span className="v">{model.execution.actionType}</span></div>
      <div className="kv"><span className="k">执行对象</span><span className="v">{model.execution.deviceId} / {model.execution.executorLabel}</span></div>
      <div className="kv"><span className="k">执行时段</span><span className="v">{model.execution.executionWindowLabel}</span></div>
      <div className="kv"><span className="k">开始下发时间</span><span className="v">{model.execution.dispatchedAtLabel}</span></div>
      <div className="kv"><span className="k">设备确认状态</span><span className="v">{model.execution.ackStatusLabel}（{model.execution.ackedAtLabel}）</span></div>
      <div className="kv"><span className="k">执行结果</span><span className="v">{model.execution.finalStatusLabel}</span></div>

      <details style={{ marginTop: 10 }}>
        <summary className="muted" style={{ cursor: "pointer" }}>技术标识（次级）</summary>
        <div className="kv"><span className="k">作业编号</span><span className="v mono">{model.operationPlanId}</span></div>
        <div className="kv"><span className="k">计划标识</span><span className="v mono">{model.execution.planId}</span></div>
        <div className="kv"><span className="k">任务标识</span><span className="v mono">{model.execution.taskId}</span></div>
      </details>
    </section>
  );
}
