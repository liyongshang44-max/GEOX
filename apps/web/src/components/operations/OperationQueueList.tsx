import React from "react";
import type { OperationLabels, OperationWorkItem, WorkTab } from "../../lib/operationViewModel";
import OperationApprovalList from "./OperationApprovalList";

export default function OperationQueueList({
  labels,
  tab,
  onTabChange,
  items,
  selectedKey,
  onSelect,
  onPrimary,
}: {
  labels: OperationLabels;
  tab: WorkTab;
  onTabChange: (tab: WorkTab) => void;
  items: OperationWorkItem[];
  selectedKey: string;
  onSelect: (item: OperationWorkItem) => void;
  onPrimary: (item: OperationWorkItem) => void;
}): React.ReactElement {
  const tabs: Array<{ key: WorkTab; label: string }> = [
    { key: "pending_approval", label: labels.pendingApproval },
    { key: "ready_to_dispatch", label: labels.readyToDispatch },
    { key: "executing", label: labels.inExecution },
    { key: "failed", label: labels.needsAttention },
  ];

  return (
    <section className="card" style={{ padding: 14 }}>
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 12 }}>
        {tabs.map((t) => (
          <button key={t.key} className={`btn ${tab === t.key ? "primary" : ""}`} onClick={() => onTabChange(t.key)}>{t.label}</button>
        ))}
      </div>
      <OperationApprovalList items={items} selectedKey={selectedKey} labels={labels} onSelect={onSelect} onPrimary={onPrimary} />
    </section>
  );
}
