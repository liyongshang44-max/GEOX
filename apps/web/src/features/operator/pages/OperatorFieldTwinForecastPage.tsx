// apps/web/src/features/operator/pages/OperatorFieldTwinForecastPage.tsx
// Purpose: render the H22 field-scoped forecast panel for Operator Twin.
// Boundary: this page displays forecast window limits and risk timeline only; it does not compare scenarios, submit recommendations, approve, dispatch, or create AO-ACT tasks.

import React from "react";
import { Link, useParams, useSearchParams } from "react-router-dom";
import {
  buildOperatorTwinScopeQuery,
  fetchOperatorFieldTwinForecastPanel,
  type OperatorFieldTwinForecastPanelV1,
  type OperatorForecastRiskTimelineItem,
  type OperatorTwinRequestScope,
} from "../../../api/operatorTwin";

type RuntimeState = "loading" | "ready" | "error";

function scopeFromSearchParams(searchParams: URLSearchParams): OperatorTwinRequestScope {
  return {
    tenant_id: searchParams.get("tenant_id"),
    project_id: searchParams.get("project_id"),
    group_id: searchParams.get("group_id"),
  };
}

function ForecastRiskTimeline({ items }: { items: OperatorForecastRiskTimelineItem[] }): React.ReactElement {
  return (
    <article className="operatorPanel" data-card="ForecastRiskTimeline">
      <p className="operatorEyebrow">ForecastRiskTimeline</p>
      <h3>预测风险时间线</h3>
      <ul className="operatorList">
        {items.map((item) => (
          <li key={item.horizon}>
            <strong>{item.horizon}</strong>
            {" · "}
            {item.risk_text}
            {" · "}
            {item.confidence_text}
            {item.evidence_refs.length > 0 ? " · evidence_refs: " + item.evidence_refs.join(", ") : ""}
          </li>
        ))}
      </ul>
    </article>
  );
}

function ForecastWindowCard({ panel }: { panel: OperatorFieldTwinForecastPanelV1 }): React.ReactElement {
  const forecast = panel.forecast_window_v1;

  return (
    <article className="operatorPanel" data-card="ForecastWindowCard">
      <p className="operatorEyebrow">forecast_window_v1</p>
      <h3>预测窗口</h3>
      <ul className="operatorList">
        <li>available_horizon：{forecast.available_horizon}</li>
        <li>forecast_horizon_limited：{forecast.forecast_horizon_limited ? "true" : "false"}</li>
        <li>unavailable_horizons：{forecast.unavailable_horizons.join("、") || "none"}</li>
        <li>reason：{forecast.reason}</li>
        <li>evidence_refs：{forecast.evidence_refs.join(", ") || "none"}</li>
      </ul>
    </article>
  );
}

function ForecastBoundaryCard({ panel }: { panel: OperatorFieldTwinForecastPanelV1 }): React.ReactElement {
  return (
    <article className="operatorPanel" data-card="ForecastBoundaryCard">
      <h3>预测边界</h3>
      <ul className="operatorList">
        {panel.boundary_rules.map((rule) => (
          <li key={rule.rule_code}>{rule.label}</li>
        ))}
      </ul>
      <p>Forecast Panel 只展示预测窗口和风险时间线；不做 scenario compare，不提交 recommendation，不创建 AO-ACT task。</p>
    </article>
  );
}

export default function OperatorFieldTwinForecastPage(): React.ReactElement {
  const params = useParams();
  const [searchParams] = useSearchParams();
  const scope = React.useMemo(() => scopeFromSearchParams(searchParams), [searchParams]);
  const scopeQueryString = React.useMemo(() => buildOperatorTwinScopeQuery(scope), [scope]);
  const fieldId = String(params.fieldId ?? "").trim() || "field_c8_demo";
  const [state, setState] = React.useState<RuntimeState>("loading");
  const [panel, setPanel] = React.useState<OperatorFieldTwinForecastPanelV1 | null>(null);
  const [errorText, setErrorText] = React.useState("");

  React.useEffect(() => {
    let alive = true;
    setState("loading");
    setPanel(null);
    setErrorText("");

    void fetchOperatorFieldTwinForecastPanel(fieldId, scope)
      .then((response) => {
        if (!alive) return;
        setPanel(response.operator_field_twin_forecast_panel_v1);
        setState("ready");
      })
      .catch((error: unknown) => {
        if (!alive) return;
        setPanel(null);
        setErrorText(error instanceof Error ? error.message : "OPERATOR_FIELD_TWIN_FORECAST_PANEL_LOAD_FAILED");
        setState("error");
      });

    return () => {
      alive = false;
    };
  }, [fieldId, scope]);

  return (
    <section
      className="operatorWorkbenchPage"
      data-surface="operator-twin"
      data-page="operator-field-twin-forecast-panel"
      data-contract="forecast_window_v1"
    >
      <div className="operatorWorkbenchHero">
        <div>
          <p className="operatorEyebrow">Forecast Panel</p>
          <h2>地块预测窗口</h2>
          <p>
            当前地块：<strong>{panel?.field_context.field_name ?? fieldId}</strong>。
            本页只展示 forecast_window_v1、unavailable_horizons、reason、evidence_refs 与 ForecastRiskTimeline。
          </p>
        </div>
        <div className="operatorWorkbenchHeroActions">
          <Link className="operatorActionLink" to={"/operator/twin/fields/" + encodeURIComponent(fieldId) + scopeQueryString}>返回 Field Twin</Link>
          <Link className="operatorActionLink" to={"/operator/twin/fields/" + encodeURIComponent(fieldId) + "/evidence" + scopeQueryString}>Evidence</Link>
          <Link className="operatorActionLink" to={"/operator/twin" + scopeQueryString}>返回 Twin 总览</Link>
        </div>
      </div>

      {state === "loading" ? <div className="operatorPanel">Forecast Panel 数据加载中...</div> : null}
      {state === "error" ? <div className="operatorPanel">Forecast Panel 数据加载失败：{errorText}</div> : null}

      {panel ? (
        <div className="operatorPanelGrid">
          <ForecastWindowCard panel={panel} />
          <ForecastRiskTimeline items={panel.forecast_window_v1.risk_timeline} />
          <ForecastBoundaryCard panel={panel} />
        </div>
      ) : null}
    </section>
  );
}
