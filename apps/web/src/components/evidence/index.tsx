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
  const formalCount = vm.refs.filter((r) => r.type === "FORMAL").length;
  const technicalCount = vm.refs.filter((r) => r.type === "TECHNICAL").length;
  const simulatedCount = vm.refs.filter((r) => r.type === "SIMULATED").length;
  const missingCount = vm.refs.filter((r) => r.type === "MISSING").length;
  return (
    <ul className="customerList">
      {formalCount ? <li className="customerListItem">正式证据：{formalCount} 条</li> : null}
      {technicalCount ? <li className="customerListItem">技术信号：{technicalCount} 条</li> : null}
      {simulatedCount ? <li className="customerListItem">模拟/调试记录：{simulatedCount} 条，不作为正式结论</li> : null}
      {missingCount ? <li className="customerListItem">证据缺口：见下方摘要</li> : null}
      {!formalCount && !technicalCount && !simulatedCount && !missingCount ? <li className="customerListItem">暂无证据引用</li> : null}
    </ul>
  );
}

export function InspectionEvidenceSummary({ vm }: { vm: EvidenceVm }): React.ReactElement | null {
  const summary = vm.inspectionSummary;
  if (!summary) return null;
  return (
    <ul className="customerList">
      <li className="customerListItem">图片/媒体证据：{summary.media_count > 0 ? `${summary.media_count} 条` : "缺图片"}</li>
      <li className="customerListItem">定位证据：{summary.geo_evidence_present ? "有定位" : "缺定位"}</li>
      <li className="customerListItem">人工复核：{summary.reviewed_by_human ? "已复核" : "未完成复核"}</li>
      <li className="customerListItem">严重度：{summary.severity ?? "待确认"}｜置信度：{summary.confidence ?? "待确认"}</li>
      {summary.review_required ? <li className="customerListItem">需要人工复核</li> : null}
      {summary.blocking_reasons.includes("pest_disease_skill_signal_only") ? <li className="customerListItem">当前仅为识别信号，不作为正式巡检结论</li> : null}
    </ul>
  );
}

export function EvidenceGapPanel({ vm, mode = "customer" }: { vm: EvidenceVm; mode?: EvidenceViewMode }): React.ReactElement {
  const items = mode === "operator" ? (vm.operatorGaps ?? vm.gaps) : vm.gaps;
  return <><InspectionEvidenceSummary vm={vm} />{!items.length ? <div>无证据缺口</div> : mode === "operator" ? <div>{items.join("、")}</div> : <ul className="customerList">{items.map((item, i) => <li key={`${item}-${i}`} className="customerListItem">{item}</li>)}</ul>}</>;
}
