import React from "react";

export default function FieldSummaryCards({ items }: { items: Array<{ label: string; value: string }> }): React.ReactElement {
  return (
    <section style={{ display: "grid", gridTemplateColumns: "repeat(6, minmax(0, 1fr))", gap: 10 }}>
      {items.map((item) => (
        <div key={item.label} className="card" style={{ padding: 12 }}>
          <div className="muted">{item.label}</div>
          <div style={{ fontWeight: 700, marginTop: 4 }}>{item.value}</div>
        </div>
      ))}
    </section>
  );
}
