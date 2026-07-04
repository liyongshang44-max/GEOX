// apps/web/src/features/operator/pages/OperatorFieldTwinScenarioComparePage.tsx
// Purpose: render the H23 field-scoped scenario comparison panel for Operator Twin.
// Boundary: this page compares scenarios and may submit a scenario option to recommendation only; it does not approve, dispatch, or create AO-ACT tasks.

import React from "react";
import { Link, useParams, useSearchParams } from "react-router-dom";
import { SubmitScenarioToRecommendationPanel } from "../components/SubmitScenarioToRecommendationPanel";
import FieldRuntimeLegacyScenarioActionNotice from "../fieldRuntime/FieldRuntimeLegacyScenarioActionNotice";
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

function statusText(value: string | null | undefined): string {
  const raw = emptyText(value);
  const labels: Record<string, string> = {
    AVAILABLE: "可用",
    NOT_AVAILABLE: "不可用",
    LIMITED: "受限",
    UNKNOWN: "未知",
  };
  const label = labels[raw] ?? raw;
  return label === raw ? raw : label + "（" + raw + "）";
}

function reasonText(value: string | null | undefined): string {
  const raw = emptyText(value);
  const labels: Record<string, string> = {
    NO_ACTION_BASELINE_OR_OPTIONS_NOT_AVAILABLE: "无动作基线或情景选项不可用",
    NO_ACTION_BASELINE_REQUIRED: "缺少无动作基线",
    SCENARIO_OPTIONS_MISSING: "缺少情景选项",
  };
  const label = labels[raw] ?? raw;
  return label === raw ? raw : label + "（" + raw + "）";
}

function boundaryRuleText(label: string): string {
  return label
    .replace(/dispatch/g, "派单")
    .replace(/approval/g, "审批")
    .replace(/recommendation/g, "建议候选")
    .replace(/operation plan/g, "作业计划")
    .replace(/Scenario Compare/g, "情景比较")
    .replace(/Scenario/g, "情景")
    .replace(/Task/g, "任务")
    .replace(/Fact/g, "事实")
    .replace(/Forecast/g, "预测");
}

function ScenarioCompareTable({ options }: { options: OperatorScenarioCompareOption[] }): React.ReactElement {
  return (
    <article className="operatorPanel" data-card="ScenarioCompareTable">
      <p className="operatorEyebrow">情景比较表</p>
      <h3>情景比较</h3>
      <table className="operatorTable">
        <thead>
          <tr>
            <th>选项 ID</th>
            <th>标签</th>
            <th>风险变化</th>
            <th>置信度</th>
            <th>失败条件</th>
          </tr>
        </thead>
        <tbody>
          {options.map((option) => (
            <tr key={option.option_id || option.label}>
              <td>{option.option_id}</td>
              <td>{option.label}</td>
              <td>{emptyText(option.risk_delta)}</td>
              <td>{emptyText(option.confidence_text)}</td>
              <td>{listText(option.failure_conditions)}</td>
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
      <p className="operatorEyebrow">情景比较（scenario_compare_v1）</p>
      <h3>比较状态</h3>
      <ul className="operatorList">
        <li>状态：{statusText(compare.status)}</li>
        <li>无动作基线是否存在：{boolText(compare.no_action_baseline_present)}</li>
        <li>不可用原因：{reasonText(compare.unavailable_reason)}</li>
        <li>证据引用：{listText(compare.evidence_refs)}</li>
      </ul>
    </article>
  );
}

function ScenarioBoundaryCard({ panel }: { panel: OperatorFieldTwinScenarioCompareV1 }): React.ReactElement {
  return (
    <article className="operatorPanel" data-card="ScenarioCompareBoundary">
      <h3>情景边界</h3>
      <ul className="operatorList">
        {panel.boundary_rules.map((rule) => <li key={rule.rule_code}>{boundaryRuleText(rule.label)}</li>)}
      </ul>
      <p>情景比较可以提交为建议候选；不会自动审批，不会创建作业计划，不会创建 AO-ACT 任务，不派单。</p>
    </article>
  );
}

export default function OperatorFieldTwinScenarioComparePage(): React.ReactElement {
  const params = useParams();
  const [searchParams] = useSearchParams();
  const scope = React.useMemo(() => scopeFromSearchParams(searchParams), [searchParams]);
  const scopeQueryString = React.useMemo(() => buildOperatorTwinScopeQuery(scope), [scope]);
  const fieldId = String(params.fieldId ?? "").trim() || "field_c8_demo";
  const canonicalScenarioPath = "/operator/fields/" + encodeURIComponent(fieldId) + "/scenario" + scopeQueryString;
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

    return () => { alive = false; };
  }, [fieldId, scope]);

  return (
    <section className="operatorWorkbenchPage" data-surface="operator-twin" data-page="operator-field-twin-scenario-compare" data-contract="scenario_compare_v1">
      <div className="operatorWorkbenchHero">
        <div>
          <p className="operatorEyebrow">情景比较</p>
          <h2>地块情景比较</h2>
          <p>当前地块：<strong>{panel?.field_context.field_name ?? fieldId}</strong>。本页只展示情景比较状态、无动作基线、情景选项、风险变化、置信度、失败条件、证据引用与不可用原因。</p>
        </div>
        <div className="operatorWorkbenchHeroActions">
          <Link className="operatorActionLink" to={"/operator/twin/fields/" + encodeURIComponent(fieldId) + scopeQueryString}>返回地块 Twin</Link>
          <Link className="operatorActionLink" to={"/operator/twin/fields/" + encodeURIComponent(fieldId) + "/forecast" + scopeQueryString}>查看预测</Link>
          <Link className="operatorActionLink" to={"/operator/twin/fields/" + encodeURIComponent(fieldId) + "/evidence" + scopeQueryString}>证据</Link>
          <Link className="operatorActionLink" to={"/operator/twin" + scopeQueryString}>返回 Twin 总览</Link>
        </div>
      </div>

      {state === "loading" ? <div className="operatorPanel">情景比较数据加载中...</div> : null}
      {state === "error" ? <div className="operatorPanel">情景比较数据加载失败：{errorText}</div> : null}

      {panel ? (
        <div className="operatorPanelGrid">
          <ScenarioStatusCard panel={panel} />
          <ScenarioCompareTable options={panel.scenario_compare_v1.options} />
          <ScenarioBoundaryCard panel={panel} />
          <FieldRuntimeLegacyScenarioActionNotice canonicalPath={canonicalScenarioPath} />
          <SubmitScenarioToRecommendationPanel fieldId={fieldId} scenarioSetId={panel.scenario_compare_v1.scenario_set_id ?? ""} options={panel.scenario_compare_v1.options} evidenceRefs={panel.scenario_compare_v1.evidence_refs} scope={scope} />
        </div>
      ) : null}
    </section>
  );
}
