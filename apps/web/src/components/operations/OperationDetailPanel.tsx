import React from "react";
import type { OperationLabels, OperationWorkItem } from "../../lib/operationViewModel";

export default function OperationDetailPanel({
  item,
  labels,
  isDev,
  onCopy,
}: {
  item: OperationWorkItem | null;
  labels: OperationLabels;
  isDev: boolean;
  onCopy: (text: string) => void;
}): React.ReactElement {
  if (!item) {
    return <section className="card" style={{ padding: 16 }}><div className="emptyState">{labels.noItems}</div></section>;
  }
  return (
    <section className="card" style={{ padding: 16, display: "grid", gap: 8 }}>
      <h3 style={{ margin: 0 }}>{labels.detailTitle}</h3>
      <div><b>{labels.currentStatus}：</b>{item.statusLabel}</div>
      <div><b>{labels.source}：</b>{item.sourceLabel}</div>
      <div><b>{labels.createdAt}：</b>{item.createdAt}</div>
      <div><b>{labels.targetField}：</b>{item.field}</div>
      <div><b>{labels.targetDevice}：</b>{item.device}</div>
      <div><b>{labels.approvalId}：</b><span className="mono">{item.shortApprovalId}</span> <button className="btn" onClick={() => onCopy(item.approvalId)}>{labels.details}</button></div>
      <div><b>{labels.operationPlanId}：</b><span className="mono">{item.shortOperationPlanId}</span></div>
      <div><b>{labels.taskId}：</b><span className="mono">{item.shortTaskId}</span></div>
      <div><b>{labels.receiptId}：</b><span className="mono">{item.shortReceiptId}</span></div>
      <div><b>{labels.executionParameters}：</b></div>
      <pre className="mono" style={{ margin: 0, whiteSpace: "pre-wrap", background: "#f8fafc", border: "1px solid #e5e7eb", borderRadius: 10, padding: 10 }}>{JSON.stringify(item.parameters ?? {}, null, 2)}</pre>
      <div className="muted" style={{ display: "flex", gap: 4, flexWrap: "wrap" }}>
        {labels.flow.map((label, idx) => <span key={label} style={{ color: item.chainDone[idx] ? "#1d1d1f" : "#9aa0a6" }}>{label}{idx < labels.flow.length - 1 ? " →" : ""}</span>)}
      </div>
      {isDev ? (
        <details>
          <summary className="muted">{labels.debugTitle}</summary>
          <div className="muted">{labels.rawStatus}: {item.rawStatus}</div>
          <div className="muted">{labels.fullIds}: {item.approvalId} / {item.operationPlanId} / {item.taskId} / {item.receiptId}</div>
          <pre className="mono" style={{ margin: 0, whiteSpace: "pre-wrap" }}>{JSON.stringify(item.raw, null, 2)}</pre>
        </details>
      ) : null}
    </section>
  );
}
