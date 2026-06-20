import React from "react";
import type { OperatorQualitySummary } from "../../../api/operatorTwin";

export default function QualitySummaryPanel({ summary }: { summary: OperatorQualitySummary }): React.ReactElement {
  return (
    <article className="operatorPanel" data-card="QualitySummaryPanel">
      <p className="operatorEyebrow">quality_summary</p>
      <h3>Quality Summary</h3>
      <p><span className="operatorPill">{summary.status}</span></p>
      <ul className="operatorList">
        <li>blocking_reason：{summary.blocking_reason ?? "none"}</li>
        <li>simulation_data_present：{summary.simulation_data_present ? "true" : "false"}</li>
        <li>official_data_qualified：{summary.official_data_qualified ? "true" : "false"}</li>
      </ul>
    </article>
  );
}
