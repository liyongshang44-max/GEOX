import React from "react";
import type { OperationLabels, OperationWorkItem } from "../../lib/operationViewModel";
import OperationTaskCard from "./OperationTaskCard";

export default function OperationApprovalList({
  items,
  selectedKey,
  labels,
  onSelect,
  onPrimary,
}: {
  items: OperationWorkItem[];
  selectedKey: string;
  labels: OperationLabels;
  onSelect: (item: OperationWorkItem) => void;
  onPrimary: (item: OperationWorkItem) => void;
}): React.ReactElement {
  if (!items.length) return <div className="emptyState">{labels.noItems}</div>;
  return (
    <div style={{ display: "grid", gap: 10 }}>
      {items.map((item) => (
        <OperationTaskCard
          key={item.key}
          item={item}
          labels={labels}
          active={item.key === selectedKey}
          onSelect={() => onSelect(item)}
          onPrimary={() => onPrimary(item)}
        />
      ))}
    </div>
  );
}
