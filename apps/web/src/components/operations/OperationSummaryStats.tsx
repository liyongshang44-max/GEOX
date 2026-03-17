import React from "react";
import type { OperationLabels, WorkStatus } from "../../lib/operationViewModel";

export default function OperationSummaryStats({
  labels,
  stats,
}: {
  labels: OperationLabels;
  stats: Record<WorkStatus, number>;
}): React.ReactElement {
  const cards = [
    { key: "pending_approval" as const, label: labels.pendingApproval },
    { key: "ready_to_dispatch" as const, label: labels.readyToDispatch },
    { key: "executing" as const, label: labels.inExecution },
    { key: "completed" as const, label: labels.completed },
    { key: "failed" as const, label: labels.needsAttention },
  ];
  return (
    <section style={{ display: "grid", gridTemplateColumns: "repeat(5, minmax(0, 1fr))", gap: 10 }}>
      {cards.map((card) => (
        <div key={card.key} className="card" style={{ padding: 12 }}>
          <div className="muted">{card.label}</div>
          <div style={{ fontSize: 20, fontWeight: 700 }}>{stats[card.key]}</div>
        </div>
      ))}
    </section>
  );
}
