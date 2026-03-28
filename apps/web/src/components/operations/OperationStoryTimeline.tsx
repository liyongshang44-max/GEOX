import React from "react";
import type { OperationStoryTimelineItemVm } from "../../viewmodels/operationDetailViewModel";

export default function OperationStoryTimeline({ items }: { items: OperationStoryTimelineItemVm[] }): React.ReactElement {
  return (
    <section className="card sectionBlock">
      <div className="sectionTitle">全链路时间线</div>
      <div style={{ display: "grid", gap: 8 }}>
        {items.map((item, idx) => (
          <div key={item.id} className="kv">
            <span className="k">{idx + 1}. [{item.occurredAtLabel}] {item.label}</span>
            <span className="v">{item.summary}{item.actorLabel !== "-" ? ` · ${item.actorLabel}` : ""}</span>
          </div>
        ))}
        {!items.length ? <div className="muted">暂无时间线事件</div> : null}
      </div>
    </section>
  );
}
