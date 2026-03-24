import React from "react";
import type { BadgeStatus, ProgramDetailViewModel } from "../../viewmodels/programDetailViewModel";

function StatusBadge({ status }: { status: BadgeStatus }): React.ReactElement {
  const config: Record<BadgeStatus, { text: string; bg: string; color: string }> = {
    success: { text: "状态良好", bg: "#ecfdf3", color: "#027a48" },
    warning: { text: "需关注", bg: "#fffaeb", color: "#b54708" },
    failed: { text: "风险较高", bg: "#fef3f2", color: "#b42318" },
    pending: { text: "监测中", bg: "#f2f4f7", color: "#344054" },
  };

  const item = config[status] ?? config.pending;
  return (
    <span className="pill" style={{ background: item.bg, color: item.color }}>
      {item.text}
    </span>
  );
}

export function ProgramHero({ vm }: { vm: ProgramDetailViewModel }): React.ReactElement {
  return (
    <section className="card" style={{ padding: 16, display: "grid", gap: 12 }}>
      <div>
        <h1 style={{ margin: 0 }}>{vm.header.title}</h1>
        <p className="muted" style={{ margin: "8px 0 0" }}>{vm.header.subtitle}</p>
      </div>

      <StatusBadge status={vm.header.status} />

      <div style={{ display: "grid", gridTemplateColumns: "repeat(2, minmax(0, 1fr))", gap: 12 }}>
        <div>
          <strong>目标</strong>
          {vm.goals.map((g) => (
            <div key={g.label}>{g.label}：{g.value}</div>
          ))}
        </div>
        <div>
          <strong>约束</strong>
          {vm.constraints.map((c) => (
            <div key={c.label}>{c.label}：{c.value}</div>
          ))}
        </div>
      </div>
    </section>
  );
}
