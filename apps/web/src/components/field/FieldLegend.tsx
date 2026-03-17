import React from "react";

export default function FieldLegend({ labels }: { labels: any }): React.ReactElement {
  const rows = [
    { color: "#0284c7", label: labels.fieldBoundary },
    { color: "#16a34a", label: labels.devicePosition },
    { color: "#2563eb", label: labels.operationTrack },
    { color: "#dc2626", label: labels.alertLocation },
  ];
  return (
    <div className="card" style={{ padding: 10 }}>
      <div className="muted" style={{ marginBottom: 6 }}>{labels.mapLegendTitle}</div>
      <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
        {rows.map((row) => (
          <span key={row.label} className="muted" style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
            <span style={{ width: 10, height: 10, borderRadius: 999, background: row.color, display: "inline-block" }} />
            {row.label}
          </span>
        ))}
      </div>
    </div>
  );
}
