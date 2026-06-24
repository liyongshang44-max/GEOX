// apps/web/src/features/operator/pages/OperatorFieldTwinWorkspacePage.tsx
// Purpose: render the API-backed field-centered Operator Twin workspace with explicit scope propagation.
// Boundary: this page separates Fact, Estimate, 预测, Scenario, Recommendation, and read-only downstream chain context; it does not execute actions.

import React from "react";
import { Link, useParams, useSearchParams } from "react-router-dom";
import {
  buildOperatorTwinScopeQuery,
  fetchOperatorFieldTwinWorkspace,
  type OperatorFieldTwinWorkspaceV1,
  type OperatorTwinLayer,
  type OperatorTwinRequestScope,
  type OperatorTwinScopePolicy,
} from "../../../api/operatorTwin";
import {
  fetchOperatorTwinH31H45Closure,
  normalizeOperatorTwinDemoFieldId,
  type OperatorTwinH31H45ClosureV1,
} from "../../../api/operatorTwinClosure";

type RuntimeState = "loading" | "ready" | "error";

type ChainStage = {
  code: string;
  label: string;
  status: string;
  evidence: string;
  href?: string;
};

function scopeFromSearchParams(searchParams: URLSearchParams): OperatorTwinRequestScope {
  return {
    tenant_id: searchParams.get("tenant_id"),
    project_id: searchParams.get("project_id"),
    group_id: searchParams.get("group_id"),
  };
}

function boolText(value: boolean): string {
  return value ? "是" : "否";
}

function emptyText(value: string | number | null | undefined): string {
  const raw = String(value ?? "").trim();
  return raw || "无";
}

function statusText(value: string | null | undefined): string {
  const raw = String(value ?? "").trim();
  if (!raw) return "无";
  const labels: Record<string, string> = {
    AVAILABLE: "可用",
    LIMITED: "受限",
    NOT_AVAILABLE: "不可用",
    MISSING_OR_LIMITED: "缺失或受限",
    EVIDENCE_LIMITED: "证据受限",
    LOW_CONFIDENCE: "低置信",
    CONFIDENCE_OK: "置信正常",
    INFO: "信息",
    WARNING: "警告",
    BLOCKING: "阻塞",
    RECOMMENDATION_CANDIDATE_PRESENT: "已有建议候选",
    NO_RECOMMENDATION_CANDIDATE: "暂无建议候选",
    DOWNSTREAM_BACKEND_CHAIN: "下游后端链路",
    DOWNSTREAM_EXECUTION_CHAIN: "下游执行链路",
    DOWNSTREAM_EVIDENCE_ACCEPTANCE_CHAIN: "下游证据与验收链路",
    POST_IRRIGATION_READ_SURFACE: "灌后只读验证面",
  };
  const label = labels[raw] ?? raw;
  return label === raw ? raw : label + "（" + raw + "）";
}

function layerLabel(value: string): string {
  const labels: Record<string, string> = {
    Fact: "事实",
    Estimate: "估计",
    Forecast: "预测",
    Scenario: "情景",
    Recommendation: "建议候选",
  };
  return (labels[value] ?? value) + "（" + value + "）";
}

function chainNodeLabel(stage: ChainStage): string {
  const labels: Record<string, string> = {
    H31: "土壤水势",
    H32: "根区水分状态",
    H33: "根区预测",
    H34: "灌溉情景比较",
    H35: "情景到建议候选",
    "H31-H35": "证据 / 状态 / 预测 / 情景 / 建议候选",
    "H36-H39": "审批请求 / 审批决策 / 作业计划 / 状态流转",
    "H40-H42": "AO-ACT 任务 / 回执 / 实执记录",
    "H43-H44": "执行证据 / 验收结果",
    H45: "水分响应验证",
  };
  const label = labels[stage.code] ?? stage.label;
  return label + "（" + stage.code + "）";
}

function evidenceText(value: string): string {
  const raw = emptyText(value);
  if (raw === "none") return "无";
  if (raw === "read-only closure evidence available") return "只读闭环证据可用";
  if (raw === "current_state.evidence_refs empty") return "当前状态未返回证据引用";
  if (raw === "not submitted from Operator Twin") return "尚未由操作员 Twin 提交";
  if (raw.includes("scenario options")) return raw.replace("scenario options", "个情景选项");
  if (raw === "no scenario option") return "没有情景选项";
  if (raw === "Read in downstream execution evidence after approval; this panel does not create approval or operation_plan facts.") return "审批后读取下游执行证据；本卡不创建 approval 或 operation_plan 事实。";
  if (raw === "Open post-irrigation verification to inspect task_id, receipt_id, and as_executed_id.") return "打开灌后验证页查看 task_id、receipt_id 和 as_executed_id。";
  if (raw === "Open evidence and post-irrigation verification to inspect evidence_refs and acceptance_result_id.") return "打开证据页和灌后验证页查看 evidence_refs 与 acceptance_result_id。";
  if (raw === "Open post-irrigation verification. This page does not write ROI or Field Memory.") return "打开灌后验证页；本页不写 ROI 或 Field Memory。";
  return raw;
}

function boundaryRuleText(label: string): string {
  return label
    .replace(/dispatch/g, "派单")
    .replace(/approval/g, "审批")
    .replace(/recommendation/g, "建议候选")
    .replace(/Scenario/g, "情景")
    .replace(/Task/g, "任务")
    .replace(/Fact/g, "事实")
    .replace(/Forecast/g, "预测");
}

function ScopePolicyCard({ policy }: { policy: OperatorTwinScopePolicy }): React.ReactElement {
  return (
    <article className="operatorPanel" data-card="operator-twin-scope-policy">
      <h3>作用域策略</h3>
      <p>作用域已应用：{boolText(policy.scope_applied)}</p>
      <p>缺失原因：{emptyText(policy.missing_reason)}</p>
      <p>已接受作用域键：{policy.accepted_scope_keys.join(", ")}</p>
      <p>必须指定地块作用域：{boolText(Boolean(policy.field_scope_required))}</p>
    </article>
  );
}

function StateVectorCard({ workspace }: { workspace: OperatorFieldTwinWorkspaceV1 }): React.ReactElement {
  return (
    <article className="operatorPanel" data-card="状态向量">
      <p className="operatorEyebrow">状态向量</p>
      <h3>状态向量</h3>
      <p>{workspace.current_state.state_text}</p>
      <p>风险：{workspace.current_state.risk_text}</p>
      <p>置信度：{workspace.current_state.confidence_text}</p>
      <p>低置信：{workspace.current_state.low_confidence ? "低置信（LOW_CONFIDENCE）" : "置信正常（CONFIDENCE_OK）"}</p>
      <p>分类：{layerLabel(workspace.current_state.classification)}</p>
    </article>
  );
}

function DataCoverageMatrix({ workspace }: { workspace: OperatorFieldTwinWorkspaceV1 }): React.ReactElement {
  return (
    <article className="operatorPanel" data-card="数据覆盖矩阵">
      <p className="operatorEyebrow">数据覆盖矩阵</p>
      <h3>数据覆盖矩阵</h3>
      <ul className="operatorList">
        <li>覆盖摘要：{workspace.data_coverage.coverage_text}</li>
        <li>土壤水分窗口：{workspace.data_coverage.sensing_available ? "可用（AVAILABLE）" : "缺失或受限（MISSING_OR_LIMITED）"}</li>
        <li>天气版本：{workspace.data_coverage.weather_available ? "可用（AVAILABLE）" : "缺失或受限（MISSING_OR_LIMITED）"}</li>
        <li>可用预测窗口：{workspace.forecast_window.available_horizon}</li>
        <li>未开放窗口：{workspace.forecast_window.unavailable_horizons.join("、") || "无"}</li>
        <li>限制原因：{workspace.forecast_window.reason}</li>
      </ul>
    </article>
  );
}

function EvidenceSummaryCard({ workspace }: { workspace: OperatorFieldTwinWorkspaceV1 }): React.ReactElement {
  const refs = [
    ...workspace.current_state.evidence_refs,
    ...workspace.data_coverage.evidence_refs,
    ...workspace.scenario_comparison.evidence_refs,
    ...workspace.recommendation_candidate.evidence_refs,
    ...workspace.layers.flatMap((layer) => layer.evidence_refs),
  ];

  const uniqueRefs = [...new Set(refs.filter(Boolean))];

  return (
    <article className="operatorPanel" data-card="证据摘要">
      <p className="operatorEyebrow">证据摘要</p>
      <h3>证据摘要</h3>
      {uniqueRefs.length === 0 ? <p>当前工作区未返回证据引用。</p> : null}
      <ul className="operatorList">
        {uniqueRefs.map((ref) => (
          <li key={ref}>{ref}</li>
        ))}
      </ul>
    </article>
  );
}

function DataGapSummaryCard({ workspace }: { workspace: OperatorFieldTwinWorkspaceV1 }): React.ReactElement {
  const hasDataGaps = workspace.data_gaps.length > 0;

  return (
    <article
      className="operatorPanel"
      data-card="数据缺口"
      data-gap-status={hasDataGaps ? "DATA_GAPS_PRESENT" : "NO_DATA_GAPS"}
    >
      <p className="operatorEyebrow">数据缺口</p>
      <h3>数据缺口</h3>
      {hasDataGaps ? null : <p>当前工作区未返回数据缺口。</p>}
      <ul className="operatorList">
        {workspace.data_gaps.map((gap, index) => (
          <li key={gap.gap_code || gap.label || String(index)}>
            {gap.label || gap.gap_code || "未命名缺口"}
            {gap.severity ? " · " + statusText(gap.severity) : ""}
          </li>
        ))}
      </ul>
    </article>
  );
}

function RecommendationCandidateCard({ workspace }: { workspace: OperatorFieldTwinWorkspaceV1 }): React.ReactElement {
  return (
    <article className="operatorPanel" data-card="建议候选详情">
      <p className="operatorEyebrow">建议候选详情</p>
      <h3>建议候选</h3>
      <p>建议 ID：{workspace.recommendation_candidate.recommendation_id ?? "待确认"}</p>
      <p>动作类型：{workspace.recommendation_candidate.action_type ?? "待确认"}</p>
      <p>数量：{workspace.recommendation_candidate.amount_mm ?? "待确认"}</p>
      <p>必须人工审批：{workspace.recommendation_candidate.human_approval_required ? "是" : "否"}</p>
      <p>禁止直接执行：{workspace.recommendation_candidate.no_direct_execution ? "是" : "否"}</p>
    </article>
  );
}

function LayerCard({ layer }: { layer: OperatorTwinLayer }): React.ReactElement {
  return (
    <article className="operatorPanel" data-layer={layer.layer}>
      <p className="operatorEyebrow">{layerLabel(layer.layer)}</p>
      <h3>{layer.title}</h3>
      <p>{layer.body}</p>
      <p>状态：{statusText(layer.status)}</p>
    </article>
  );
}

function ScenarioBoundaryCard({ workspace }: { workspace: OperatorFieldTwinWorkspaceV1 }): React.ReactElement {
  return (
    <article className="operatorPanel" data-card="ScenarioBoundaryCard">
      <h3>情景比较边界</h3>
      <p>状态：{statusText(workspace.scenario_comparison.status)}</p>
      <p>不可用原因：{emptyText(workspace.scenario_comparison.unavailable_reason)}</p>
      <p>无动作基线：{workspace.scenario_comparison.no_action_baseline_present ? "存在" : "缺失"}</p>
      <ul className="operatorList">
        {workspace.scenario_comparison.options.map((option) => (
          <li key={option.option_id || option.label}>
            {option.label || option.option_id}
            {option.risk_delta ? " · " + option.risk_delta : ""}
          </li>
        ))}
      </ul>
      <p>情景不能当作任务；本页只读，不提交建议候选。</p>
    </article>
  );
}

function ReadOnlyBoundaryCard({ workspace }: { workspace: OperatorFieldTwinWorkspaceV1 }): React.ReactElement {
  return (
    <article className="operatorPanel" data-card="ReadOnlyBoundaryCard">
      <h3>只读动作边界</h3>
      <ul className="operatorList">
        {workspace.boundary_rules.map((rule) => (
          <li key={rule.rule_code}>{boundaryRuleText(rule.label)}</li>
        ))}
      </ul>
    </article>
  );
}

function chainHref(fieldId: string, suffix: string, scopeQueryString: string): string {
  return "/operator/twin/fields/" + encodeURIComponent(fieldId) + suffix + scopeQueryString;
}

function stageHref(code: string, fieldId: string, scopeQueryString: string): string | undefined {
  if (code === "H31-H35") return chainHref(fieldId, "/scenarios", scopeQueryString);
  if (code === "H40-H42") return chainHref(fieldId, "/post-irrigation", scopeQueryString);
  if (code === "H43-H44") return chainHref(fieldId, "/evidence", scopeQueryString);
  if (code === "H45") return chainHref(fieldId, "/post-irrigation", scopeQueryString);
  return undefined;
}

function buildDecisionChainStages(
  workspace: OperatorFieldTwinWorkspaceV1,
  fieldId: string,
  scopeQueryString: string,
  closure: OperatorTwinH31H45ClosureV1 | null,
): ChainStage[] {
  if (closure?.stage_groups?.length) {
    return closure.stage_groups.map((stage) => ({
      code: stage.code,
      label: stage.label,
      status: stage.status,
      evidence: stage.summary_text || stage.evidence_refs.join(", ") || "read-only closure evidence available",
      href: stageHref(stage.code, fieldId, scopeQueryString),
    }));
  }

  const scenarioCount = workspace.scenario_comparison.options.length;
  const recommendationId = workspace.recommendation_candidate.recommendation_id;

  return [
    { code: "H31", label: "Soil Water Potential", status: workspace.current_state.evidence_refs.length > 0 ? "AVAILABLE" : "EVIDENCE_LIMITED", evidence: workspace.current_state.evidence_refs.join(", ") || "current_state.evidence_refs empty" },
    { code: "H32", label: "Root-Zone Soil Water State", status: workspace.current_state.low_confidence ? "LOW_CONFIDENCE" : "AVAILABLE", evidence: workspace.current_state.state_text },
    { code: "H33", label: "Root-Zone 预测", status: workspace.forecast_window.forecast_horizon_limited ? "LIMITED" : "AVAILABLE", evidence: workspace.forecast_window.available_horizon + " · " + workspace.forecast_window.reason, href: chainHref(fieldId, "/forecast", scopeQueryString) },
    { code: "H34", label: "Irrigation Scenario Comparison", status: workspace.scenario_comparison.status, evidence: scenarioCount > 0 ? `${scenarioCount} scenario options` : (workspace.scenario_comparison.unavailable_reason ?? "no scenario option"), href: chainHref(fieldId, "/scenarios", scopeQueryString) },
    { code: "H35", label: "Scenario Option To Recommendation Candidate", status: recommendationId ? "RECOMMENDATION_CANDIDATE_PRESENT" : "NO_RECOMMENDATION_CANDIDATE", evidence: recommendationId ?? "not submitted from Operator Twin", href: chainHref(fieldId, "/scenarios", scopeQueryString) },
    { code: "H36-H39", label: "Approval Request / Decision / Operation Plan / Transition", status: "DOWNSTREAM_BACKEND_CHAIN", evidence: "Read in downstream execution evidence after approval; this panel does not create approval or operation_plan facts." },
    { code: "H40-H42", label: "AO-ACT Task / Receipt / As-Executed Record", status: "DOWNSTREAM_EXECUTION_CHAIN", evidence: "Open post-irrigation verification to inspect task_id, receipt_id, and as_executed_id.", href: chainHref(fieldId, "/post-irrigation", scopeQueryString) },
    { code: "H43-H44", label: "证据 Artifact / Acceptance Result", status: "DOWNSTREAM_EVIDENCE_ACCEPTANCE_CHAIN", evidence: "Open evidence and post-irrigation verification to inspect evidence_refs and acceptance_result_id.", href: chainHref(fieldId, "/evidence", scopeQueryString) },
    { code: "H45", label: "Water Response Verification", status: "POST_IRRIGATION_READ_SURFACE", evidence: "Open post-irrigation verification. This page does not write ROI or Field Memory.", href: chainHref(fieldId, "/post-irrigation", scopeQueryString) },
  ];
}

function DecisionToWaterResponseChainCard({ workspace, fieldId, scopeQueryString, closure }: { workspace: OperatorFieldTwinWorkspaceV1; fieldId: string; scopeQueryString: string; closure: OperatorTwinH31H45ClosureV1 | null }): React.ReactElement {
  const stages = buildDecisionChainStages(workspace, fieldId, scopeQueryString, closure);

  return (
    <article className="operatorPanel" data-card="DecisionToWaterResponseChainCard" data-contract="h31_h45_read_only_chain_v1">
      <p className="operatorEyebrow">H31-H45 决策到水分响应闭环</p>
      <h3>决策到水分响应闭环</h3>
      <p>本卡只串联已成立的后端读面，不审批、不派单、不创建 AO-ACT task、不写 ROI、不写 Field Memory。</p>
      <div className="operatorTableWrap">
        <table className="operatorTable" data-table="h31-h45-decision-chain">
          <thead><tr><th>阶段</th><th>链路节点</th><th>只读状态</th><th>证据 / 入口</th></tr></thead>
          <tbody>{stages.map((stage) => <tr key={stage.code} data-stage={stage.code.toLowerCase()}><td>{stage.code}</td><td>{chainNodeLabel(stage)}</td><td><span className="operatorPill">{statusText(stage.status)}</span></td><td>{stage.href ? <Link to={stage.href}>{evidenceText(stage.evidence)}</Link> : evidenceText(stage.evidence)}</td></tr>)}</tbody>
        </table>
      </div>
    </article>
  );
}

export default function OperatorFieldTwinWorkspacePage(): React.ReactElement {
  const params = useParams();
  const [searchParams] = useSearchParams();
  const scope = React.useMemo(() => scopeFromSearchParams(searchParams), [searchParams]);
  const scopeQueryString = React.useMemo(() => buildOperatorTwinScopeQuery(scope), [scope]);
  const fieldId = normalizeOperatorTwinDemoFieldId(params.fieldId);
  const [state, setState] = React.useState<RuntimeState>("loading");
  const [workspace, setWorkspace] = React.useState<OperatorFieldTwinWorkspaceV1 | null>(null);
  const [closure, setClosure] = React.useState<OperatorTwinH31H45ClosureV1 | null>(null);
  const [errorText, setErrorText] = React.useState("");

  React.useEffect(() => {
    let alive = true;
    setState("loading");
    setWorkspace(null);
    setClosure(null);
    setErrorText("");

    void Promise.all([fetchOperatorFieldTwinWorkspace(fieldId, scope), fetchOperatorTwinH31H45Closure(fieldId, scope)])
      .then(([workspaceResponse, closureResponse]) => {
        if (!alive) return;
        setWorkspace(workspaceResponse.operator_field_twin_workspace_v1);
        setClosure(closureResponse.operator_twin_h31_h45_closure_v1);
        setState("ready");
      })
      .catch((error: unknown) => {
        if (!alive) return;
        setWorkspace(null);
        setClosure(null);
        setErrorText(error instanceof Error ? error.message : "OPERATOR_FIELD_TWIN_WORKSPACE_LOAD_FAILED");
        setState("error");
      });

    return () => { alive = false; };
  }, [fieldId, scope]);

  return (
    <section className="operatorWorkbenchPage" data-surface="operator-twin" data-page="operator-field-twin-workspace" data-contract="operator_field_twin_workspace_v1">
      <div className="operatorWorkbenchHero">
        <div>
          <p className="operatorEyebrow">地块中心工作区</p>
          <h2>地块 Twin 工作区</h2>
          <p>当前地块：<strong>{workspace?.field_context.field_name ?? fieldId}</strong>。本页以 field_id 为入口，operation_id 不作为入口；并按事实、估计、预测、情景、建议候选和执行后验证分层展示。</p>
        </div>
        <div className="operatorWorkbenchHeroActions">
          <Link className="operatorActionLink" to={chainHref(fieldId, "", scopeQueryString)}>工作区</Link>
          <Link className="operatorActionLink" to={chainHref(fieldId, "/forecast", scopeQueryString)}>预测</Link>
          <Link className="operatorActionLink" to={chainHref(fieldId, "/scenarios", scopeQueryString)}>情景</Link>
          <Link className="operatorActionLink" to={chainHref(fieldId, "/evidence", scopeQueryString)}>证据</Link>
          <Link className="operatorActionLink" to={chainHref(fieldId, "/post-irrigation", scopeQueryString)}>灌后验证</Link>
          <Link className="operatorActionLink" to={"/operator/twin" + scopeQueryString}>返回 Twin 总览</Link>
        </div>
      </div>

      {state === "loading" ? <div className="operatorPanel">地块 Twin 数据加载中...</div> : null}
      {state === "error" ? <div className="operatorPanel">地块 Twin 数据加载失败：{errorText}</div> : null}

      {workspace ? (
        <div className="operatorPanelGrid">
          <ScopePolicyCard policy={workspace.scope_policy} />
          <StateVectorCard workspace={workspace} />
          <DataCoverageMatrix workspace={workspace} />
          <EvidenceSummaryCard workspace={workspace} />
          <DataGapSummaryCard workspace={workspace} />
          {workspace.layers.map((layer) => <LayerCard key={layer.layer} layer={layer} />)}
          <ScenarioBoundaryCard workspace={workspace} />
          <RecommendationCandidateCard workspace={workspace} />
          <DecisionToWaterResponseChainCard workspace={workspace} fieldId={fieldId} scopeQueryString={scopeQueryString} closure={closure} />
          <ReadOnlyBoundaryCard workspace={workspace} />
        </div>
      ) : null}
    </section>
  );
}
