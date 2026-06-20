import React from "react";
import type { OperatorDataCoverageRow } from "../../../api/operatorTwin";

export default function DataCoverageMatrix({ rows }: { rows: OperatorDataCoverageRow[] }): React.ReactElement {
  return (
    <article className="operatorPanel" data-card="DataCoverageMatrix">
      <p className="operatorEyebrow">data_coverage_matrix_v1</p>
      <h3>Data Coverage Matrix</h3>
      <table className="operatorTable">
        <thead><tr><th>metric</th><th>available</th><th>row_count</th><th>latest_ts_ms</th><th>missing reason</th><th>evidence_refs</th></tr></thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.source_table}>
              <td>{row.metric}</td><td>{row.available ? "true" : "false"}</td><td>{row.row_count}</td><td>{row.latest_ts_ms ?? "null"}</td>
              <td>{row.quality_flags.concat(row.missing_windows).join(", ") || "none"}</td><td>{row.evidence_refs.join(", ") || "none"}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </article>
  );
}
