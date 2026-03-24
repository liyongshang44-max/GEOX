import React from "react";

export function ProgramEvidencePanel({ programId }: { programId: string }): React.ReactElement {
  return (
    <section className="card" style={{ padding: 16, display: "grid", gap: 8 }}>
      <h2 style={{ margin: 0 }}>证据与导出</h2>
      <button type="button">导出本周期证据包</button>
      <p className="muted" style={{ margin: 0 }}>可用于审计 / 客户交付 / 溯源证明（Program: {programId || "-"}）</p>
    </section>
  );
}
