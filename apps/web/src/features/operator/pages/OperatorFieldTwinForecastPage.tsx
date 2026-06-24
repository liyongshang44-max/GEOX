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

function boolText(value: boolean): string {
  return value ? "是" : "否";
}

function emptyText(value: string | number | null | undefined): string {
  const raw = String(value ?? "").trim();
  if (!raw || raw === "none" || raw === "n/a") return "无";
  return raw;
}

function listText(values: string[]): string {
  return values.length > 0 ? values.join("、") : "无";
}

function reasonText(value: string | null | undefined): string {
  const raw = emptyText(value);
  const labels: Record<string, string> = {
    LONG_RANGE_FORECAST_RUN_NOT_AVAILABLE: "长期预测运行尚未生成",
    SEVEN_DAY_FORECAST_RUN_MISSING: "7 天预测运行缺失",
    THIRTY_DAY_TREND_MISSING: "30 天趋势尚未建模",
    FORECAST_WINDOW_LIMITED: "预测窗口受限",
    WEATHER_HORIZON_INSUFFICIENT: "天气预测时域不足",
  };
  const label = labels[raw] ?? raw;
  return label === raw ? raw : label + "（" + raw + "）";
}

function boundaryRuleText(label: string): string {
  return label
    .replace(/dispatch/g, "派单")
    .replace(/approval/g, "审批")
    .replace(/recommendation/g, "建议候选")
    .replace(/scenario compare/g, "情景比较")
    .replace(/Scenario/g, "情景")
    .replace(/Task/g, "任务")
    .replace(/Fact/g, "事实")
    .replace(/Forecast/g, "预测");
}

function riskTimelineText(value: string): string {
  return value
    .replace(/risk/g, "风险")
    .replace(/normal/g, "正常")
    .replace(/high risk/g, "高风险")
    .replace(/High risk/g, "高风险")
    .replace(/FORECAST_WINDOW_LIMITED/g, "预测窗口受限（FORECAST_WINDOW_LIMITED）")
    .replace(/evidence_refs/g, "证据引用");
}

function ForecastRiskTimeline({ items }: { items: OperatorForecastRiskTimelineItem[] }): React.ReactElement {
  return (
    <article className="operatorPanel" data-card="ForecastRiskTimeline">
      <p className="operatorEyebrow">预测风险时间线</p>
      <h3>预测风险时间线</h3>
      <ul className="operatorList">
        {items.map((item) => (
          <li key={item.horizon}>
            <strong>窗口：{item.horizon}</strong>
            {" · 风险："}
            {riskTimelineText(item.risk_text)}
            {" · 置信度："}
            {riskTimelineText(item.confidence_text)}
            {item.evidence_refs.length > 0 ? " · 证据引用：" + item.evidence_refs.join("、") : ""}
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
      <p className="operatorEyebrow">预测窗口（forecast_window_v1）</p>
      <h3>预测窗口</h3>
      <ul className="operatorList">
        <li>可用预测窗口：{forecast.available_horizon}</li>
        <li>预测窗口是否受限：{boolText(forecast.forecast_horizon_limited)}</li>
        <li>不可用窗口：{listText(forecast.unavailable_horizons)}</li>
        <li>限制原因：{reasonText(forecast.reason)}</li>
        <li>证据引用：{listText(forecast.evidence_refs)}</li>
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
          <li key={rule.rule_code}>{boundaryRuleText(rule.label)}</li>
        ))}
      </ul>
      <p>预测页只展示预测窗口和风险时间线；不做情景比较，不提交建议候选，不创建 AO-ACT 任务。</p>
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
          <p className="operatorEyebrow">预测小组</p>
          <h2>地块预测窗口</h2>
          <p>
            当前地块：<strong>{panel?.field_context.field_name ?? fieldId}</strong>。
            本页只展示预测窗口、不可用窗口、限制原因、证据引用与预测风险时间线。
          </p>
        </div>
        <div className="operatorWorkbenchHeroActions">
          <Link className="operatorActionLink" to={"/operator/twin/fields/" + encodeURIComponent(fieldId) + scopeQueryString}>返回地块 Twin</Link>
          <Link className="operatorActionLink" to={"/operator/twin/fields/" + encodeURIComponent(fieldId) + "/evidence" + scopeQueryString}>证据</Link>
          <Link className="operatorActionLink" to={"/operator/twin" + scopeQueryString}>返回 Twin 总览</Link>
        </div>
      </div>

      {state === "loading" ? <div className="operatorPanel">预测窗口数据加载中...</div> : null}
      {state === "error" ? <div className="operatorPanel">预测窗口数据加载失败：{errorText}</div> : null}

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
