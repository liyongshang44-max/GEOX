// apps/web/src/features/operator/pages/OperatorFieldTwinWorkspacePage.tsx
// Purpose: render the API-backed field-centered Operator Twin workspace with explicit scope propagation.
// Boundary: this page separates Fact, Estimate, Forecast, Scenario, and Recommendation; it does not execute actions.

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

type RuntimeState = "loading" | "ready" | "error";

function scopeFromSearchParams(searchParams: URLSearchParams): OperatorTwinRequestScope {
  return {
    tenant_id: searchParams.get("tenant_id"),
    project_id: searchParams.get("project_id"),
    group_id: searchParams.get("group_id"),
  };
}

function ScopePolicyCard({ policy }: { policy: OperatorTwinScopePolicy }): React.ReactElement {
  return (
    <article className="customerCard" data-card="operator-twin-scope-policy">
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
    <article className="customerCard" data-card="TwinStateVectorCard">
      <p className="customerEyebrow">TwinStateVectorCard</p>
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
    <article className="customerCard" data-card="DataCoverageMatrix">
      <p className="customerEyebrow">DataCoverageMatrix</p>
      <h3>数据覆盖矩阵</h3>
      <ul className="customerList">
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
    <article className="customerCard" data-card="EvidenceSummary">
      <p className="customerEyebrow">EvidenceSummary</p>
      <h3>证据摘要</h3>
      {uniqueRefs.length === 0 ? <p>当前 workspace 未返回 evidence_refs。</p> : null}
      <ul className="customerList">
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
      className="customerCard"
      data-card="DataGapSummary"
      data-gap-status={hasDataGaps ? "DATA_GAPS_PRESENT" : "NO_DATA_GAPS"}
    >
      <p className="customerEyebrow">DataGapSummary</p>
      <h3>数据缺口</h3>
      {hasDataGaps ? null : <p>当前 workspace 未返回数据缺口。</p>}
      <ul className="customerList">
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
    <article className="customerCard" data-card="RecommendationCandidate">
      <p className="customerEyebrow">RecommendationCandidate</p>
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
    <article className="customerCard" data-layer={layer.layer}>
      <p className="customerEyebrow">{layer.layer}</p>
      <h3>{layer.title}</h3>
      <p>{layer.body}</p>
      <p>状态：{layer.status}</p>
    </article>
  );
}

function ScenarioBoundaryCard({ workspace }: { workspace: OperatorFieldTwinWorkspaceV1 }): React.ReactElement {
  return (
    <article className="customerCard" data-card="ScenarioBoundaryCard">
      <h3>情景比较边界</h3>
      <p>状态：{workspace.scenario_comparison.status}</p>
      <p>不可用原因：{workspace.scenario_comparison.unavailable_reason ?? "none"}</p>
      <p>no_action baseline：{workspace.scenario_comparison.no_action_baseline_present ? "存在" : "缺失"}</p>
      <ul className="customerList">
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
    <article className="customerCard" data-card="ReadOnlyBoundaryCard">
      <h3>只读动作边界</h3>
      <ul className="customerList">
        {workspace.boundary_rules.map((rule) => (
          <li key={rule.rule_code}>{rule.label}</li>
        ))}
      </ul>
    </article>
  );
}

export default function OperatorFieldTwinWorkspacePage(): React.ReactElement {
  const params = useParams();
  const [searchParams] = useSearchParams();
  const scope = React.useMemo(() => scopeFromSearchParams(searchParams), [searchParams]);
  const scopeQueryString = React.useMemo(() => buildOperatorTwinScopeQuery(scope), [scope]);
  const fieldId = String(params.fieldId ?? "").trim() || "field_c8_demo";
  const [state, setState] = React.useState<RuntimeState>("loading");
  const [workspace, setWorkspace] = React.useState<OperatorFieldTwinWorkspaceV1 | null>(null);
  const [errorText, setErrorText] = React.useState("");

  React.useEffect(() => {
    let alive = true;
    setState("loading");
    setWorkspace(null);
    setErrorText("");

    void fetchOperatorFieldTwinWorkspace(fieldId, scope)
      .then((response) => {
        if (!alive) return;
        setWorkspace(response.operator_field_twin_workspace_v1);
        setState("ready");
      })
      .catch((error: unknown) => {
        if (!alive) return;
        setWorkspace(null);
        setErrorText(error instanceof Error ? error.message : "OPERATOR_FIELD_TWIN_WORKSPACE_LOAD_FAILED");
        setState("error");
      });

    return () => {
      alive = false;
    };
  }, [fieldId, scope]);

  return (
    <section
      className="customerReportPage"
      data-surface="operator-twin"
      data-page="operator-field-twin-workspace"
      data-contract="operator_field_twin_workspace_v1"
    >
      <div className="customerReportHero">
        <div>
          <p className="customerEyebrow">Field-centered workspace</p>
          <h2>地块 Twin 工作区</h2>
          <p>
            当前地块：<strong>{workspace?.field_context.field_name ?? fieldId}</strong>。
            本页以 field_id 为入口，operation_id 不作为入口；并按事实、估计、预测、情景和建议候选分层展示。
          </p>
        </div>
        <div className="customerReportHeroActions">
          <Link className="customerSecondaryButton" to={"/operator/twin" + scopeQueryString}>返回 Twin 总览</Link>
        </div>
      </div>

      {state === "loading" ? <div className="customerCard">Field Twin 数据加载中...</div> : null}
      {state === "error" ? <div className="customerCard">Field Twin 数据加载失败：{errorText}</div> : null}

      {workspace ? (
        <div className="customerSectionGrid">
          <ScopePolicyCard policy={workspace.scope_policy} />
          <TwinStateVectorCard workspace={workspace} />
          <DataCoverageMatrix workspace={workspace} />
          <EvidenceSummary workspace={workspace} />
          <DataGapSummary workspace={workspace} />

          {workspace.layers.map((layer) => (
            <LayerCard key={layer.layer} layer={layer} />
          ))}

          <ScenarioBoundaryCard workspace={workspace} />
          <RecommendationCandidate workspace={workspace} />
          <ReadOnlyBoundaryCard workspace={workspace} />
        </div>
      ) : null}
    </section>
  );
}
