import React from "react";
import type { OperatorReplayTimelineItem } from "../../../api/operatorTwin";

export default function ReplayTimelinePanel({ items }: { items: OperatorReplayTimelineItem[] }): React.ReactElement {
  return (
    <article className="operatorPanel" data-card="ReplayTimeline">
      <p className="operatorEyebrow">replay_timeline_v1</p>
      <h3>Replay Timeline</h3>
      <table className="operatorTable">
        <thead><tr><th>stage</th><th>status</th><th>source</th><th>evidence_refs</th><th>notes</th></tr></thead>
        <tbody>
          {items.map((item) => (
            <tr key={item.stage + item.source_table}>
              <td>{item.stage}<br />{item.label}</td>
              <td><span className="operatorPill">{item.status}</span></td>
              <td>{item.source_table}</td>
              <td>{item.evidence_refs.join(", ") || "none"}</td>
              <td>{item.replay_notes.join(" · ") || "none"}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </article>
  );
}
