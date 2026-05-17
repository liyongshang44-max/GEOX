import React from "react";

function asList(value: unknown): string[] {
  return Array.isArray(value) ? value.map((x) => String(x ?? "").trim()).filter(Boolean) : [];
}

export function OperatorFormalChainTimeline({ report }: { report: any }): React.ReactElement {
  const fs = report?.formal_scenario ?? {};
  return <article className="operatorQueueCard"><header className="operatorQueueHead"><h2>Formal Chain</h2></header><p>场景：{String(fs.scenario_type ?? "UNKNOWN")}</p><p>链路：{String(fs.formal_chain_status ?? "LIMITED")}</p><p>证据：{String(fs.evidence_status ?? "MISSING")}</p></article>;
}

export function OperatorEvidenceGapPanel({ report }: { report: any }): React.ReactElement {
  const gaps = asList(report?.acceptance?.missing_items).concat(asList(report?.formal_scenario?.blocking_reasons));
  return <article className="operatorQueueCard"><header className="operatorQueueHead"><h2>Evidence Gaps</h2></header>{gaps.length ? <ul>{gaps.map((x) => <li key={x}>{x}</li>)}</ul> : <p>无缺口</p>}</article>;
}

export function OperatorAcceptanceReasonPanel({ report }: { report: any }): React.ReactElement {
  const reasons = asList((report as any)?.acceptance?.reason_codes ?? (report as any)?.risk?.reasons);
  return <article className="operatorQueueCard"><header className="operatorQueueHead"><h2>Acceptance Reasons</h2></header><p>验收：{String(report?.acceptance?.status ?? "NOT_AVAILABLE")}</p><p>结论：{String(report?.acceptance?.verdict ?? "--")}</p>{reasons.length ? <ul>{reasons.map((x) => <li key={x}>{x}</li>)}</ul> : null}</article>;
}

export function OperatorFailSafePanel({ report }: { report: any }): React.ReactElement {
  const fs = report?.fail_safe ?? {};
  return <article className="operatorQueueCard"><header className="operatorQueueHead"><h2>Fail-safe</h2></header><p>状态：{String(fs.status ?? "NONE")}</p><p>触发：{String(fs.trigger ?? "--")}</p><p>严重级别：{String(fs.severity ?? "--")}</p><p>事件ID：{String(fs.event_id ?? "--")}</p></article>;
}

export function OperatorManualTakeoverPanel({ report }: { report: any }): React.ReactElement {
  const mt = report?.manual_takeover ?? {};
  return <article className="operatorQueueCard"><header className="operatorQueueHead"><h2>Manual Takeover</h2></header><p>状态：{String(mt.status ?? "NONE")}</p><p>Takeover ID：{String(mt.takeover_id ?? "--")}</p><p>原因：{String(mt.reason ?? "--")}</p></article>;
}

export function OperatorZoneMatrixPanel({ report }: { report: any }): React.ReactElement {
  const rows = Array.isArray(report?.zone_matrix) ? report.zone_matrix : [];
  return <article className="operatorQueueCard"><header className="operatorQueueHead"><h2>Zone Matrix</h2></header><p>rollup policy：{String(rows[0]?.operation_rollup_policy ?? "--")}</p>{rows.length ? <ul>{rows.map((z: any) => <li key={String(z.zone_id)}>{String(z.zone_id)}：{String(z.zone_acceptance_result)} / {String(z.evidence_sufficiency)}</li>)}</ul> : <p>无分区矩阵</p>}</article>;
}
