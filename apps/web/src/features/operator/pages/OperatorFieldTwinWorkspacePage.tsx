// apps/web/src/features/operator/pages/OperatorFieldTwinWorkspacePage.tsx
// Purpose: render the API-backed field-centered Operator Twin workspace with explicit scope propagation.
// Boundary: this page separates Fact, Estimate, Forecast, Scenario, Recommendation, and read-only downstream chain context; it does not execute actions.

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

function ScopePolicyCard({ policy }: { policy: OperatorTwinScopePolicy }): React.ReactElement {
  return (
    <article className="operatorPanel" data-card="operator-twin-scope-policy">
      <h3>Scope Policy</h3>
      <p>scope_applied：{policy.scope_applied ? "true" : "false"}</p>
      <p>missing_reason：{policy.missing_reason ?? "none"}</p>
      <p>accepted_scope_keys：{policy.accepted_scope_keys.join(", ")}</p>
      <p>field_scope_required：{policy.field_scope_required ? "true" : "false"}</p>
    </article>
  );
}

function TwinStateVectorCard({ workspace }: { workspace: OperatorFieldTwinWorkspaceV1 }): React.ReactElement {
  return (
    <article className="operatorPanel" data-card="TwinStateVectorCard">
      <p className="operatorEyebrow">TwinStateVectorCard</p>
      <h3>状态向量</h3>
      <p>{workspace.current_state.state_text}</p>
      <p>风险：{workspace.current_state.risk_text}</p>
      <p>置信度：{workspace.current_state.confidence_text}</p>
      <p>低置信：{workspace.current_state.low_confidence ? "LOW_CONFIDENCE" : "CONFIDENCE_OK"}</p>
      <p>分类：{workspace.current_state.classification}</p>
    </article>
  );
}

function DataCoverageMatrix({ workspace }: { workspace: OperatorFieldTwinWorkspaceV1 }): React.ReactElement {
  return (
    <article className="operatorPanel" data-card="DataCoverageMatrix">
      <p className="operatorEyebrow">DataCoverageMatrix</p>
      <h3>数据覆盖矩阵</h3>
      <ul className="operatorList">
        <li>覆盖摘要：{workspace.data_coverage.coverage_text}</li>
        <li>土壤水分窗口：{workspace.data_coverage.sensing_available ? "AVAILABLE" : "MISSING_OR_LIMITED"}</li>
        <li>天气版本：{workspace.data_coverage.weather_available ? "AVAILABLE" : "MISSING_OR_LIMITED"}</li>
        <li>可用预测窗口：{workspace.forecast_window.available_horizon}</li>
        <li>未开放窗口：{workspace.forecast_window.unavailable_horizons.join("、") || "none"}</li>
        <li>限制原因：{workspace.forecast_window.reason}</li>
      </ul>
    </article>
  );
}

function EvidenceSummary({ workspace }: { workspace: OperatorFieldTwinWorkspaceV1 }): React.ReactElement {
  const refs = [
    ...workspace.current_state.evidence_refs,
    ...workspace.data_coverage.evidence_refs,
    ...workspace.scenario_comparison.evidence_refs,
    ...workspace.recommendation_candidate.evidence_refs,
    ...workspace.layers.flatMap((layer) => layer.evidence_refs),
  ];

  const uniqueRefs = [...new Set(refs.filter(Boolean))];

  return (
    <article className="operatorPanel" data-card="EvidenceSummary">
      <p className="operatorEyebrow">EvidenceSummary</p>
      <h3>证据摘要</h3>
      {uniqueRefs.length === 0 ? <p>当前 workspace 未返回 evidence_refs。</p> : null}
      <ul className="operatorList">
        {uniqueRefs.map((ref) => (
          <li key={ref}>{ref}</li>
        ))}
      </ul>
    </article>
  );
}

function DataGapSummary({ workspace }: { workspace: OperatorFieldTwinWorkspaceV1 }): React.ReactElement {
  const hasDataGaps = workspace.data_gaps.length > 0;

  return (
    <article
      className="operatorPanel"
      data-card="DataGapSummary"
      data-gap-status={hasDataGaps ? "DATA_GAPS_PRESENT" : "NO_DATA_GAPS"}
    >
      <p className="operatorEyebrow">DataGapSummary</p>
      <h3>数据缺口</h3>
      {hasDataGaps ? null : <p>当前 workspace 未返回数据缺口。</p>}
      <ul className="operatorList">
        {workspace.data_gaps.map((gap, index) => (
          <li key={gap.gap_code || gap.label || String(index)}>
            {gap.label || gap.gap_code || "未命名缺口"}
            {gap.severity ? " · " + gap.severity : ""}
          </li>
        ))}
      </ul>
    </article>
  );
}

function RecommendationCandidate({ workspace }: { workspace: OperatorFieldTwinWorkspaceV1 }): React.ReactElement {
  return (
    <article className="operatorPanel" data-card="RecommendationCandidate">
      <p className="operatorEyebrow">RecommendationCandidate</p>
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
      <p className="operatorEyebrow">{layer.layer}</p>
      <h3>{layer.title}</h3>
      <p>{layer.body}</p>
      <p>状态：{layer.status}</p>
    </article>
  );
}

function ScenarioBoundaryCard({ workspace }: { workspace: OperatorFieldTwinWorkspaceV1 }): React.ReactElement {
  return (
    <article className="operatorPanel" data-card="ScenarioBoundaryCard">
      <h3>情景比较边界</h3>
      <p>状态：{workspace.scenario_comparison.status}</p>
      <p>不可用原因：{workspace.scenario_comparison.unavailable_reason ?? "none"}</p>
      <p>no_action baseline：{workspace.scenario_comparison.no_action_baseline_present ? "存在" : "缺失"}</p>
      <ul className="operatorList">
        {workspace.scenario_comparison.options.map((option) => (
          <li key={option.option_id || option.label}>
            {option.label || option.option_id}
            {option.risk_delta ? " · " + option.risk_delta : ""}
          </li>
        ))}
      </ul>
      <p>Scenario 不能当作 Task；本页只读，不提交 recommendation。</p>
    </article>
  );
}

function ReadOnlyBoundaryCard({ workspace }: { workspace: OperatorFieldTwinWorkspaceV1 }): React.ReactElement {
  return (
    <article className="operatorPanel" data-card="ReadOnlyBoundaryCard">
      <h3>只读动作边界</h3>
      <ul className="operatorList">
        {workspace.boundary_rules.map((rule) => (
          <li key={rule.rule_code}>{rule.label}</li>
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
    { code: "H33", label: "Root-Zone Forecast", status: workspace.forecast_window.forecast_horizon_limited ? "LIMITED" : "AVAILABLE", evidence: workspace.forecast_window.available_horizon + " · " + workspace.forecast_window.reason, href: chainHref(fieldId, "/forecast", scopeQueryString) },
    { code: "H34", label: "Irrigation Scenario Comparison", status: workspace.scenario_comparison.status, evidence: scenarioCount > 0 ? `${scenarioCount} scenario options` : (workspace.scenario_comparison.unavailable_reason ?? "no scenario option"), href: chainHref(fieldId, "/scenarios", scopeQueryString) },
    { code: "H35", label: "Scenario Option To Recommendation Candidate", status: recommendationId ? "RECOMMENDATION_CANDIDATE_PRESENT" : "NO_RECOMMENDATION_CANDIDATE", evidence: recommendationId ?? "not submitted from Operator Twin", href: chainHref(fieldId, "/scenarios", scopeQueryString) },
    { code: "H36-H39", label: "Approval Request / Decision / Operation Plan / Transition", status: "DOWNSTREAM_BACKEND_CHAIN", evidence: "Read in downstream execution evidence after approval; this panel does not create approval or operation_plan facts." },
    { code: "H40-H42", label: "AO-ACT Task / Receipt / As-Executed Record", status: "DOWNSTREAM_EXECUTION_CHAIN", evidence: "Open post-irrigation verification to inspect task_id, receipt_id, and as_executed_id.", href: chainHref(fieldId, "/post-irrigation", scopeQueryString) },
    { code: "H43-H44", label: "Evidence Artifact / Acceptance Result", status: "DOWNSTREAM_EVIDENCE_ACCEPTANCE_CHAIN", evidence: "Open evidence and post-irrigation verification to inspect evidence_refs and acceptance_result_id.", href: chainHref(fieldId, "/evidence", scopeQueryString) },
    { code: "H45", label: "Water Response Verification", status: "POST_IRRIGATION_READ_SURFACE", evidence: "Open post-irrigation verification. This page does not write ROI or Field Memory.", href: chainHref(fieldId, "/post-irrigation", scopeQueryString) },
  ];
}

function DecisionToWaterResponseChainCard({ workspace, fieldId, scopeQueryString, closure }: { workspace: OperatorFieldTwinWorkspaceV1; fieldId: string; scopeQueryString: string; closure: OperatorTwinH31H45ClosureV1 | null }): React.ReactElement {
  const stages = buildDecisionChainStages(workspace, fieldId, scopeQueryString, closure);

  return (
    <article className="operatorPanel" data-card="DecisionToWaterResponseChainCard" data-contract="h31_h45_read_only_chain_v1">
      <p className="operatorEyebrow">H31-H45 Decision-to-Water-Response</p>
      <h3>决策到水分响应闭环</h3>
      <p>本卡只串联已成立的后端读面，不审批、不派单、不创建 AO-ACT task、不写 ROI、不写 Field Memory。</p>
      <div className="operatorTableWrap">
        <table className="operatorTable" data-table="h31-h45-decision-chain">
          <thead><tr><th>阶段</th><th>链路节点</th><th>只读状态</th><th>证据 / 入口</th></tr></thead>
          <tbody>{stages.map((stage) => <tr key={stage.code} data-stage={stage.code.toLowerCase()}><td>{stage.code}</td><td>{stage.label}</td><td><span className="operatorPill">{stage.status}</span></td><td>{stage.href ? <Link to={stage.href}>{stage.evidence}</Link> : stage.evidence}</td></tr>)}</tbody>
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
          <p className="operatorEyebrow">Field-centered workspace</p>
          <h2>地块 Twin 工作区</h2>
          <p>当前地块：<strong>{workspace?.field_context.field_name ?? fieldId}</strong>。本页以 field_id 为入口，operation_id 不作为入口；并按事实、估计、预测、情景、建议候选和执行后验证分层展示。</p>
        </div>
        <div className="operatorWorkbenchHeroActions">
          <Link className="operatorActionLink" to={chainHref(fieldId, "", scopeQueryString)}>Workspace</Link>
          <Link className="operatorActionLink" to={chainHref(fieldId, "/forecast", scopeQueryString)}>Forecast</Link>
          <Link className="operatorActionLink" to={chainHref(fieldId, "/scenarios", scopeQueryString)}>Scenarios</Link>
          <Link className="operatorActionLink" to={chainHref(fieldId, "/evidence", scopeQueryString)}>Evidence</Link>
          <Link className="operatorActionLink" to={chainHref(fieldId, "/post-irrigation", scopeQueryString)}>Post-Irrigation</Link>
          <Link className="operatorActionLink" to={"/operator/twin" + scopeQueryString}>返回 Twin 总览</Link>
        </div>
      </div>

      {state === "loading" ? <div className="operatorPanel">Field Twin 数据加载中...</div> : null}
      {state === "error" ? <div className="operatorPanel">Field Twin 数据加载失败：{errorText}</div> : null}

      {workspace ? (
        <div className="operatorPanelGrid">
          <ScopePolicyCard policy={workspace.scope_policy} />
          <TwinStateVectorCard workspace={workspace} />
          <DataCoverageMatrix workspace={workspace} />
          <EvidenceSummary workspace={workspace} />
          <DataGapSummary workspace={workspace} />
          {workspace.layers.map((layer) => <LayerCard key={layer.layer} layer={layer} />)}
          <ScenarioBoundaryCard workspace={workspace} />
          <RecommendationCandidate workspace={workspace} />
          <DecisionToWaterResponseChainCard workspace={workspace} fieldId={fieldId} scopeQueryString={scopeQueryString} closure={closure} />
          <ReadOnlyBoundaryCard workspace={workspace} />
        </div>
      ) : null}
    </section>
  );
}
