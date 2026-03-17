import React from "react";

export default function FieldOperationList({
  labels,
  items,
}: {
  labels: any;
  items: Array<{ id: string; type: string; time: string; source: string; status: string; device: string; window: string; raw?: any }>;
}): React.ReactElement {
  if (!items.length) return <div className="emptyState">{labels.noData}</div>;
  return (
    <div className="list modernList">
      {items.map((item) => (
        <div className="infoCard" key={item.id}>
          <div className="jobTitleRow"><div className="title">{item.type}</div><div className="pill tone-default">{item.status}</div></div>
          <div className="meta wrapMeta">
            <span>{labels.executionTime}: {item.time}</span>
            <span>{labels.source}: {item.source}</span>
            <span>{labels.device}: {item.device}</span>
            <span>{labels.durationWindow}: {item.window}</span>
          </div>
        </div>
      ))}
    </div>
  );
}
