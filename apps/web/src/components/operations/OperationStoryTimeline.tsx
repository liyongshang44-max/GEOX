import React from "react";
import type { OperationStoryTimelineItemVm } from "../../viewmodels/operationDetailViewModel";

const TIMELINE_TITLE = "全链路时间线";

export default function OperationStoryTimeline({ items }: { items: OperationStoryTimelineItemVm[] }): React.ReactElement {
  return (
    <section className="card sectionBlock">
      <div className="sectionTitle">{TIMELINE_TITLE}</div>
      <div className="operationStoryTimeline">
        {items.map((item, idx) => (
          <div key={item.id} className={`operationStoryItem ${item.status === "PENDING" ? "isPending" : "isDone"}`}>
            <div className="operationStoryItemHeader">
              <span className="operationStoryStep">{idx + 1}</span>
              <div>
                <div className="operationStoryLabel">{item.label}</div>
                <div className="operationStoryMeta">
                  <span><b>时间：</b>{item.occurredAtLabel}</span>
                  <span><b>参与者：</b>{item.actorLabel}</span>
                </div>
              </div>
            </div>
            <div className="operationStorySummary">{item.storySummary}</div>
          </div>
        ))}
        {!items.length ? <div className="muted">暂无时间线事件</div> : null}
      </div>
    </section>
  );
}
