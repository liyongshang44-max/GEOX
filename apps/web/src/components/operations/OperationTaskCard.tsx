import React from "react";
import type { OperationLabels, OperationWorkItem } from "../../lib/operationViewModel";

export default function OperationTaskCard({
  item,
  labels,
  active,
  onSelect,
  onPrimary,
}: {
  item: OperationWorkItem;
  labels: OperationLabels;
  active: boolean;
  onSelect: () => void;
  onPrimary: () => void;
}): React.ReactElement {
  return (
    <div className="card" style={{ padding: 12, borderColor: active ? "#111" : undefined, display: "grid", gap: 8 }}>
      <button className="btn" style={{ border: "none", background: "transparent", justifyContent: "space-between", padding: 0 }} onClick={onSelect}>
        <div style={{ textAlign: "left", display: "grid", gap: 6 }}>
          <div style={{ fontWeight: 700 }}>{item.title}</div>
          <div className="muted">{labels.currentStatus}: {item.statusLabel}</div>
          <div className="muted">{labels.source}: {item.sourceLabel}</div>
          <div className="muted">{labels.targetField}: {item.field} · {labels.targetDevice}: {item.device}</div>
          <div className="muted">{labels.createdAt}: {item.createdAt}</div>
          <div className="muted">{labels.approvalId}: <span className="mono">{item.shortApprovalId}</span> · {labels.taskId}: <span className="mono">{item.shortTaskId}</span></div>
        </div>
      </button>
      <div><button className="btn primary" onClick={onPrimary}>{item.actionLabel}</button></div>
    </div>
  );
}
