
import React from "react";
import type { OperationDetailPageVm } from "../../viewmodels/operationDetailViewModel";

type ExecutionCardProps = {
  task: OperationDetailPageVm["execution"];
  receipt: OperationDetailPageVm["receiptEvidence"];
  acceptance: OperationDetailPageVm["acceptance"];
};

function Alert({ type, children }: { type: "error"; children: React.ReactNode }): React.ReactElement {
  const style = type === "error"
    ? { background: "#fff1f1", border: "1px solid #ef4444", color: "#991b1b", borderRadius: 8, padding: "10px 12px", marginTop: 10 }
    : {};
  return <div style={style}>{children}</div>;
}

export default function OperationExecutionCard({ task, receipt, acceptance }: ExecutionCardProps): React.ReactElement {
  const status = String(task.finalStatus ?? "").toUpperCase();
  return (
    <section className="card sectionBlock geoxSectionCard operationBusinessCard">
      <div className="sectionTitle">执行结果（谁干的）</div>
      <div className="muted detailSectionLead">给业务方直接说明：由谁执行、何时执行、执行到什么状态。</div>
      {status === "INVALID_EXECUTION" ? (
        <Alert type="error">
          ⚠️ 执行无效：未提供证据，无法进入验收
        </Alert>
      ) : null}
      <div className="operationsSummaryGrid detailSummaryGridV4">
        <div className="operationsSummaryMetric"><span className="operationsSummaryLabel">执行方式</span><strong>{task.executorTypeLabel}</strong></div>
        <div className="operationsSummaryMetric"><span className="operationsSummaryLabel">执行主体</span><strong>{task.executorLabel}</strong></div>
        <div className="operationsSummaryMetric"><span className="operationsSummaryLabel">执行时间</span><strong>{task.executionWindowLabel}</strong></div>
        <div className="operationsSummaryMetric"><span className="operationsSummaryLabel">回执/验收</span><strong>{receipt ? "已回执" : "待回执"} · {acceptance.statusLabel}</strong></div>
      </div>
    </section>
  );
}
