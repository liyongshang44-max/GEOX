import React from "react";
import { Link, useSearchParams } from "react-router-dom";
import {
  fetchOperatorFieldTwinScenarioCompare,
  fetchOperatorFieldTwinWorkspace,
  fetchOperatorTwinOverview,
  type OperatorFieldTwinWorkspaceV1,
  type OperatorScenarioCompareV1,
  type OperatorTwinOverviewField,
  type OperatorTwinRequestScope,
} from "../../../api/operatorTwin";
import { localizedText, useLocale, type LocalizedCopy } from "../../../lib/locale";
import {
  agronomyCapabilitiesV1,
  buildAgronomyFieldContextV1,
  scenarioFactsV1,
  workspaceAgronomyFactsV1,
} from "../../../viewmodels/fouiAgronomyPlanningVm";
import "../../../styles/fouiFieldOperations.css";

type LoadState = "loading" | "ready" | "error";
type LazyState<T> =
  | { status: "idle" }
  | { status: "loading" }
  | { status: "ready"; data: T }
  | { status: "error"; message: string };

const COPY = {
  eyebrow: { zh: "农艺 / 规划", en: "Agronomy / Planning" },
  title: { zh: "从田块现实进入农艺判断。", en: "Move from field reality into agronomic judgment." },
  lead: {
    zh: "这里先组织已授权的田块上下文、预测和情景比较。现有 Planning / Recommendation 专业工作台继续保持各自权限；ADR authoritative DecisionResult 尚未在此产品面开放。",
    en: "This surface organizes authorized field context, forecast, and scenario comparison first. Existing Planning and Recommendation specialist workspaces keep their own permissions; authoritative ADR DecisionResult is not yet exposed here.",
  },
} as const satisfies Record<string, LocalizedCopy>;

function scopeFromSearchParams(searchParams: URLSearchParams): OperatorTwinRequestScope {
  return {
    tenant_id: searchParams.get("tenant_id"),
    project_id: searchParams.get("project_id"),
    group_id: searchParams.get("group_id"),
  };
}

function fieldRoute(fieldId: string, path: string): string {
  const query = new URLSearchParams({ field_id: fieldId });
  return path + "?" + query.toString();
}

function CapabilityStatus({ status }: { status: string }): React.ReactElement {
  const limited = status === "NOT_AUTHORIZED_HERE" || status === "SPECIALIST_ROUTE";
  return <span className={limited ? "fouiStatePill fouiStatePill--limited" : "fouiStatePill"}>{status}</span>;
}

export default function AgronomyPlanningPage(): React.ReactElement {
  const { locale } = useLocale();
  const english = locale === "en-US";
  const t = (copy: LocalizedCopy) => localizedText(copy, locale);
  const [searchParams, setSearchParams] = useSearchParams();
  const scope = React.useMemo(() => scopeFromSearchParams(searchParams), [searchParams]);
  const requestedFieldId = String(searchParams.get("field_id") ?? "").trim();

  const [loadState, setLoadState] = React.useState<LoadState>("loading");
  const [fields, setFields] = React.useState<OperatorTwinOverviewField[]>([]);
  const [fieldId, setFieldId] = React.useState(requestedFieldId);
  const [error, setError] = React.useState("");
  const [workspace, setWorkspace] = React.useState<LazyState<OperatorFieldTwinWorkspaceV1>>({ status: "idle" });
  const [scenario, setScenario] = React.useState<LazyState<OperatorScenarioCompareV1>>({ status: "idle" });

  React.useEffect(() => {
    let active = true;
    setLoadState("loading");
    setError("");
    fetchOperatorTwinOverview(scope)
      .then((response) => {
        if (!active) return;
        const next = Array.isArray(response.operator_twin_overview_v1?.fields)
          ? response.operator_twin_overview_v1.fields
          : [];
        setFields(next);
        setFieldId((current) => {
          if (current && next.some((field) => field.field_id === current)) return current;
          if (requestedFieldId && next.some((field) => field.field_id === requestedFieldId)) return requestedFieldId;
          return next[0]?.field_id || "";
        });
        setLoadState("ready");
      })
      .catch((reason: unknown) => {
        if (!active) return;
        setFields([]);
        setError(reason instanceof Error ? reason.message : String(reason));
        setLoadState("error");
      });
    return () => { active = false; };
  }, [scope, requestedFieldId]);

  React.useEffect(() => {
    setWorkspace({ status: "idle" });
    setScenario({ status: "idle" });
  }, [fieldId]);

  const selectedField = fields.find((field) => field.field_id === fieldId) ?? null;
  const fieldContext = selectedField ? buildAgronomyFieldContextV1(selectedField) : null;
  const capabilities = agronomyCapabilitiesV1();

  function selectField(nextFieldId: string): void {
    setFieldId(nextFieldId);
    const next = new URLSearchParams(searchParams);
    if (nextFieldId) next.set("field_id", nextFieldId);
    else next.delete("field_id");
    setSearchParams(next, { replace: true });
  }

  async function loadWorkspace(): Promise<void> {
    if (!fieldId || workspace.status === "loading" || workspace.status === "ready") return;
    setWorkspace({ status: "loading" });
    try {
      const response = await fetchOperatorFieldTwinWorkspace(fieldId, scope);
      setWorkspace({ status: "ready", data: response.operator_field_twin_workspace_v1 });
    } catch (reason) {
      setWorkspace({ status: "error", message: reason instanceof Error ? reason.message : String(reason) });
    }
  }

  async function loadScenario(): Promise<void> {
    if (!fieldId || scenario.status === "loading" || scenario.status === "ready") return;
    setScenario({ status: "loading" });
    try {
      const response = await fetchOperatorFieldTwinScenarioCompare(fieldId, scope);
      setScenario({ status: "ready", data: response.operator_field_twin_scenario_compare_v1.scenario_compare_v1 });
    } catch (reason) {
      setScenario({ status: "error", message: reason instanceof Error ? reason.message : String(reason) });
    }
  }

  const workspaceFacts = workspace.status === "ready" ? workspaceAgronomyFactsV1(workspace.data) : [];
  const candidate = workspace.status === "ready" ? workspace.data.recommendation_candidate : null;
  const scenarioFacts = scenarioFactsV1(scenario.status === "ready" ? scenario.data : null);

  return (
    <div className="fouiPage fouiAgronomy fouiAgronomyPlanningV1" data-foui-surface="agronomy-planning-v1">
      <section className="fouiHero">
        <div>
          <span className="fouiEyebrow">{t(COPY.eyebrow)}</span>
          <h2>{t(COPY.title)}</h2>
          <p>{t(COPY.lead)}</p>
        </div>
        <span className="fouiStatePill">{english ? "READ-ONLY · NO ADR PROMOTION" : "只读 · 不升格 ADR 权威"}</span>
      </section>

      <section className="fouiPanel">
        <header className="fouiPanelHeader">
          <div>
            <span className="fouiEyebrow">FIELD CONTEXT</span>
            <h3>{english ? "Choose the field you are reasoning about" : "选择要进行农艺判断的田块"}</h3>
          </div>
          <span className="fouiStatePill">Operator Twin GET</span>
        </header>

        <div className="fouiAgronomyFieldSelector">
          <label>
            <span>{english ? "Field" : "田块"}</span>
            <select value={fieldId} onChange={(event) => selectField(event.target.value)} disabled={loadState === "loading"}>
              <option value="">{loadState === "loading" ? (english ? "Loading…" : "加载中…") : (english ? "Select field" : "选择田块")}</option>
              {fields.map((field) => <option key={field.field_id} value={field.field_id}>{field.field_name || field.field_id} · {field.crop_text || "—"}</option>)}
            </select>
          </label>
          {fieldId ? <Link className="fouiSecondaryLink" to={fieldRoute(fieldId, "/operator/field-intelligence")}>{english ? "Open Field Intelligence" : "打开 Field Intelligence"}</Link> : null}
        </div>

        {error ? <div className="fouiBoundaryNotice fouiBoundaryNotice--error">{error}</div> : null}

        {fieldContext ? (
          <div className="fouiAgronomyContextGrid">
            <article><span>{english ? "Crop" : "作物"}</span><strong>{fieldContext.crop_text || "—"}</strong></article>
            <article><span>{english ? "Current state" : "当前状态"}</span><strong>{fieldContext.current_state_text || "—"}</strong></article>
            <article><span>{english ? "Risk / limitation" : "风险 / 限制"}</span><strong>{fieldContext.risk_text || "—"}</strong></article>
            <article><span>{english ? "Confidence" : "置信度"}</span><strong>{fieldContext.confidence_text || "—"}</strong></article>
            <article><span>{english ? "Data coverage" : "数据覆盖"}</span><strong>{fieldContext.data_coverage_text || "—"}</strong></article>
            <article><span>{english ? "Forecast window" : "预测窗口"}</span><strong>{fieldContext.forecast_window_text || "—"}</strong></article>
            <article className="fouiAgronomyContextGrid__wide"><span>{english ? "Current next-step text" : "当前下一步提示"}</span><strong>{fieldContext.next_step_text || "—"}</strong></article>
          </div>
        ) : <div className="fouiEmpty">{loadState === "loading" ? (english ? "Loading fields…" : "正在读取田块…") : (english ? "No field context available." : "当前没有可用田块上下文。")}</div>}
      </section>

      <div className="fouiAgronomyWorkGrid">
        <section className="fouiPanel">
          <header className="fouiPanelHeader">
            <div><span className="fouiEyebrow">AGRONOMIC CONTEXT</span><h3>{english ? "Load deeper field context when needed" : "需要时再读取更深的田块农艺上下文"}</h3></div>
          </header>
          <p className="fouiMuted">{english ? "This is still an Operator Twin read model. It can inform agronomic review but does not become ADR authority." : "这里仍然是 Operator Twin 只读模型，可支持农艺审查，但不会因此成为 ADR 权威。"}</p>
          <button type="button" className="fouiButton" disabled={!fieldId || workspace.status === "loading"} onClick={() => void loadWorkspace()}>
            {workspace.status === "ready" ? (english ? "Context loaded" : "上下文已加载") : workspace.status === "loading" ? (english ? "Loading…" : "加载中…") : (english ? "Load agronomic context" : "读取农艺上下文")}
          </button>
          {workspace.status === "error" ? <div className="fouiBoundaryNotice fouiBoundaryNotice--error">{workspace.message}</div> : null}
          {workspace.status === "ready" ? (
            <>
              <dl className="fouiAgronomyFacts">
                {workspaceFacts.map((fact) => <div key={fact.label}><dt>{fact.label}</dt><dd>{fact.value}</dd></div>)}
              </dl>

              <div className="fouiCandidateCard">
                <span className="fouiEyebrow">OPERATOR TWIN RECOMMENDATION CANDIDATE</span>
                <h4>{candidate?.action_type || (english ? "No candidate returned" : "未返回候选建议")}</h4>
                <p>{candidate?.recommendation_id || "recommendation_id = null"}</p>
                <div className="fouiCandidateFlags">
                  <span>human_approval_required = {String(candidate?.human_approval_required ?? true)}</span>
                  <span>no_direct_execution = {String(candidate?.no_direct_execution ?? true)}</span>
                </div>
                <p className="fouiMuted">{english ? "Candidate ≠ ADR DecisionResult ≠ approval ≠ execution authorization." : "Candidate ≠ ADR DecisionResult ≠ 审批 ≠ 执行授权。"}</p>
              </div>
            </>
          ) : null}
        </section>

        <section className="fouiPanel">
          <header className="fouiPanelHeader">
            <div><span className="fouiEyebrow">SCENARIO PLANNING</span><h3>{english ? "Compare possibilities without calling them decisions" : "比较可能性，但不把情景叫作决策"}</h3></div>
          </header>
          <p className="fouiMuted">{english ? "Scenario data is loaded on demand. A scenario is not a recommendation and not a decision." : "情景数据按需读取。Scenario 不是 Recommendation，也不是 Decision。"}</p>
          <button type="button" className="fouiButton" disabled={!fieldId || scenario.status === "loading"} onClick={() => void loadScenario()}>
            {scenario.status === "ready" ? (english ? "Scenarios loaded" : "情景已加载") : scenario.status === "loading" ? (english ? "Loading…" : "加载中…") : (english ? "Load scenario comparison" : "读取情景比较")}
          </button>
          {scenario.status === "error" ? <div className="fouiBoundaryNotice fouiBoundaryNotice--error">{scenario.message}</div> : null}
          {scenario.status === "ready" ? (
            <div className="fouiScenarioProductView">
              <div className="fouiScenarioSummary">
                <article><span>Status</span><strong>{scenarioFacts.status}</strong></article>
                <article><span>No-action baseline</span><strong>{String(scenarioFacts.no_action_baseline_present)}</strong></article>
                <article><span>{english ? "Options" : "选项"}</span><strong>{scenarioFacts.option_count}</strong></article>
              </div>
              {scenario.data.options.map((option) => (
                <article className="fouiScenarioOption" key={option.option_id}>
                  <div><strong>{option.label}</strong><small>{option.option_id}</small></div>
                  <p>{english ? "Risk delta" : "风险变化"}: {option.risk_delta || "—"} · {english ? "Confidence" : "置信度"}: {option.confidence_text || "—"}</p>
                  <ul>{option.failure_conditions.map((condition) => <li key={condition}>{condition}</li>)}</ul>
                </article>
              ))}
              {scenarioFacts.unavailable_reason ? <div className="fouiBoundaryNotice">{scenarioFacts.unavailable_reason}</div> : null}
            </div>
          ) : null}
        </section>
      </div>

      <section className="fouiPanel">
        <header className="fouiPanelHeader">
          <div><span className="fouiEyebrow">SPECIALIST WORKSPACES</span><h3>{english ? "Existing planning and recommendation tools stay separate" : "现有 Planning 与 Recommendation 工作台继续独立"}</h3></div>
        </header>
        <div className="fouiCapabilityLinks">
          <Link to={fieldId ? fieldRoute(fieldId, "/programs") : "/programs"}>
            <strong>{english ? "Season & Crop Planning" : "季节与种植规划"}</strong>
            <small>{english ? "Existing Program workspace · keeps its own authorization" : "现有 Program 工作台 · 保持自己的权限边界"}</small>
          </Link>
          <Link to={fieldId ? fieldRoute(fieldId, "/agronomy/recommendations") : "/agronomy/recommendations"}>
            <strong>{english ? "Recommendation Review" : "建议审查"}</strong>
            <small>recommendation.read · Recommendation ≠ Approval</small>
          </Link>
          <article className="fouiCapabilityUnavailable">
            <strong>ADR DecisionResult</strong>
            <small>{english ? "Not yet available on the authoritative product projection." : "authoritative product projection 尚未开放。"}</small>
          </article>
        </div>
      </section>

      <section className="fouiPanel">
        <header className="fouiPanelHeader"><div><span className="fouiEyebrow">CAPABILITY / AUTHORITY BOUNDARY</span><h3>{english ? "What this surface may and may not claim" : "这个产品面能够与不能声明什么"}</h3></div></header>
        <div className="fouiAgronomyCapabilityTable">
          {capabilities.map((capability) => (
            <article key={capability.key}>
              <div><strong>{capability.label}</strong><small>{capability.reason}</small></div>
              <CapabilityStatus status={capability.status} />
            </article>
          ))}
        </div>
        <div className="fouiBoundaryFlow">
          <div><span>01</span><strong>Field State</strong><small>MCFT / Operator projection</small></div>
          <i>→</i>
          <div><span>02</span><strong>Agronomic Judgment</strong><small>ADR when authoritative</small></div>
          <i>→</i>
          <div><span>03</span><strong>Human Approval</strong><small>B-Line</small></div>
          <i>→</i>
          <div><span>04</span><strong>Execution</strong><small>B-Line</small></div>
        </div>
      </section>
    </div>
  );
}
