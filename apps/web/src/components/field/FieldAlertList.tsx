import React from "react";

export default function FieldAlertList({
  labels,
  items,
}: {
  labels: any;
  items: Array<{ id: string; type: string; status: string; target: string; time: string; suggestion: string; severity?: string | null }>;
}): React.ReactElement {
  if (!items.length) return <div className="emptyState">{labels.noData}</div>;
  return (
    <div className="list modernList">
      {items.map((item) => (
        <div key={item.id} className="infoCard">
          <div className="jobTitleRow"><div className="title">{item.type}</div><div className="pill tone-warn">{item.status}</div></div>
          <div className="meta wrapMeta">
            {item.severity ? <span>{labels.severity}: {item.severity}</span> : null}
            <span>{labels.targetObject}: {item.target}</span>
            <span>{labels.time}: {item.time}</span>
            <span>{labels.suggestedAction}: {item.suggestion}</span>
          </div>
        </div>
      ))}
    </div>
  );
}
