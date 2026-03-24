import React from "react";
import type { BadgeStatus, ProgramDetailAction } from "../../viewmodels/programDetailViewModel";

function mapMode(mode: string): BadgeStatus {
  switch (mode) {
    case "AUTO":
      return "success";
    case "APPROVAL_REQUIRED":
      return "warning";
    case "BLOCKED":
      return "failed";
    default:
      return "pending";
  }
}

function statusText(mode: string): string {
  switch (mode) {
    case "APPROVAL_REQUIRED":
      return "需人工确认";
    case "BLOCKED":
      return "当前不可执行";
    case "AUTO":
      return "可自动执行";
    default:
      return "待确认";
  }
}

function StatusBadge({ status }: { status: BadgeStatus }): React.ReactElement {
  const styleMap: Record<BadgeStatus, { bg: string; color: string }> = {
    success: { bg: "#ecfdf3", color: "#027a48" },
    warning: { bg: "#fffaeb", color: "#b54708" },
    failed: { bg: "#fef3f2", color: "#b42318" },
    pending: { bg: "#f2f4f7", color: "#344054" },
  };
  const style = styleMap[status] ?? styleMap.pending;
  return <span className="pill" style={{ background: style.bg, color: style.color }}>{status}</span>;
}

export function ProgramActionsPanel({ actions }: { actions: ProgramDetailAction[] }): React.ReactElement {
  if (!actions || actions.length === 0) {
    return (
      <section className="card" style={{ padding: 16, display: "grid", gap: 8 }}>
        <h2 style={{ margin: 0 }}>下一步动作</h2>
        <p style={{ margin: 0 }}>当前无需新增操作，系统正在持续监测状态。</p>
      </section>
    );
  }

  return (
    <section className="card" style={{ padding: 16, display: "grid", gap: 12 }}>
      <h2 style={{ margin: 0 }}>下一步动作</h2>
      {actions.map((a, idx) => (
        <div key={`${a.type}-${idx}`} className="card" style={{ padding: 12, display: "grid", gap: 8 }}>
          <div style={{ display: "flex", justifyContent: "space-between", gap: 8, alignItems: "center" }}>
            <strong>{a.type}</strong>
            <StatusBadge status={mapMode(a.mode)} />
          </div>

          <div style={{ display: "grid", gap: 4 }}>
            <div>原因：{a.reason}</div>
            <div>预期效果：{a.expectedEffect}</div>
            <div className="muted">模式：{statusText(a.mode)}</div>
          </div>

          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            {a.mode === "AUTO" && <button type="button">立即执行</button>}
            {a.mode === "APPROVAL_REQUIRED" && <button type="button">提交审批</button>}
            {a.mode === "BLOCKED" && <button type="button" disabled>当前不可执行</button>}
            {a.mode !== "AUTO" && a.mode !== "APPROVAL_REQUIRED" && a.mode !== "BLOCKED" && (
              <button type="button">查看原因</button>
            )}
          </div>
        </div>
      ))}
    </section>
  );
}
