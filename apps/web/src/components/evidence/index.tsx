import React from "react";
import type { EvidenceVm } from "../../lib/evidenceViewModel";

export function FormalEvidenceBadge(): React.ReactElement { return <span className="customerPill">正式证据</span>; }
export function TechnicalSignalBadge(): React.ReactElement { return <span className="customerPill">技术信号</span>; }
export function SimulatedOrDebugEvidenceBadge(): React.ReactElement { return <span className="customerPill">模拟/调试</span>; }
export function MissingEvidenceBadge(): React.ReactElement { return <span className="customerPill">证据缺失</span>; }

export function EvidenceTrustLegend({ vm }: { vm: EvidenceVm }): React.ReactElement {
  return <div className="customerMetricLabel">证据信任级别：{vm.trustLevel}</div>;
}

export function EvidenceRefList({ vm }: { vm: EvidenceVm }): React.ReactElement {
  return <ul className="customerList">{vm.refs.map((r, i) => <li key={`${r.ref}-${i}`} className="customerListItem">{r.label}｜{r.type}｜{r.ref}</li>)}</ul>;
}

export function EvidenceGapPanel({ vm }: { vm: EvidenceVm }): React.ReactElement {
  return <div>{vm.gaps.length ? vm.gaps.join("、") : "无证据缺口"}</div>;
}
