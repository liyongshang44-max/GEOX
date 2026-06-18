// apps/web/src/features/operator/pages/OperatorTwinOverviewPage.tsx
// Purpose: render the API-backed read-only Operator Twin overview with explicit scope propagation.
// Boundary: this page does not run forecasts, submit recommendations, approve, dispatch, or create AO-ACT tasks.

import React from "react";
import { Link, useSearchParams } from "react-router-dom";
import {
  buildOperatorTwinScopeQuery,
  fetchOperatorTwinOverview,
  type OperatorTwinOverviewV1,
  type OperatorTwinRequestScope,
  type OperatorTwinScopePolicy,
} from "../../../api/operatorTwin";

type RuntimeState = "loading" | "ready" | "empty" | "error";

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
    </article>
  );
}

export default function OperatorTwinOverviewPage(): React.ReactElement {
  const [searchParams] = useSearchParams();
  const scope = React.useMemo(() => scopeFromSearchParams(searchParams), [searchParams]);
  const scopeQueryString = React.useMemo(() => buildOperatorTwinScopeQuery(scope), [scope]);
  const [state, setState] = React.useState<RuntimeState>("loading");
  const [overview, setOverview] = React.useState<OperatorTwinOverviewV1 | null>(null);
  const [errorText, setErrorText] = React.useState("");

  React.useEffect(() => {
    let alive = true;
    setState("loading");
    setErrorText("");
    setOverview(null);

    void fetchOperatorTwinOverview(scope)
      .then((response) => {
        if (!alive) return;
        const nextOverview = response.operator_twin_overview_v1;
        setOverview(nextOverview);
        setState(nextOverview.fields.length > 0 ? "ready" : "empty");
      })
      .catch((error: unknown) => {
        if (!alive) return;
        setOverview(null);
        setErrorText(error instanceof Error ? error.message : "OPERATOR_TWIN_OVERVIEW_LOAD_FAILED");
        setState("error");
      });

    return () => {
      alive = false;
    };
  }, [scope]);

  return (
    <section className="customerReportPage" data-surface="operator-twin" data-page="operator-twin-overview">
      <div className="customerReportHero">
        <div>
          <p className="customerEyebrow">Operator Twin Workbench</p>
          <h2>田块预测与情景推演入口</h2>
          <p>
            该页面读取 operator_twin_overview_v1，并把 tenant_id / project_id / group_id 作为只读查询范围传给后端。
            当前版本不运行预测、不提交 recommendation、不审批、不执行。
          </p>
        </div>
        <div className="customerReportHeroActions">
          <span className="customerStatusPill">API-backed</span>
          <span className="customerStatusPill">Scoped read</span>
          <span className="customerStatusPill">No direct execution</span>
        </div>
      </div>

      {state === "loading" ? <div className="customerCard">Operator Twin 数据加载中...</div> : null}
      {state === "error" ? <div className="customerCard">Operator Twin 数据加载失败：{errorText}</div> : null}
      {state === "empty" ? <div className="customerCard">暂无可展示田块 Twin 数据。请确认 URL 中的 tenant_id / project_id / group_id。</div> : null}

      {overview ? (
        <div className="customerSectionGrid">
          <ScopePolicyCard policy={overview.scope_policy} />

          <article className="customerCard">
            <h3>田块状态矩阵</h3>
            <div className="customerTableWrap">
              <table className="customerTable">
                <thead>
                  <tr>
                    <th>田块</th>
                    <th>当前状态</th>
                    <th>置信度</th>
                    <th>数据覆盖</th>
                    <th>预测窗口</th>
                    <th>入口</th>
                  </tr>
                </thead>
                <tbody>
                  {overview.fields.map((row) => (
                    <tr key={row.field_id}>
                      <td>
                        <strong>{row.field_name}</strong>
                        <br />
                        <small>{row.field_id}</small>
                      </td>
                      <td>{row.current_state_text}</td>
                      <td>{row.confidence_text}</td>
                      <td>{row.data_coverage_text}</td>
                      <td>{row.forecast_window_text}</td>
                      <td>
                        <Link to={row.twin_href + scopeQueryString}>进入 Field Twin</Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </article>

          <article className="customerCard">
            <h3>数据缺口</h3>
            <ul className="customerList">
              {overview.data_gaps.map((gap) => (
                <li key={gap.gap_code}>{gap.label}</li>
              ))}
            </ul>
          </article>

          <article className="customerCard">
            <h3>人工确认边界</h3>
            <ul className="customerList">
              {overview.boundary_rules.map((rule) => (
                <li key={rule.rule_code}>{rule.label}</li>
              ))}
            </ul>
          </article>
        </div>
      ) : null}
    </section>
  );
}
