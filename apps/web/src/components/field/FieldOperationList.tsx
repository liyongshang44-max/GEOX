import React from "react";
import { formatSourceMeta } from "../../lib/dataOrigin";
import type { DataOriginValue } from "../../lib/dataOrigin";

export default function FieldOperationList({
  labels,
  items,
  onSelect,
}: {
  labels: any;
  items: Array<{
    id: string;
    type: string;
    time: string;
    source: string;
    source_kind?: DataOriginValue;
    source_type?: DataOriginValue;
    data_origin?: DataOriginValue;
    status: string;
    device: string;
    window: string;
    raw?: any;
  }>;
  onSelect?: (item: any) => void;
}): React.ReactElement {
  if (!items.length) return <div className="emptyState">{labels.noData}</div>;
  return (
    <div className="list modernList">
      {items.map((item) => (
        <button key={item.id} className="infoCard" style={{ textAlign: "left", display: "grid", gap: 8 }} onClick={() => onSelect?.(item)}>
          <div className="jobTitleRow">
            <div className="title">{item.type}</div>
            <div className="pill tone-default">{item.status}</div>
          </div>
          <div className="metaText">{labels.executionTime}: {item.time}</div>
          <div className="metaText">
            {labels.source}: {formatSourceMeta({
              source_kind: item.source_kind,
              source_type: item.source_type,
              data_origin: item.data_origin,
            })}
          </div>
          <div className="metaText">{labels.device}: {item.device}</div>
          <div className="metaText">{labels.durationWindow}: {item.window}</div>
        </button>
      ))}
    </div>
  );
}
