import React from "react";
import type { ProgramDetailMetric } from "../../viewmodels/programDetailViewModel";

export function ProgramMetricsPanel({ metrics }: { metrics: ProgramDetailMetric[] }): React.ReactElement {
  return (
    <section className="card" style={{ padding: 16, display: "grid", gap: 8 }}>
      <h2 style={{ margin: 0 }}>经营指标</h2>
      {metrics.map((m) => (
        <div key={m.label} style={{ display: "flex", justifyContent: "space-between", gap: 8 }}>
          <span>{m.label}</span>
          <strong>{m.value}</strong>
        </div>
      ))}
    </section>
  );
}
