// apps/web/src/features/operator/pages/OperatorTwinOverviewPage.tsx
// Purpose: render the API-backed read-only Operator Twin overview with explicit scope propagation.
// Boundary: this page does not run forecasts, submit recommendations, approve, dispatch, or create AO-ACT tasks.

import React from "react";
import { Link, useSearchParams } from "react-router-dom";
import {
  buildOperatorTwinScopeQuery,
  fetchOperatorTwinOverview,
  fetchOperatorTwinSourceIndexInventory,
  type OperatorTwinOverviewV1,
  type OperatorTwinRequestScope,
  type OperatorTwinSourceIndexInventoryV1,
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

function formatInventoryTimestamp(value: number | null): string {
  if (value === null || value === undefined) return "none";

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) return String(value);

  return date.toISOString();
}

function SourceIndexInventoryCard({
  inventory,
  loadState,
  error,
}: {
  inventory: OperatorTwinSourceIndexInventoryV1 | null;
  loadState: "idle" | "loading" | "ready" | "error";
  error: string | null;
}): React.ReactElement {
  return (
    <article className="operatorPanel" data-card="operator-twin-source-index-inventory">
      <h3>Source Index Inventory</h3>
      {loadState === "loading" ? <p>source index inventory 正在加载。</p> : null}
      {loadState === "error" ? (
        <p>source index inventory 暂不可用：{error ?? "OPERATOR_TWIN_SOURCE_INDEX_INVENTORY_UNAVAILABLE"}</p>
      ) : null}
      {!inventory && loadState !== "loading" && loadState !== "error" ? <p>source index inventory 尚未加载。</p> : null}
      {inventory ? (
        <>
          <p>
            table_count：{inventory.summary.table_count}；available_table_count：{inventory.summary.available_table_count}；total_row_count：{inventory.summary.total_row_count}
          </p>
          <div className="operatorTableWrap">
            <table className="operatorTable" data-table="operator-twin-source-index-inventory">
              <thead>
                <tr>
                  <th>source index</th>
                  <th>available</th>
                  <th>row_count</th>
                  <th>latest_ts</th>
                  <th>scope_columns</th>
                  <th>evidence_refs</th>
                </tr>
              </thead>
              <tbody>
                {inventory.source_indexes.map((row) => (
                  <tr key={row.table_name}>
                    <td>
                      <strong>{row.label}</strong>
                      <br />
                      <small>{row.table_name}</small>
                    </td>
                    <td>{row.available ? "true" : "false"}</td>
                    <td>{row.row_count}</td>
                    <td>{formatInventoryTimestamp(row.latest_ts_ms)}</td>
                    <td>{row.scope_columns_present.join(", ") || "none"}</td>
                    <td>{row.latest_evidence_refs.length > 0 ? row.latest_evidence_refs.join(", ") : "none"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      ) : null}
    </article>
  );
}

function ScopePolicyCard({ policy }: { policy: OperatorTwinScopePolicy }): React.ReactElement {
  return (
    <article className="operatorPanel" data-card="operator-twin-scope-policy">
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
  const [inventory, setInventory] = React.useState<OperatorTwinSourceIndexInventoryV1 | null>(null);
  const [inventoryLoadState, setInventoryLoadState] = React.useState<"idle" | "loading" | "ready" | "error">("idle");
  const [inventoryError, setInventoryError] = React.useState<string | null>(null);
  const [errorText, setErrorText] = React.useState("");

  React.useEffect(() => {
    let alive = true;
    setState("loading");
    setErrorText("");
    setOverview(null);
    setInventory(null);
    setInventoryLoadState("loading");
    setInventoryError(null);

    void fetchOperatorTwinOverview(scope)
      .then((response) => {
        if (!alive) return;
        const nextOverview = response.operator_twin_overview_v1;
        setOverview(nextOverview);
        setState(nextOverview.fields.length > 0 ? "ready" : "empty");
      })
      .catch(() => {
        if (!alive) return;
        setState("error");
      });

    void fetchOperatorTwinSourceIndexInventory(scope)
      .then((response) => {
        if (!alive) return;
        setInventory(response.operator_twin_source_index_inventory_v1);
        setInventoryLoadState("ready");
        setInventoryError(null);
      })
      .catch((error: unknown) => {
        if (!alive) return;
        setInventory(null);
        setInventoryLoadState("error");
        setInventoryError(error instanceof Error ? error.message : "OPERATOR_TWIN_SOURCE_INDEX_INVENTORY_FAILED");
      });

    return () => {
      alive = false;
    };
  }, [scope]);

  return (
    <section className="operatorWorkbenchPage" data-surface="operator-twin" data-page="operator-twin-overview">
      <div className="operatorWorkbenchHero">
        <div>
          <p className="operatorEyebrow">Operator Twin Workbench</p>
          <h2>田块预测与情景推演入口</h2>
          <p>
            该页面读取 operator_twin_overview_v1，并把 tenant_id / project_id / group_id 作为只读查询范围传给后端。
            当前版本不运行预测、不提交 recommendation、不审批、不执行。
          </p>
        </div>
        <div className="operatorWorkbenchHeroActions">
          <span className="operatorPill">API-backed</span>
          <span className="operatorPill">Scoped read</span>
          <span className="operatorPill">No direct execution</span>
        </div>
      </div>

      {state === "loading" ? <div className="operatorPanel">Operator Twin 数据加载中...</div> : null}
      {state === "error" ? <div className="operatorPanel">Operator Twin 数据加载失败：{errorText}</div> : null}
      {state === "empty" ? <div className="operatorPanel">暂无可展示田块 Twin 数据。请确认 URL 中的 tenant_id / project_id / group_id。</div> : null}

      {overview ? (
        <div className="operatorPanelGrid">
          <ScopePolicyCard policy={overview.scope_policy} />
          <SourceIndexInventoryCard inventory={inventory} loadState={inventoryLoadState} error={inventoryError} />

          <article className="operatorPanel">
            <h3>田块状态矩阵</h3>
            <div className="operatorTableWrap">
              <table className="operatorTable">
                <thead>
                  <tr>
                    <th>田块</th>
                    <th>当前状态</th>
                    <th>风险</th>
                    <th>置信度</th>
                    <th>低置信</th>
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
                      <td>{row.risk_text}</td>
                      <td>{row.confidence_text}</td>
                      <td>{row.low_confidence ? "LOW_CONFIDENCE" : "CONFIDENCE_OK"}</td>
                      <td>{row.data_coverage_text}</td>
                      <td>{row.forecast_window_text}</td>
                      <td>
                        <Link
                          data-link="operator-field-twin-workspace"
                          data-field-id={row.field_id}
                          to={row.twin_href + scopeQueryString}
                        >
                          进入 Field Twin
                        </Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </article>

          <article className="operatorPanel">
            <h3>数据缺口</h3>
            <ul className="operatorList">
              {overview.data_gaps.map((gap) => (
                <li key={gap.gap_code}>{gap.label}</li>
              ))}
            </ul>
          </article>

          <article className="operatorPanel">
            <h3>人工确认边界</h3>
            <ul className="operatorList">
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
