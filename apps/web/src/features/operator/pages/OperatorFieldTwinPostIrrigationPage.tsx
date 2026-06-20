// apps/web/src/features/operator/pages/OperatorFieldTwinPostIrrigationPage.tsx
// Purpose: render the H27 read-only post-irrigation response verification page.
// Boundary: this page validates evidence only; it does not write Field Memory, ROI, facts, control sends, approvals, recommendations, or tasks.

import React from "react";
import { Link, useParams, useSearchParams } from "react-router-dom";
import {
  buildOperatorTwinScopeQuery,
  fetchOperatorFieldTwinPostIrrigationVerification,
  type OperatorExecutionEvidence,
  type OperatorFieldTwinPostIrrigationVerificationV1,
  type OperatorIrrigationResponseDelta,
  type OperatorIrrigationStateSnapshot,
  type OperatorTwinRequestScope,
  type OperatorZoneResponseMatrix,
} from "../../../api/operatorTwin";

type RuntimeState = "loading" | "ready" | "error";

function scopeFromSearchParams(searchParams: URLSearchParams): OperatorTwinRequestScope {
  return { tenant_id: searchParams.get("tenant_id"), project_id: searchParams.get("project_id"), group_id: searchParams.get("group_id") };
}

function ValueLine({ label, value }: { label: string; value: React.ReactNode }): React.ReactElement {
  return <li><strong>{label}:</strong> {value ?? "none"}</li>;
}

export function PostIrrigationStateComparePanel({ pre, post }: { pre: OperatorIrrigationStateSnapshot; post: OperatorIrrigationStateSnapshot }): React.ReactElement {
  return <article className="operatorPanel" data-card="PostIrrigationStateComparePanel"><p className="operatorEyebrow">state_compare</p><h3>State Before / After</h3><div className="operatorPanelGrid"><ul className="operatorList"><li><span className="operatorPill">Before</span></li><ValueLine label="available" value={String(pre.available)} /><ValueLine label="observed_at" value={pre.observed_at} /><ValueLine label="soil_moisture_value" value={pre.soil_moisture_value} /><ValueLine label="water_state" value={pre.water_state} /></ul><ul className="operatorList"><li><span className="operatorPill">After</span></li><ValueLine label="available" value={String(post.available)} /><ValueLine label="observed_at" value={post.observed_at} /><ValueLine label="soil_moisture_value" value={post.soil_moisture_value} /><ValueLine label="water_state" value={post.water_state} /></ul></div></article>;
}

export function ResponseDeltaPanel({ delta }: { delta: OperatorIrrigationResponseDelta }): React.ReactElement {
  return <article className="operatorPanel" data-card="ResponseDeltaPanel"><p className="operatorEyebrow">response_delta_v1</p><h3>Response Delta</h3><ul className="operatorList"><ValueLine label="status" value={<span className="operatorPill">{delta.status}</span>} /><ValueLine label="delta_direction" value={delta.delta_direction} /><ValueLine label="delta_value" value={delta.delta_value} /><ValueLine label="meets_expected_response" value={delta.meets_expected_response === null ? "unknown" : String(delta.meets_expected_response)} /><ValueLine label="reason_codes" value={delta.reason_codes.join(", ") || "none"} /></ul></article>;
}

export function ExecutionEvidencePanel({ evidence }: { evidence: OperatorExecutionEvidence }): React.ReactElement {
  return <article className="operatorPanel" data-card="ExecutionEvidencePanel"><p className="operatorEyebrow">execution_evidence_v1</p><h3>Execution Evidence</h3><ul className="operatorList"><ValueLine label="receipt_available" value={String(evidence.receipt_available)} /><ValueLine label="as_executed_available" value={String(evidence.as_executed_available)} /><ValueLine label="acceptance_available" value={String(evidence.acceptance_available)} /><ValueLine label="operation_report_available" value={String(evidence.operation_report_available)} /><ValueLine label="evidence_refs" value={evidence.evidence_refs.join(", ") || "none"} /></ul></article>;
}

export function ZoneResponseMatrixPanel({ matrix }: { matrix: OperatorZoneResponseMatrix }): React.ReactElement {
  return <article className="operatorPanel" data-card="ZoneResponseMatrixPanel"><p className="operatorEyebrow">zone_response_matrix_v1</p><h3>Zone Response Matrix</h3><table className="operatorTable"><thead><tr><th>zone</th><th>status</th><th>delta</th></tr></thead><tbody>{matrix.rows.length ? matrix.rows.map((row, index) => <tr key={index}><td>{String(row.zone_id ?? index + 1)}</td><td>{String(row.status ?? "UNKNOWN")}</td><td>{String(row.delta_value ?? "none")}</td></tr>) : <tr><td colSpan={3}>No zone-level verification rows available.</td></tr>}</tbody></table></article>;
}

export function VerificationGapList({ verification }: { verification: OperatorFieldTwinPostIrrigationVerificationV1 }): React.ReactElement {
  return <article className="operatorPanel" data-card="VerificationGapList"><p className="operatorEyebrow">verification_gaps</p><h3>Verification Gaps</h3><ul className="operatorList">{verification.verification_gaps.length ? verification.verification_gaps.map((gap) => <li key={gap.gap_code}>{gap.gap_code} · {gap.severity} · {gap.label}</li>) : <li>No blocking verification gaps.</li>}</ul></article>;
}

export default function OperatorFieldTwinPostIrrigationPage(): React.ReactElement {
  const params = useParams();
  const [searchParams] = useSearchParams();
  const scope = React.useMemo(() => scopeFromSearchParams(searchParams), [searchParams]);
  const scopeQueryString = React.useMemo(() => buildOperatorTwinScopeQuery(scope), [scope]);
  const fieldId = String(params.fieldId ?? "").trim() || "field_c8_demo";
  const [state, setState] = React.useState<RuntimeState>("loading");
  const [verification, setVerification] = React.useState<OperatorFieldTwinPostIrrigationVerificationV1 | null>(null);
  const [errorText, setErrorText] = React.useState("");

  React.useEffect(() => { let alive = true; setState("loading"); setVerification(null); setErrorText(""); void fetchOperatorFieldTwinPostIrrigationVerification(fieldId, scope).then((response) => { if (!alive) return; setVerification(response.operator_field_twin_post_irrigation_verification_v1); setState("ready"); }).catch((error: unknown) => { if (!alive) return; setErrorText(error instanceof Error ? error.message : "OPERATOR_FIELD_TWIN_POST_IRRIGATION_LOAD_FAILED"); setState("error"); }); return () => { alive = false; }; }, [fieldId, scope]);

  return <section className="operatorWorkbenchPage" data-surface="operator-twin" data-page="operator-field-twin-post-irrigation" data-contract="operator_field_twin_post_irrigation_verification_v1"><div className="operatorWorkbenchHero"><div><p className="operatorEyebrow">Operator Post-Irrigation Verification</p><h2>灌后响应验证</h2><p>本页只读，用于验证灌后响应证据，不写入 Field Memory，不写 ROI，不创建 task。</p><span className="operatorPill">read-only verification projection</span></div><div className="operatorWorkbenchHeroActions"><Link className="operatorActionLink" to={"/operator/twin/fields/" + encodeURIComponent(fieldId) + scopeQueryString}>Workspace</Link><Link className="operatorActionLink" to={"/operator/twin/fields/" + encodeURIComponent(fieldId) + "/forecast" + scopeQueryString}>Forecast</Link><Link className="operatorActionLink" to={"/operator/twin/fields/" + encodeURIComponent(fieldId) + "/evidence" + scopeQueryString}>Evidence</Link><Link className="operatorActionLink" to={"/operator/twin/fields/" + encodeURIComponent(fieldId) + "/calibration" + scopeQueryString}>Calibration</Link></div></div>{state === "loading" ? <div className="operatorPanel">Post-irrigation verification 数据加载中...</div> : null}{state === "error" ? <div className="operatorPanel">Post-irrigation verification 数据加载失败：{errorText}</div> : null}{verification ? <div className="operatorPanelGrid"><PostIrrigationStateComparePanel pre={verification.pre_irrigation_state_v1} post={verification.post_irrigation_state_v1} /><ResponseDeltaPanel delta={verification.response_delta_v1} /><ExecutionEvidencePanel evidence={verification.execution_evidence_v1} /><ZoneResponseMatrixPanel matrix={verification.zone_response_matrix_v1} /><article className="operatorPanel"><p className="operatorEyebrow">verification_summary</p><h3>Verification Summary</h3><ul className="operatorList"><ValueLine label="status" value={<span className="operatorPill">{verification.verification_summary.status}</span>} /><ValueLine label="reason" value={verification.verification_summary.reason} /><ValueLine label="field_memory_candidate" value={String(verification.verification_summary.field_memory_candidate)} /><ValueLine label="roi_candidate" value={String(verification.verification_summary.roi_candidate)} /><ValueLine label="write_ready" value={String(verification.verification_summary.write_ready)} /></ul></article><VerificationGapList verification={verification} /><article className="operatorPanel operatorBoundaryNotice"><p className="operatorEyebrow">boundary_rules</p><h3>Boundary Rules</h3><ul className="operatorList">{verification.boundary_rules.map((rule) => <li key={rule.rule_code}>{rule.rule_code}：{rule.label}</li>)}</ul></article></div> : null}</section>;
}
