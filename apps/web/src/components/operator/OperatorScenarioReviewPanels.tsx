import React from "react";

function text(value: unknown, fallback = "--"): string {
  const raw = String(value ?? "").trim();
  return raw || fallback;
}

function asList(value: unknown): string[] {
  return Array.isArray(value) ? value.map((x) => String(x ?? "").trim()).filter(Boolean) : [];
}

function asObj(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value) ? (value as Record<string, unknown>) : {};
}

function renderRefs(label: string, refs: unknown): React.ReactElement {
  const values = asList(refs);
  return (
    <div>
      <strong>{label}</strong>
      {values.length ? <ul>{values.map((ref) => <li key={`${label}-${ref}`}>{ref}</li>)}</ul> : <p>--</p>}
    </div>
  );
}

export function OperatorFormalChainTimeline({ report }: { report: any }): React.ReactElement {
  const formalScenario = asObj(report?.formal_scenario);
  return <article className="operatorQueueCard"><header className="operatorQueueHead"><h2>Formal Chain Timeline</h2></header><p>Scenario: {text(formalScenario.scenario_type, "UNKNOWN")}</p><p>Formal chain: {text(formalScenario.formal_chain_status, "LIMITED")}</p><p>Evidence status: {text(formalScenario.evidence_status, "MISSING")}</p><p>Customer visible eligible: {text(formalScenario.customer_visible_eligible, "false")}</p><p>Needs review: {text(formalScenario.needs_review, "true")}</p>{renderRefs("Formal evidence refs", report?.evidence_refs ?? report?.formal_evidence_refs)}</article>;
}

export function OperatorEvidenceGapPanel({ report }: { report: any }): React.ReactElement {
  const gaps = asList(report?.acceptance?.missing_items).concat(asList(report?.formal_scenario?.blocking_reasons));
  return <article className="operatorQueueCard"><header className="operatorQueueHead"><h2>Missing Evidence Gaps</h2></header>{gaps.length ? <ul>{gaps.map((x) => <li key={x}>{x}</li>)}</ul> : <p>无缺口</p>}</article>;
}

export function OperatorAcceptanceReasonPanel({ report }: { report: any }): React.ReactElement {
  const reasons = asList(report?.acceptance?.reason_codes ?? report?.risk?.reasons);
  return <article className="operatorQueueCard"><header className="operatorQueueHead"><h2>Acceptance Reason Codes</h2></header><p>Approval state: {text(report?.approval?.status, "NOT_AVAILABLE")}</p><p>Acceptance state: {text(report?.acceptance?.status, "NOT_AVAILABLE")}</p><p>Acceptance verdict (source): {text(report?.acceptance?.verdict, "--")}</p>{reasons.length ? <ul>{reasons.map((x) => <li key={x}>{x}</li>)}</ul> : <p>--</p>}<p>Task state: {text(report?.execution?.final_status, "--")}</p><p>Receipt state: {text(report?.identifiers?.receipt_id ? "PRESENT" : "MISSING", "MISSING")}</p></article>;
}

export function OperatorFailSafePanel({ report }: { report: any }): React.ReactElement {
  const failSafe = asObj(report?.fail_safe);
  const deviceHealth = asObj((report as any)?.device_health);
  return <article className="operatorQueueCard"><header className="operatorQueueHead"><h2>Fail-safe / Device Health</h2></header><p>Fail-safe event: {text(failSafe.status, "NONE")}</p><p>Trigger: {text(failSafe.trigger)}</p><p>Severity: {text(failSafe.severity)}</p><p>Event ID: {text(failSafe.event_id)}</p><p>Device health: {text(deviceHealth.status ?? (report?.as_executed?.device_id ? "UNKNOWN" : "NOT_APPLICABLE"))}</p><p>Device ID: {text(report?.as_executed?.device_id)}</p></article>;
}

export function OperatorManualTakeoverPanel({ report }: { report: any }): React.ReactElement {
  const takeover = asObj(report?.manual_takeover);
  return <article className="operatorQueueCard"><header className="operatorQueueHead"><h2>Manual Takeover State</h2></header><p>Status: {text(takeover.status, "NONE")}</p><p>Takeover ID: {text(takeover.takeover_id)}</p><p>Reason: {text(takeover.reason)}</p><p>Operation owner: {text(report?.workflow?.owner_name ?? report?.workflow?.owner_actor_id)}</p></article>;
}

export function OperatorZoneMatrixPanel({ report }: { report: any }): React.ReactElement {
  const rows = Array.isArray(report?.zone_matrix) ? report.zone_matrix : [];
  const policy = text(report?.zone_evidence_customer_v1?.operation_rollup_policy ?? rows[0]?.operation_rollup_policy);
  return <article className="operatorQueueCard"><header className="operatorQueueHead"><h2>Zone-level Evidence Matrix</h2></header><p>Operation rollup policy: {policy}</p>{rows.length ? <ul>{rows.map((zone: any) => <li key={String(zone.zone_id)}>{text(zone.zone_id)}: acceptance={text(zone.zone_acceptance_result)} / evidence={text(zone.evidence_sufficiency)} / pre={text(zone.pre_sensing_ref)} / post={text(zone.post_sensing_ref)}</li>)}</ul> : <p>无分区矩阵</p>}</article>;
}
