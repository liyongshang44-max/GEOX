import React from "react";
import type { EvidenceVm } from "../../lib/evidenceViewModel";

export type EvidenceViewMode = "customer" | "operator";

function badgeTone(type: EvidenceVm["refs"][number]["type"]): string {
  if (type === "FORMAL") return "正式证据";
  if (type === "TECHNICAL") return "技术信号";
  if (type === "SIMULATED") return "模拟/调试";
  return "证据缺失";
}

export function FormalEvidenceBadge(): React.ReactElement { return <span className="customerPill">正式证据</span>; }
export function TechnicalSignalBadge(): React.ReactElement { return <span className="customerPill">技术信号</span>; }
export function SimulatedOrDebugEvidenceBadge(): React.ReactElement { return <span className="customerPill">模拟/调试</span>; }
export function MissingEvidenceBadge(): React.ReactElement { return <span className="customerPill">证据缺失</span>; }

export function EvidenceTrustLegend({ vm }: { vm: EvidenceVm }): React.ReactElement {
  return <div className="customerMetricLabel">证据信任级别：{vm.trustText}</div>;
}

export function EvidenceTrustBadge({ vm }: { vm: EvidenceVm }): React.ReactElement {
  if (vm.trustLevel === "FORMAL") return <FormalEvidenceBadge />;
  if (vm.trustLevel === "SIMULATED") return <SimulatedOrDebugEvidenceBadge />;
  if (vm.trustLevel === "TECHNICAL_ONLY") return <TechnicalSignalBadge />;
  return <MissingEvidenceBadge />;
}

export function EvidenceRefList({
  vm,
  mode = "customer",
}: {
  vm: EvidenceVm;
  mode?: EvidenceViewMode;
}): React.ReactElement {
  if (!vm.refs.length) return <div className="muted">暂无证据引用</div>;
  if (mode === "operator") {
    return <ul className="customerList">{vm.refs.map((r, i) => <li key={`${r.ref}-${i}`} className="customerListItem">{r.label}｜{badgeTone(r.type)}｜{r.ref}</li>)}</ul>;
  }
  return <ul className="customerList">{vm.refs.map((r, i) => <li key={`${r.label}-${r.type}-${i}`} className="customerListItem">{badgeTone(r.type)}｜{r.label || "证据摘要待补充"}</li>)}</ul>;
}

export function EvidenceGapPanel({ vm, mode = "customer" }: { vm: EvidenceVm; mode?: EvidenceViewMode }): React.ReactElement {
  const items = mode === "operator" ? (vm.operatorGaps ?? vm.gaps) : vm.gaps;
  return <div>{items.length ? items.join("、") : "无证据缺口"}</div>;
}
