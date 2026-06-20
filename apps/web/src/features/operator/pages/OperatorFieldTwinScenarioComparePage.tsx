// apps/web/src/features/operator/pages/OperatorFieldTwinScenarioComparePage.tsx
// Purpose: render the H23 field-scoped scenario comparison panel for Operator Twin.
// Boundary: this page compares scenarios only; it does not submit recommendations, approve, dispatch, or create AO-ACT tasks.

import React from "react";
import { Link, useParams, useSearchParams } from "react-router-dom";
import {
  buildOperatorTwinScopeQuery,
  fetchOperatorFieldTwinScenarioCompare,
  type OperatorFieldTwinScenarioCompareV1,
  type OperatorScenarioCompareOption,
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

function ScenarioCompareTable({ options }: { options: OperatorScenarioCompareOption[] }): React.ReactElement {
  return (
    <article className="operatorPanel" data-card="ScenarioCompareTable">
      <p className="operatorEyebrow">ScenarioCompareTable</p>
      <h3>情景比较</h3>
      <table className="operatorTable">
        <thead>
          <tr>
            <th>option_id</th>
            <th>label</th>
            <th>risk_delta</th>
            <th>confidence_text</th>
            <th>failure_conditions</th>
          </tr>
        </thead>
        <tbody>
          {options.map((option) => (
            <tr key={option.option_id || option.label}>
              <td>{option.option_id}</td>
              <td>{option.label}</td>
              <td>{option.risk_delta ?? "n/a"}</td>
              <td>{option.confidence_text ?? "n/a"}</td>
              <td>{option.failure_conditions.join("、") || "none"}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </article>
  );
}

function ScenarioStatusCard({ panel }: { panel: OperatorFieldTwinScenarioCompareV1 }): React.ReactElement {
  const compare = panel.scenario_compare_v1;

  return (
    <article className="operatorPanel" data-card="ScenarioCompareStatus">
      <p className="operatorEyebrow">scenario_compare_v1</p>
      <h3>比较状态</h3>
      <ul className="operatorList">
        <li>status：{compare.status}</li>
        <li>no_action_baseline_present：{compare.no_action_baseline_present ? "true" : "false"}</li>
        <li>unavailable_reason：{compare.unavailable_reason ?? "none"}</li>
        <li>evidence_refs：{compare.evidence_refs.join(", ") || "none"}</li>
      </ul>
    </article>
  );
}

function ScenarioBoundaryCard({ panel }: { panel: OperatorFieldTwinScenarioCompareV1 }): React.ReactElement {
  return (
    <article className="operatorPanel" data-card="ScenarioCompareBoundary">
      <h3>情景边界</h3>
      <ul className="operatorList">
        {panel.boundary_rules.map((rule) => (
          <li key={rule.rule_code}>{rule.label}</li>
        ))}
      </ul>
      <p>Scenario Compare 只做比较；不提交 recommendation，不创建 AO-ACT task，不进入 approval 或 dispatch。</p>
    </article>
  );
}

export default function OperatorFieldTwinScenarioComparePage(): React.ReactElement {
  const params = useParams();
  const [searchParams] = useSearchParams();
  const scope = React.useMemo(() => scopeFromSearchParams(searchParams), [searchParams]);
  const scopeQueryString = React.useMemo(() => buildOperatorTwinScopeQuery(scope), [scope]);
  const fieldId = String(params.fieldId ?? "").trim() || "field_c8_demo";
  const [state, setState] = React.useState<RuntimeState>("loading");
  const [panel, setPanel] = React.useState<OperatorFieldTwinScenarioCompareV1 | null>(null);
  const [errorText, setErrorText] = React.useState("");

  React.useEffect(() => {
    let alive = true;
    setState("loading");
    setPanel(null);
    setErrorText("");

    void fetchOperatorFieldTwinScenarioCompare(fieldId, scope)
      .then((response) => {
        if (!alive) return;
        setPanel(response.operator_field_twin_scenario_compare_v1);
        setState("ready");
      })
      .catch((error: unknown) => {
        if (!alive) return;
        setPanel(null);
        setErrorText(error instanceof Error ? error.message : "OPERATOR_FIELD_TWIN_SCENARIO_COMPARE_LOAD_FAILED");
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
      data-page="operator-field-twin-scenario-compare"
      data-contract="scenario_compare_v1"
    >
      <div className="operatorWorkbenchHero">
        <div>
          <p className="operatorEyebrow">Scenario Compare</p>
          <h2>地块情景比较</h2>
          <p>
            当前地块：<strong>{panel?.field_context.field_name ?? fieldId}</strong>。
            本页只展示 scenario_compare_v1、no_action_baseline_present、options、risk_delta、confidence_text、failure_conditions、evidence_refs 与 unavailable_reason。
          </p>
        </div>
        <div className="operatorWorkbenchHeroActions">
          <Link className="operatorActionLink" to={"/operator/twin/fields/" + encodeURIComponent(fieldId) + scopeQueryString}>返回 Field Twin</Link>
          <Link className="operatorActionLink" to={"/operator/twin/fields/" + encodeURIComponent(fieldId) + "/forecast" + scopeQueryString}>查看 Forecast</Link>
          <Link className="operatorActionLink" to={"/operator/twin/fields/" + encodeURIComponent(fieldId) + "/evidence" + scopeQueryString}>Evidence</Link>
          <Link className="operatorActionLink" to={"/operator/twin" + scopeQueryString}>返回 Twin 总览</Link>
        </div>
      </div>

      {state === "loading" ? <div className="operatorPanel">Scenario Compare 数据加载中...</div> : null}
      {state === "error" ? <div className="operatorPanel">Scenario Compare 数据加载失败：{errorText}</div> : null}

      {panel ? (
        <div className="operatorPanelGrid">
          <ScenarioStatusCard panel={panel} />
          <ScenarioCompareTable options={panel.scenario_compare_v1.options} />
          <ScenarioBoundaryCard panel={panel} />
        </div>
      ) : null}
    </section>
  );
}
