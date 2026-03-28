import React from "react";
import type { OperationStoryTimelineItemVm } from "../../viewmodels/operationDetailViewModel";

export default function OperationStoryTimeline({ items }: { items: OperationStoryTimelineItemVm[] }): React.ReactElement {
  return (
    <section className="card sectionBlock">
      <div className="sectionTitle">作业故事时间线</div>
      <div style={{ display: "grid", gap: 8 }}>
        {items.map((item) => (
          <div key={item.id} className="kv">
            <span className="k">[{item.occurredAtLabel}] {item.label}</span>
            <span className="v">{item.summary}{item.actorLabel !== "-" ? ` · ${item.actorLabel}` : ""}</span>
          </div>
        ))}
        {!items.length ? <div className="muted">暂无时间线事件</div> : null}
      </div>
    </section>
  );
}
