import React from "react";
import type { OperatorCalibrationSummary } from "../../../api/operatorTwin";

export default function CalibrationSummaryPanel({ summary }: { summary: OperatorCalibrationSummary }): React.ReactElement {
  return (
    <article className="operatorPanel operatorBoundaryNotice" data-card="CalibrationSummary">
      <p className="operatorEyebrow">calibration_summary</p>
      <h3>Calibration Summary</h3>
      <ul className="operatorList">
        <li>status: <span className="operatorPill">{summary.status}</span></li>
        <li>reason: {summary.reason}</li>
        <li>available_for_review: {summary.available_for_review ? "true" : "false"}</li>
        <li>write_ready: {summary.write_ready ? "true" : "false"}</li>
      </ul>
    </article>
  );
}
