import React from "react";
import type { ProgramDetailTimelineItem } from "../../viewmodels/programDetailViewModel";

export function ProgramTimeline({ timeline }: { timeline: ProgramDetailTimelineItem[] }): React.ReactElement {
  return (
    <section className="card" style={{ padding: 16, display: "grid", gap: 8 }}>
      <h2 style={{ margin: 0 }}>执行与验收</h2>
      {timeline.length === 0 ? (
        <p style={{ margin: 0 }}>暂无执行记录</p>
      ) : (
        timeline.map((t, idx) => (
          <article key={`${t.kind}-${idx}`} className="card" style={{ padding: 12, display: "grid", gap: 4 }}>
            <div><strong>{t.kind}</strong> / {t.status}</div>
            <div className="muted">{t.occurredAt}</div>
            <div>{t.summary}</div>
          </article>
        ))
      )}
    </section>
  );
}
