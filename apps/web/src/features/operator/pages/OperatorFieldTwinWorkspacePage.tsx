// apps/web/src/features/operator/pages/OperatorFieldTwinWorkspacePage.tsx
// Purpose: render the API-backed field-centered Operator Twin workspace with explicit scope propagation.
// Boundary: this page separates Fact, Estimate, Forecast, Scenario, and Recommendation; it does not execute actions.

import React from "react";
import { Link, useParams, useSearchParams } from "react-router-dom";
import {
  buildOperatorTwinScopeQuery,
  fetchOperatorFieldTwinWorkspace,
  type OperatorFieldTwinWorkspaceV1,
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
    <section className="customerReportPage" data-surface="operator-twin" data-page="operator-field-twin-workspace">
      <div className="customerReportHero">
        <div>
          <p className="customerEyebrow">Field Twin Workspace</p>
          <h2>地块 Twin 工作区</h2>
          <p>
            当前地块：<strong>{workspace?.field_context.field_name ?? fieldId}</strong>。
            本页保留 tenant_id / project_id / group_id 查询范围，并按事实、估计、预测、情景和建议候选分层展示。
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

          <article className="customerCard">
            <h3>当前状态</h3>
            <p>{workspace.current_state.state_text}</p>
            <p>置信度：{workspace.current_state.confidence_text}</p>
            <p>分类：{workspace.current_state.classification}</p>
          </article>

          <article className="customerCard">
            <h3>数据覆盖</h3>
            <p>{workspace.data_coverage.coverage_text}</p>
            <p>土壤水分窗口：{workspace.data_coverage.sensing_available ? "可用" : "待确认"}</p>
            <p>天气版本：{workspace.data_coverage.weather_available ? "可用" : "待确认"}</p>
          </article>

          <article className="customerCard">
            <h3>预测窗口</h3>
            <p>可用窗口：{workspace.forecast_window.available_horizon}</p>
            <p>长周期限制：{workspace.forecast_window.forecast_horizon_limited ? "是" : "否"}</p>
            <p>未开放窗口：{workspace.forecast_window.unavailable_horizons.join("、")}</p>
          </article>

          {workspace.layers.map((item) => (
            <article className="customerCard" key={item.layer} data-layer={item.layer}>
              <p className="customerEyebrow">{item.layer}</p>
              <h3>{item.title}</h3>
              <p>{item.body}</p>
              <p>状态：{item.status}</p>
            </article>
          ))}

          <article className="customerCard">
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
          </article>

          <article className="customerCard">
            <h3>建议候选</h3>
            <p>建议 ID：{workspace.recommendation_candidate.recommendation_id ?? "待确认"}</p>
            <p>动作类型：{workspace.recommendation_candidate.action_type ?? "待确认"}</p>
            <p>数量：{workspace.recommendation_candidate.amount_mm ?? "待确认"}</p>
            <p>必须人工审批：{workspace.recommendation_candidate.human_approval_required ? "是" : "否"}</p>
            <p>禁止直接执行：{workspace.recommendation_candidate.no_direct_execution ? "是" : "否"}</p>
          </article>

          <article className="customerCard">
            <h3>只读动作边界</h3>
            <ul className="customerList">
              {workspace.boundary_rules.map((rule) => (
                <li key={rule.rule_code}>{rule.label}</li>
              ))}
            </ul>
          </article>
        </div>
      ) : null}
    </section>
  );
}
