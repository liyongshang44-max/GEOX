import React from "react";

export default function FieldAlertList({
  labels,
  items,
  onSelect,
}: {
  labels: any;
  items: Array<{ id: string; type: string; status: string; target: string; time: string; suggestion?: string | null; severity?: string | null }>;
  onSelect?: (item: any) => void;
}): React.ReactElement {
  if (!items.length) return <div className="emptyState">{labels.noData}</div>;
  return (
    <div className="list modernList">
      {items.map((item) => (
        <button key={item.id} className="infoCard" style={{ textAlign: "left", display: "grid", gap: 8 }} onClick={() => onSelect?.(item)}>
          <div className="jobTitleRow"><div className="title">{item.type}</div><div className="pill tone-warn">{item.status}</div></div>
          {item.severity ? <div className="metaText">{labels.severity}: {item.severity}</div> : null}
          <div className="metaText">{labels.targetObject}: {item.target}</div>
          <div className="metaText">{labels.time}: {item.time}</div>
          {item.suggestion ? <div className="metaText">{labels.suggestedAction}: {item.suggestion}</div> : null}
        </button>
      ))}
    </div>
  );
}
