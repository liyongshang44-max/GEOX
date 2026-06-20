import React from "react";
import type { OperatorTwinGap } from "../../../api/operatorTwin";

export default function ReplayGapList({ gaps }: { gaps: OperatorTwinGap[] }): React.ReactElement {
  return (
    <article className="operatorPanel" data-card="ReplayGaps">
      <p className="operatorEyebrow">replay_gaps</p>
      <h3>Replay Gaps</h3>
      <ul className="operatorList">
        {gaps.map((gap) => <li key={gap.gap_code}><span className="operatorPill">{gap.severity}</span> {gap.gap_code}: {gap.label}</li>)}
      </ul>
    </article>
  );
}
