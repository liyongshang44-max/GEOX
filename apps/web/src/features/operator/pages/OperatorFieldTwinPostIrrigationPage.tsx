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
      <strong>{label}：</strong>{value ?? "无"}
    </li>
  );
}

function fieldTwinPath(fieldId: string, suffix: string, scopeQueryString: string): string {
  return "/operator/twin/fields/" + encodeURIComponent(fieldId) + suffix + scopeQueryString;
}

function safeRef(value: string | null | undefined): string {
  const raw = String(value ?? "").trim();
  return raw || "待补证据";
}

function boolText(value: boolean | null | undefined): string {
  if (value === true) return "是";
  if (value === false) return "否";
  return "未知";
}

function valueText(value: unknown): string {
  if (value === null || value === undefined || value === "") return "无";
  return String(value);
}

function statusText(code: string | null | undefined): string {
  const raw = String(code ?? "UNKNOWN");
  const map: Record<string, string> = {
    RESPONSE_OBSERVED: "已观察到灌后响应",
    TASK_AVAILABLE: "任务已存在",
    RECEIPT_AVAILABLE: "执行回执已存在",
    AS_EXECUTED_AVAILABLE: "实执记录已存在",
    EVIDENCE_LINKED: "执行证据已关联",
    ACCEPTANCE_AVAILABLE: "验收结果已存在",
    AVAILABLE: "可用",
    NORMAL: "正常",
    MODERATE_DEFICIT: "中度缺水",
    INCREASED: "上升",
    DECREASED: "下降",
    UNCHANGED: "无变化",
    UNKNOWN: "未知",
  };
  return (map[raw] ?? raw) + "（" + raw + "）";
}

function transitionText(code: string | null | undefined): string {
  const raw = String(code ?? "UNKNOWN");
  if (raw === "MODERATE_DEFICIT_TO_NORMAL") return "灌前中度缺水，灌后恢复正常（MODERATE_DEFICIT_TO_NORMAL）";
  return statusText(raw);
}

function RefList({ refs }: { refs: string[] }): React.ReactElement {
  const cleanRefs = refs.map((ref) => ref.trim()).filter(Boolean);
  if (cleanRefs.length === 0) return <span>无</span>;
  return (
    <details>
      <summary>查看 {cleanRefs.length} 条证据引用</summary>
      <ul className="operatorList">
        {cleanRefs.map((ref) => <li key={ref}>{ref}</li>)}
      </ul>
    </details>
  );
}

function PostIrrigationConclusionPanel({ closure }: { closure: OperatorTwinH31H45ClosureV1 | null }): React.ReactElement {
  const summary = closure?.response_summary;
  return (
    <article className="operatorPanel" data-card="PostIrrigationConclusionPanel" data-contract="h51_5_chinese_operator_summary">
      <p className="operatorEyebrow">灌后结论</p>
      <h3>这次灌溉是否有效？</h3>
      <ul className="operatorList">
        <ValueLine label="验证结论" value={<span className="operatorPill">{statusText(summary?.status)}</span>} />
        <ValueLine label="水分状态变化" value={transitionText(summary?.class_transition)} />
        <ValueLine label="可用水分变化量" value={valueText(summary?.available_water_fraction_delta ?? summary?.delta_value)} />
        <ValueLine label="验证编号" value={valueText(summary?.verification_id)} />
        <ValueLine label="只读边界" value="本页只展示证据和响应，不写入 Field Memory，不写 ROI，不创建新任务。" />
      </ul>
    </article>
  );
}

export function PostIrrigationStateComparePanel({ pre, post }: { pre: OperatorIrrigationStateSnapshot; post: OperatorIrrigationStateSnapshot }): React.ReactElement {
  return (
    <article className="operatorPanel" data-card="PostIrrigationStateComparePanel">
      <p className="operatorEyebrow">灌前 / 灌后状态</p>
      <h3>水分状态对比</h3>
      <div className="operatorPanelGrid">
        <ul className="operatorList">
          <li><span className="operatorPill">灌前</span></li>
          <ValueLine label="数据可用" value={boolText(pre.available)} />
          <ValueLine label="观测时间" value={pre.observed_at} />
          <ValueLine label="土壤水分值" value={valueText(pre.soil_moisture_value)} />
          <ValueLine label="水分状态" value={statusText(pre.water_state)} />
        </ul>
        <ul className="operatorList">
          <li><span className="operatorPill">灌后</span></li>
          <ValueLine label="数据可用" value={boolText(post.available)} />
          <ValueLine label="观测时间" value={post.observed_at} />
          <ValueLine label="土壤水分值" value={valueText(post.soil_moisture_value)} />
          <ValueLine label="水分状态" value={statusText(post.water_state)} />
        </ul>
      </div>
    </article>
  );
}

export function ResponseDeltaPanel({ delta, closure }: { delta: OperatorIrrigationResponseDelta; closure: OperatorTwinH31H45ClosureV1 | null }): React.ReactElement {
  const summary = closure?.response_summary;
  return (
    <article className="operatorPanel" data-card="ResponseDeltaPanel">
      <p className="operatorEyebrow">响应变化</p>
      <h3>灌后响应增量</h3>
      <ul className="operatorList">
        <ValueLine label="状态" value={<span className="operatorPill">{statusText(summary?.status || delta.status)}</span>} />
        <ValueLine label="变化方向" value={statusText(delta.delta_direction)} />
        <ValueLine label="变化量" value={valueText(summary?.delta_value ?? delta.delta_value)} />
        <ValueLine label="是否达到预期响应" value={delta.meets_expected_response === null ? "未知" : boolText(delta.meets_expected_response)} />
        <ValueLine label="原因代码" value={delta.reason_codes.join("，") || "无"} />
      </ul>
    </article>
  );
}

export function ExecutionEvidencePanel({ evidence }: { evidence: OperatorExecutionEvidence }): React.ReactElement {
  return (
    <article className="operatorPanel" data-card="ExecutionEvidencePanel">
      <p className="operatorEyebrow">执行证据</p>
      <h3>执行证据包</h3>
      <ul className="operatorList">
        <ValueLine label="回执可用" value={boolText(evidence.receipt_available)} />
        <ValueLine label="实执记录可用" value={boolText(evidence.as_executed_available)} />
        <ValueLine label="验收结果可用" value={boolText(evidence.acceptance_available)} />
        <ValueLine label="作业报告可用" value={boolText(evidence.operation_report_available)} />
        <ValueLine label="证据引用" value={<RefList refs={evidence.evidence_refs} />} />
      </ul>
    </article>
  );
}

export function ZoneResponseMatrixPanel({ matrix }: { matrix: OperatorZoneResponseMatrix }): React.ReactElement {
  return (
    <article className="operatorPanel" data-card="ZoneResponseMatrixPanel">
      <p className="operatorEyebrow">分区响应矩阵</p>
      <h3>管理分区响应</h3>
      <table className="operatorTable">
        <thead><tr><th>分区</th><th>状态</th><th>变化量</th></tr></thead>
        <tbody>
          {matrix.rows.length ? matrix.rows.map((row, index) => (
            <tr key={index}>
              <td>{String(row.zone_id ?? index + 1)}</td>
              <td>{statusText(String(row.status ?? "UNKNOWN"))}</td>
              <td>{valueText(row.delta_value)}</td>
            </tr>
          )) : <tr><td colSpan={3}>当前没有分区级响应验证行。</td></tr>}
        </tbody>
      </table>
    </article>
  );
}

export function VerificationGapList({ verification }: { verification: OperatorFieldTwinPostIrrigationVerificationV1 }): React.ReactElement {
  return (
    <article className="operatorPanel" data-card="VerificationGapList">
      <p className="operatorEyebrow">验证缺口</p>
      <h3>阻塞项检查</h3>
      <ul className="operatorList">
        {verification.verification_gaps.length ? verification.verification_gaps.map((gap) => (
          <li key={gap.gap_code}>{gap.label}（{gap.severity} / {gap.gap_code}）</li>
        )) : <li>没有阻塞本次灌后验证的缺口。</li>}
      </ul>
    </article>
  );
}

function buildExecutionTailStages(verification: OperatorFieldTwinPostIrrigationVerificationV1, closure: OperatorTwinH31H45ClosureV1 | null): TailStage[] {
  const tail = closure?.execution_tail ?? {};
  return [
    { code: "H40", label: "AO-ACT 任务", status: tail.task_id || verification.operation_context.task_id ? "TASK_AVAILABLE" : "TASK_PENDING", ref: safeRef(tail.task_id ?? verification.operation_context.task_id) },
    { code: "H41", label: "执行回执", status: tail.receipt_id || verification.execution_evidence_v1.receipt_available ? "RECEIPT_AVAILABLE" : "RECEIPT_PENDING", ref: safeRef(tail.receipt_id ?? verification.operation_context.receipt_id) },
    { code: "H42", label: "实执记录", status: tail.as_executed_id || verification.execution_evidence_v1.as_executed_available ? "AS_EXECUTED_AVAILABLE" : "AS_EXECUTED_PENDING", ref: safeRef(tail.as_executed_id ?? verification.operation_context.as_executed_id) },
    { code: "H43", label: "执行证据", status: verification.execution_evidence_v1.evidence_refs.length > 0 ? "EVIDENCE_LINKED" : "EVIDENCE_PENDING", ref: verification.execution_evidence_v1.evidence_refs.join(", ") || "pending" },
    { code: "H44", label: "验收结果", status: tail.acceptance_result_id || verification.execution_evidence_v1.acceptance_available ? "ACCEPTANCE_AVAILABLE" : "ACCEPTANCE_PENDING", ref: safeRef(tail.acceptance_result_id ?? verification.operation_context.acceptance_result_id) },
    { code: "H45", label: "水分响应验证", status: closure?.response_summary?.status ?? verification.verification_summary.status, ref: safeRef(tail.water_response_verification_id ?? verification.verification_summary.reason) },
  ];
}

function ExecutionTailChainPanel({ verification, closure }: { verification: OperatorFieldTwinPostIrrigationVerificationV1; closure: OperatorTwinH31H45ClosureV1 | null }): React.ReactElement {
  const stages = buildExecutionTailStages(verification, closure);
  return (
    <article className="operatorPanel" data-card="ExecutionTailChainPanel" data-contract="h40_h45_execution_tail_read_only">
      <p className="operatorEyebrow">H40-H45 执行后链路</p>
      <h3>从任务到水分响应</h3>
      <p>该表只读串联任务、回执、实执记录、证据、验收和水分响应验证，不创建后续 Field Memory 或 ROI。</p>
      <table className="operatorTable" data-table="h40-h45-execution-tail">
        <thead><tr><th>阶段</th><th>节点</th><th>状态</th><th>引用</th></tr></thead>
        <tbody>{stages.map((stage) => (
          <tr key={stage.code} data-stage={stage.code.toLowerCase()}>
            <td>{stage.code}</td><td>{stage.label}</td><td><span className="operatorPill">{statusText(stage.status)}</span></td><td>{stage.code === "H43" ? <RefList refs={stage.ref.split(",")} /> : stage.ref}</td>
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
          <p className="operatorEyebrow">灌后只读验证</p>
          <h2>灌后响应验证</h2>
          <p>本页回答：任务是否执行、有无证据、灌后水分是否改善、为什么当前只读。它不写入 Field Memory，不写 ROI，不创建任务。</p>
          <span className="operatorPill">只读验证投影</span>
        </div>
        <div className="operatorWorkbenchHeroActions">
          <Link className="operatorActionLink" to={fieldTwinPath(fieldId, "", scopeQueryString)}>工作区</Link>
          <Link className="operatorActionLink" to={fieldTwinPath(fieldId, "/forecast", scopeQueryString)}>预测</Link>
          <Link className="operatorActionLink" to={fieldTwinPath(fieldId, "/scenarios", scopeQueryString)}>情景</Link>
          <Link className="operatorActionLink" to={fieldTwinPath(fieldId, "/evidence", scopeQueryString)}>证据</Link>
          <Link className="operatorActionLink" to={fieldTwinPath(fieldId, "/calibration", scopeQueryString)}>校准回放</Link>
        </div>
      </div>
      {state === "loading" ? <div className="operatorPanel">灌后响应验证数据加载中...</div> : null}
      {state === "error" ? <div className="operatorPanel">灌后响应验证数据加载失败：{errorText}</div> : null}
      {verification ? (
        <div className="operatorPanelGrid">
          <PostIrrigationConclusionPanel closure={closure} />
          <ExecutionTailChainPanel verification={verification} closure={closure} />
          <PostIrrigationStateComparePanel pre={verification.pre_irrigation_state_v1} post={verification.post_irrigation_state_v1} />
          <ResponseDeltaPanel delta={verification.response_delta_v1} closure={closure} />
          <ExecutionEvidencePanel evidence={verification.execution_evidence_v1} />
          <ZoneResponseMatrixPanel matrix={verification.zone_response_matrix_v1} />
          <article className="operatorPanel">
            <p className="operatorEyebrow">验证摘要</p>
            <h3>后续写入候选说明</h3>
            <ul className="operatorList">
              <ValueLine label="验证状态" value={<span className="operatorPill">{statusText(closure?.response_summary?.status ?? verification.verification_summary.status)}</span>} />
              <ValueLine label="原因" value={statusText(verification.verification_summary.reason)} />
              <ValueLine label="Field Memory 候选" value={verification.verification_summary.field_memory_candidate ? "是，仅表示可作为候选；本页不写入。" : "否"} />
              <ValueLine label="ROI 候选" value={verification.verification_summary.roi_candidate ? "是，仅表示可作为候选；本页不写入。" : "否"} />
              <ValueLine label="写入开关" value={verification.verification_summary.write_ready ? "可写" : "关闭"} />
            </ul>
          </article>
          <VerificationGapList verification={verification} />
          <article className="operatorPanel operatorBoundaryNotice">
            <p className="operatorEyebrow">只读边界</p>
            <h3>本页不会执行的动作</h3>
            <ul className="operatorList">{verification.boundary_rules.map((rule) => <li key={rule.rule_code}>{rule.label}（{rule.rule_code}）</li>)}</ul>
          </article>
        </div>
      ) : null}
    </section>
  );
}
