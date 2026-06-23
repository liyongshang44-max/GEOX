// apps/web/src/features/operator/pages/OperatorFieldTwinPostIrrigationPage.tsx
// Purpose: render the H27/H45 read-only post-irrigation response verification page.
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
import {
  fetchOperatorTwinH31H45Closure,
  normalizeOperatorTwinDemoFieldId,
  type OperatorTwinH31H45ClosureV1,
} from "../../../api/operatorTwinClosure";

type RuntimeState = "loading" | "ready" | "error";

type TailStage = {
  code: string;
  label: string;
  status: string;
  ref: string;
};

function scopeFromSearchParams(searchParams: URLSearchParams): OperatorTwinRequestScope {
  return {
    tenant_id: searchParams.get("tenant_id"),
    project_id: searchParams.get("project_id"),
    group_id: searchParams.get("group_id"),
  };
}

function ValueLine({ label, value }: { label: string; value: React.ReactNode }): React.ReactElement {
  return (
    <li>
      <strong>{label}:</strong> {value ?? "none"}
    </li>
  );
}

function fieldTwinPath(fieldId: string, suffix: string, scopeQueryString: string): string {
  return "/operator/twin/fields/" + encodeURIComponent(fieldId) + suffix + scopeQueryString;
}

function safeRef(value: string | null | undefined): string {
  const raw = String(value ?? "").trim();
  return raw || "pending";
}

export function PostIrrigationStateComparePanel({ pre, post }: { pre: OperatorIrrigationStateSnapshot; post: OperatorIrrigationStateSnapshot }): React.ReactElement {
  return (
    <article className="operatorPanel" data-card="PostIrrigationStateComparePanel">
      <p className="operatorEyebrow">state_compare</p>
      <h3>State Before / After</h3>
      <div className="operatorPanelGrid">
        <ul className="operatorList">
          <li><span className="operatorPill">Before</span></li>
          <ValueLine label="available" value={String(pre.available)} />
          <ValueLine label="observed_at" value={pre.observed_at} />
          <ValueLine label="soil_moisture_value" value={pre.soil_moisture_value} />
          <ValueLine label="water_state" value={pre.water_state} />
        </ul>
        <ul className="operatorList">
          <li><span className="operatorPill">After</span></li>
          <ValueLine label="available" value={String(post.available)} />
          <ValueLine label="observed_at" value={post.observed_at} />
          <ValueLine label="soil_moisture_value" value={post.soil_moisture_value} />
          <ValueLine label="water_state" value={post.water_state} />
        </ul>
      </div>
    </article>
  );
}

export function ResponseDeltaPanel({ delta, closure }: { delta: OperatorIrrigationResponseDelta; closure: OperatorTwinH31H45ClosureV1 | null }): React.ReactElement {
  const summary = closure?.response_summary;
  return (
    <article className="operatorPanel" data-card="ResponseDeltaPanel">
      <p className="operatorEyebrow">response_delta_v1</p>
      <h3>Response Delta</h3>
      <ul className="operatorList">
        <ValueLine label="status" value={<span className="operatorPill">{summary?.status || delta.status}</span>} />
        <ValueLine label="delta_direction" value={delta.delta_direction} />
        <ValueLine label="delta_value" value={summary?.delta_value ?? delta.delta_value} />
        <ValueLine label="meets_expected_response" value={delta.meets_expected_response === null ? "unknown" : String(delta.meets_expected_response)} />
        <ValueLine label="reason_codes" value={delta.reason_codes.join(", ") || "none"} />
      </ul>
    </article>
  );
}

export function ExecutionEvidencePanel({ evidence }: { evidence: OperatorExecutionEvidence }): React.ReactElement {
  return (
    <article className="operatorPanel" data-card="ExecutionEvidencePanel">
      <p className="operatorEyebrow">execution_evidence_v1</p>
      <h3>Execution Evidence</h3>
      <ul className="operatorList">
        <ValueLine label="receipt_available" value={String(evidence.receipt_available)} />
        <ValueLine label="as_executed_available" value={String(evidence.as_executed_available)} />
        <ValueLine label="acceptance_available" value={String(evidence.acceptance_available)} />
        <ValueLine label="operation_report_available" value={String(evidence.operation_report_available)} />
        <ValueLine label="evidence_refs" value={evidence.evidence_refs.join(", ") || "none"} />
      </ul>
    </article>
  );
}

export function ZoneResponseMatrixPanel({ matrix }: { matrix: OperatorZoneResponseMatrix }): React.ReactElement {
  return (
    <article className="operatorPanel" data-card="ZoneResponseMatrixPanel">
      <p className="operatorEyebrow">zone_response_matrix_v1</p>
      <h3>Zone Response Matrix</h3>
      <table className="operatorTable">
        <thead><tr><th>zone</th><th>status</th><th>delta</th></tr></thead>
        <tbody>
          {matrix.rows.length ? matrix.rows.map((row, index) => (
            <tr key={index}>
              <td>{String(row.zone_id ?? index + 1)}</td>
              <td>{String(row.status ?? "UNKNOWN")}</td>
              <td>{String(row.delta_value ?? "none")}</td>
            </tr>
          )) : <tr><td colSpan={3}>No zone-level verification rows available.</td></tr>}
        </tbody>
      </table>
    </article>
  );
}

export function VerificationGapList({ verification }: { verification: OperatorFieldTwinPostIrrigationVerificationV1 }): React.ReactElement {
  return (
    <article className="operatorPanel" data-card="VerificationGapList">
      <p className="operatorEyebrow">verification_gaps</p>
      <h3>Verification Gaps</h3>
      <ul className="operatorList">
        {verification.verification_gaps.length ? verification.verification_gaps.map((gap) => (
          <li key={gap.gap_code}>{gap.gap_code} · {gap.severity} · {gap.label}</li>
        )) : <li>No blocking verification gaps.</li>}
      </ul>
    </article>
  );
}

function buildExecutionTailStages(verification: OperatorFieldTwinPostIrrigationVerificationV1, closure: OperatorTwinH31H45ClosureV1 | null): TailStage[] {
  const tail = closure?.execution_tail ?? {};
  return [
    { code: "H40", label: "AO-ACT Task", status: tail.task_id || verification.operation_context.task_id ? "TASK_AVAILABLE" : "TASK_PENDING", ref: safeRef(tail.task_id ?? verification.operation_context.task_id) },
    { code: "H41", label: "AO-ACT Receipt", status: tail.receipt_id || verification.execution_evidence_v1.receipt_available ? "RECEIPT_AVAILABLE" : "RECEIPT_PENDING", ref: safeRef(tail.receipt_id ?? verification.operation_context.receipt_id) },
    { code: "H42", label: "As-Executed Record", status: tail.as_executed_id || verification.execution_evidence_v1.as_executed_available ? "AS_EXECUTED_AVAILABLE" : "AS_EXECUTED_PENDING", ref: safeRef(tail.as_executed_id ?? verification.operation_context.as_executed_id) },
    { code: "H43", label: "Evidence Artifact", status: verification.execution_evidence_v1.evidence_refs.length > 0 ? "EVIDENCE_LINKED" : "EVIDENCE_PENDING", ref: verification.execution_evidence_v1.evidence_refs.join(", ") || "pending" },
    { code: "H44", label: "Acceptance Result", status: tail.acceptance_result_id || verification.execution_evidence_v1.acceptance_available ? "ACCEPTANCE_AVAILABLE" : "ACCEPTANCE_PENDING", ref: safeRef(tail.acceptance_result_id ?? verification.operation_context.acceptance_result_id) },
    { code: "H45", label: "Water Response Verification", status: closure?.response_summary?.status ?? verification.verification_summary.status, ref: safeRef(tail.water_response_verification_id ?? verification.verification_summary.reason) },
  ];
}

function ExecutionTailChainPanel({ verification, closure }: { verification: OperatorFieldTwinPostIrrigationVerificationV1; closure: OperatorTwinH31H45ClosureV1 | null }): React.ReactElement {
  const stages = buildExecutionTailStages(verification, closure);
  return (
    <article className="operatorPanel" data-card="ExecutionTailChainPanel" data-contract="h40_h45_execution_tail_read_only">
      <p className="operatorEyebrow">H40-H45 execution tail</p>
      <h3>执行后链路</h3>
      <p>该表只读串联 task、receipt、as-executed、evidence、acceptance 和 water response，不创建后续 Field Memory 或 ROI。</p>
      <table className="operatorTable" data-table="h40-h45-execution-tail">
        <thead><tr><th>stage</th><th>node</th><th>status</th><th>ref</th></tr></thead>
        <tbody>{stages.map((stage) => (
          <tr key={stage.code} data-stage={stage.code.toLowerCase()}>
            <td>{stage.code}</td><td>{stage.label}</td><td><span className="operatorPill">{stage.status}</span></td><td>{stage.ref}</td>
          </tr>
        ))}</tbody>
      </table>
    </article>
  );
}

export default function OperatorFieldTwinPostIrrigationPage(): React.ReactElement {
  const params = useParams();
  const [searchParams] = useSearchParams();
  const scope = React.useMemo(() => scopeFromSearchParams(searchParams), [searchParams]);
  const scopeQueryString = React.useMemo(() => buildOperatorTwinScopeQuery(scope), [scope]);
  const fieldId = normalizeOperatorTwinDemoFieldId(params.fieldId);
  const [state, setState] = React.useState<RuntimeState>("loading");
  const [verification, setVerification] = React.useState<OperatorFieldTwinPostIrrigationVerificationV1 | null>(null);
  const [closure, setClosure] = React.useState<OperatorTwinH31H45ClosureV1 | null>(null);
  const [errorText, setErrorText] = React.useState("");

  React.useEffect(() => {
    let alive = true;
    setState("loading");
    setVerification(null);
    setClosure(null);
    setErrorText("");
    void Promise.all([
      fetchOperatorFieldTwinPostIrrigationVerification(fieldId, scope),
      fetchOperatorTwinH31H45Closure(fieldId, scope),
    ]).then(([verificationResponse, closureResponse]) => {
      if (!alive) return;
      setVerification(verificationResponse.operator_field_twin_post_irrigation_verification_v1);
      setClosure(closureResponse.operator_twin_h31_h45_closure_v1);
      setState("ready");
    }).catch((error: unknown) => {
      if (!alive) return;
      setErrorText(error instanceof Error ? error.message : "OPERATOR_FIELD_TWIN_POST_IRRIGATION_LOAD_FAILED");
      setState("error");
    });
    return () => { alive = false; };
  }, [fieldId, scope]);

  return (
    <section className="operatorWorkbenchPage" data-surface="operator-twin" data-page="operator-field-twin-post-irrigation" data-contract="operator_field_twin_post_irrigation_verification_v1">
      <div className="operatorWorkbenchHero">
        <div>
          <p className="operatorEyebrow">Operator Post-Irrigation Verification</p>
          <h2>灌后响应验证</h2>
          <p>本页只读，用于验证灌后响应证据，不写入 Field Memory，不写 ROI，不创建 task。</p>
          <span className="operatorPill">read-only verification projection</span>
        </div>
        <div className="operatorWorkbenchHeroActions">
          <Link className="operatorActionLink" to={fieldTwinPath(fieldId, "", scopeQueryString)}>Workspace</Link>
          <Link className="operatorActionLink" to={fieldTwinPath(fieldId, "/forecast", scopeQueryString)}>Forecast</Link>
          <Link className="operatorActionLink" to={fieldTwinPath(fieldId, "/scenarios", scopeQueryString)}>Scenarios</Link>
          <Link className="operatorActionLink" to={fieldTwinPath(fieldId, "/evidence", scopeQueryString)}>Evidence</Link>
          <Link className="operatorActionLink" to={fieldTwinPath(fieldId, "/calibration", scopeQueryString)}>Calibration</Link>
        </div>
      </div>
      {state === "loading" ? <div className="operatorPanel">Post-irrigation verification 数据加载中...</div> : null}
      {state === "error" ? <div className="operatorPanel">Post-irrigation verification 数据加载失败：{errorText}</div> : null}
      {verification ? (
        <div className="operatorPanelGrid">
          <ExecutionTailChainPanel verification={verification} closure={closure} />
          <PostIrrigationStateComparePanel pre={verification.pre_irrigation_state_v1} post={verification.post_irrigation_state_v1} />
          <ResponseDeltaPanel delta={verification.response_delta_v1} closure={closure} />
          <ExecutionEvidencePanel evidence={verification.execution_evidence_v1} />
          <ZoneResponseMatrixPanel matrix={verification.zone_response_matrix_v1} />
          <article className="operatorPanel">
            <p className="operatorEyebrow">verification_summary</p>
            <h3>Verification Summary</h3>
            <ul className="operatorList">
              <ValueLine label="status" value={<span className="operatorPill">{closure?.response_summary?.status ?? verification.verification_summary.status}</span>} />
              <ValueLine label="reason" value={verification.verification_summary.reason} />
              <ValueLine label="field_memory_candidate" value={String(verification.verification_summary.field_memory_candidate)} />
              <ValueLine label="roi_candidate" value={String(verification.verification_summary.roi_candidate)} />
              <ValueLine label="write_ready" value={String(verification.verification_summary.write_ready)} />
            </ul>
          </article>
          <VerificationGapList verification={verification} />
          <article className="operatorPanel operatorBoundaryNotice">
            <p className="operatorEyebrow">boundary_rules</p>
            <h3>Boundary Rules</h3>
            <ul className="operatorList">{verification.boundary_rules.map((rule) => <li key={rule.rule_code}>{rule.rule_code}：{rule.label}</li>)}</ul>
          </article>
        </div>
      ) : null}
    </section>
  );
}
