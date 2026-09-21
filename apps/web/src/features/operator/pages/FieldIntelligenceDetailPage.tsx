import React from "react";
import { Link, useParams, useSearchParams } from "react-router-dom";
import {
  isMcftApiError,
  resolveMcftRuntimeScope,
  type McftApiErrorV1,
  type McftCollectionItemV1,
  type McftCollectionPageV1,
  type McftRuntimeHealthV1,
  type McftRuntimeReadModelV1,
  type McftTimelinePageV1,
  type McftTraceGraphV1,
} from "../../../api/mcftFieldTwinRuntime";
import {
  readFouiMcftActionLifecycle,
  readFouiMcftForecasts,
  readFouiMcftHealth,
  readFouiMcftModelGovernance,
  readFouiMcftResiduals,
  readFouiMcftRuntime,
  readFouiMcftScenarios,
  readFouiMcftStates,
  readFouiMcftTimeline,
  readFouiMcftTrace,
} from "../../../api/fouiFieldIntelligence";
import { useLocale } from "../../../lib/locale";
import { buildFieldIntelligenceOverviewVmV1 } from "../../../viewmodels/mcftFieldIntelligenceVm";
import {
  buildFieldDataUtilizationV2,
  extractScalarFactsV2,
  findExactCollectionItemV2,
  type FieldExperienceDatasetV2,
} from "../../../viewmodels/fouiFieldExperienceVm";
import "../../../styles/fouiFieldOperations.css";

type CoreLoadState =
  | { status: "loading" }
  | { status: "ready"; runtime: McftRuntimeReadModelV1; states: McftCollectionPageV1; forecasts: McftCollectionPageV1 }
  | { status: "error"; error: McftApiErrorV1 };

type LazyState<T> =
  | { status: "idle" }
  | { status: "loading" }
  | { status: "ready"; data: T }
  | { status: "error"; error: McftApiErrorV1 };

type HistoryBundle = { timeline: McftTimelinePageV1 };
type EvidenceBundle = { trace: McftTraceGraphV1; health: McftRuntimeHealthV1 };
type AdvancedBundle = {
  scenarios: McftCollectionPageV1;
  actionLifecycle: McftCollectionPageV1;
  residuals: McftCollectionPageV1;
  calibration: McftCollectionPageV1;
  shadowEvaluation: McftCollectionPageV1;
  modelActivation: McftCollectionPageV1;
};

function json(value: unknown): string {
  try { return JSON.stringify(value, null, 2); } catch { return String(value ?? "—"); }
}

function text(value: unknown): string {
  return typeof value === "string" ? value.trim() : String(value ?? "").trim();
}

function recordField(item: Record<string, unknown>, ...keys: string[]): string {
  for (const key of keys) {
    const value = text(item[key]);
    if (value) return value;
  }
  return "—";
}

function normalizeError(reason: unknown): McftApiErrorV1 {
  if (isMcftApiError(reason)) return reason;
  return {
    schema_version: "mcft_field_twin_api_error_v1",
    status: 0,
    error_code: reason instanceof Error ? reason.message : "MCFT_RUNTIME_READ_FAILED",
    failed_profiles: [],
    diagnostics: [],
    request_id: "NOT_PROVIDED",
    url: "—",
  };
}

function SourceDisclosure({ title, value }: { title: string; value: unknown }): React.ReactElement {
  return (
    <details className="fouiCanonicalDisclosure">
      <summary>{title}</summary>
      <p>Lossless readback of the authenticated canonical GET response.</p>
      <pre>{json(value)}</pre>
    </details>
  );
}

function ScalarFacts({ item, english }: { item: McftCollectionItemV1 | null; english: boolean }): React.ReactElement {
  const facts = extractScalarFactsV2(item);
  if (!item) return <p className="fouiMuted">{english ? "Exact referenced record is not present in this bounded page." : "当前有 exact ref，但该 bounded page 未返回对应记录。"}</p>;
  if (!facts.length) return <p className="fouiMuted">{english ? "No additional scalar product facts were returned." : "该记录未返回额外可直接展示的标量字段。"}</p>;
  return (
    <dl className="fouiFactGrid">
      {facts.map((fact) => <div key={fact.key}><dt>{fact.label}</dt><dd>{fact.value}</dd></div>)}
    </dl>
  );
}

function DatasetRow({ dataset, english }: { dataset: FieldExperienceDatasetV2; english: boolean }): React.ReactElement {
  return (
    <article className="fouiDatasetRow">
      <div>
        <strong>{dataset.label}</strong>
        <small>{dataset.canonical_endpoint}</small>
      </div>
      <span className="fouiStatePill">{dataset.mode}</span>
      <div className="fouiDatasetStatus">
        <strong>{dataset.status}</strong>
        <small>{dataset.count === null ? "count n/a" : `count ${dataset.count}`}{dataset.reason_code ? ` · ${dataset.reason_code}` : ""}</small>
      </div>
    </article>
  );
}

function CollectionSummary({
  title,
  page,
  english,
}: {
  title: string;
  page: McftCollectionPageV1;
  english: boolean;
}): React.ReactElement {
  return (
    <article className="fouiDeepDataCard">
      <div className="fouiDeepDataCard__head">
        <div><span className="fouiEyebrow">{page.collection_kind}</span><h4>{title}</h4></div>
        <strong>{page.items.length}</strong>
      </div>
      <p>{english ? "Bounded canonical page. Count shown here is not an inferred global total." : "这是 bounded canonical page；这里的数量不是推断出的全局总数。"}</p>
      <div className="fouiDeepList">
        {page.items.slice(0, 5).map((item) => (
          <div key={`${item.object_ref}:${item.object_hash}`}>
            <strong>{item.object_ref}</strong>
            <small>{item.object_type} · {item.logical_time} · {item.attachment_status}</small>
          </div>
        ))}
        {!page.items.length ? <span className="fouiMuted">NO_ITEMS_RETURNED</span> : null}
      </div>
      <SourceDisclosure title={english ? "Full canonical collection" : "完整 canonical collection"} value={page} />
    </article>
  );
}

export default function FieldIntelligenceDetailPage(): React.ReactElement {
  const { locale } = useLocale();
  const english = locale === "en-US";
  const params = useParams();
  const [searchParams] = useSearchParams();
  const fieldId = String(params.fieldId || "").trim();
  const query = searchParams.toString();
  const scopeResolution = React.useMemo(
    () => resolveMcftRuntimeScope(fieldId, new URLSearchParams(query)),
    [fieldId, query],
  );
  const [core, setCore] = React.useState<CoreLoadState>({ status: "loading" });
  const [history, setHistory] = React.useState<LazyState<HistoryBundle>>({ status: "idle" });
  const [evidence, setEvidence] = React.useState<LazyState<EvidenceBundle>>({ status: "idle" });
  const [advanced, setAdvanced] = React.useState<LazyState<AdvancedBundle>>({ status: "idle" });

  const scopeKey = scopeResolution.ok ? Object.values(scopeResolution.scope).join("|") : scopeResolution.missing_keys.join("|");

  React.useEffect(() => {
    let active = true;
    setHistory({ status: "idle" });
    setEvidence({ status: "idle" });
    setAdvanced({ status: "idle" });
    if (!scopeResolution.ok) return () => { active = false; };
    setCore({ status: "loading" });
    Promise.all([
      readFouiMcftRuntime(scopeResolution.scope),
      readFouiMcftStates(scopeResolution.scope),
      readFouiMcftForecasts(scopeResolution.scope),
    ]).then(([runtime, states, forecasts]) => {
      if (active) setCore({ status: "ready", runtime, states, forecasts });
    }).catch((reason: unknown) => {
      if (active) setCore({ status: "error", error: normalizeError(reason) });
    });
    return () => { active = false; };
  }, [scopeKey]);

  if (!scopeResolution.ok) {
    return (
      <div className="fouiPage">
        <section className="fouiPanel">
          <span className="fouiEyebrow">FIELD INTELLIGENCE</span>
          <h2>{english ? "Exact scope required" : "需要精确范围"}</h2>
          <p>{english ? `Missing: ${scopeResolution.missing_keys.join(", ")}. No MCFT request has been issued.` : `缺少：${scopeResolution.missing_keys.join("、")}。前端尚未向 MCFT 发出请求。`}</p>
          <Link className="fouiPrimaryLink" to={`/operator/field-intelligence?field_id=${encodeURIComponent(fieldId)}`}>{english ? "Resolve scope" : "补齐范围"}</Link>
        </section>
      </div>
    );
  }

  const scope = scopeResolution.scope;
  const canonicalBase = `/operator/fields/${encodeURIComponent(fieldId)}?${query}`;

  async function loadHistory(): Promise<void> {
    if (history.status === "loading" || history.status === "ready") return;
    setHistory({ status: "loading" });
    try {
      const timeline = await readFouiMcftTimeline(scope);
      setHistory({ status: "ready", data: { timeline } });
    } catch (reason) {
      setHistory({ status: "error", error: normalizeError(reason) });
    }
  }

  async function loadEvidence(): Promise<void> {
    if (evidence.status === "loading" || evidence.status === "ready") return;
    setEvidence({ status: "loading" });
    try {
      const [trace, health] = await Promise.all([readFouiMcftTrace(scope), readFouiMcftHealth(scope)]);
      setEvidence({ status: "ready", data: { trace, health } });
    } catch (reason) {
      setEvidence({ status: "error", error: normalizeError(reason) });
    }
  }

  async function loadAdvanced(): Promise<void> {
    if (advanced.status === "loading" || advanced.status === "ready") return;
    setAdvanced({ status: "loading" });
    try {
      const [scenarios, actionLifecycle, residuals, calibration, shadowEvaluation, modelActivation] = await Promise.all([
        readFouiMcftScenarios(scope),
        readFouiMcftActionLifecycle(scope),
        readFouiMcftResiduals(scope),
        readFouiMcftModelGovernance(scope, "CALIBRATION_CANDIDATE"),
        readFouiMcftModelGovernance(scope, "SHADOW_EVALUATION"),
        readFouiMcftModelGovernance(scope, "MODEL_ACTIVATION"),
      ]);
      setAdvanced({ status: "ready", data: { scenarios, actionLifecycle, residuals, calibration, shadowEvaluation, modelActivation } });
    } catch (reason) {
      setAdvanced({ status: "error", error: normalizeError(reason) });
    }
  }

  if (core.status === "loading") return <div className="fouiPage"><div className="fouiEmpty">{english ? "Loading canonical field data…" : "正在读取规范田块数据…"}</div></div>;
  if (core.status === "error") return <div className="fouiPage"><div className="fouiBoundaryNotice fouiBoundaryNotice--error">{core.error.error_code} · {core.error.diagnostics.join(" | ")}</div></div>;

  const vm = buildFieldIntelligenceOverviewVmV1(core.runtime);
  const datasets = buildFieldDataUtilizationV2(core.runtime, core.states, core.forecasts);
  const exactState = findExactCollectionItemV2(core.states, core.runtime.posterior_state?.object_ref);
  const exactForecast = findExactCollectionItemV2(core.forecasts, core.runtime.current_tick_forecast_result?.object_ref);

  return (
    <div className="fouiPage fouiFieldIntelligence fouiFieldExperienceV2" data-foui-surface="field-intelligence-detail-v2">
      <section className="fouiHero fouiFieldHero">
        <div>
          <span className="fouiEyebrow">FIELD INTELLIGENCE / CURRENT WORLD</span>
          <h2>{fieldId}</h2>
          <p>{english ? "Current field reality first. Exact MCFT refs remain intact; deeper evidence, history, and model data load only when requested." : "先看当前田块现实。MCFT exact refs 完整保留；历史、证据与模型数据只在需要时读取。"}</p>
          <div className="fouiFieldScopeLine">
            <span>{scope.season_id}</span><span>{scope.zone_id}</span><span>{core.runtime.response_started_at}</span>
          </div>
        </div>
        <div className="fouiHeroActions">
          <Link className="fouiSecondaryLink" to={canonicalBase}>{english ? "Canonical technical view" : "规范技术视图"}</Link>
          <Link className="fouiSecondaryLink" to="/operator/agronomy">{english ? "Agronomy" : "农艺"}</Link>
          <Link className="fouiSecondaryLink" to="/operator/operations">{english ? "Operations" : "运营"}</Link>
        </div>
      </section>

      <section className="fouiFieldSignalStrip">
        <article>
          <span>{english ? "Field state" : "田块状态"}</span>
          <strong>{core.runtime.posterior_state?.object_ref || "ABSENT"}</strong>
          <small>{exactState ? `EXACT LINKED · ${exactState.logical_time}` : "EXACT REF ONLY"}</small>
        </article>
        <article>
          <span>{english ? "Forecast" : "预测"}</span>
          <strong>{core.runtime.current_tick_forecast_result?.object_ref || "ABSENT"}</strong>
          <small>{exactForecast ? `EXACT LINKED · ${exactForecast.logical_time}` : "EXACT REF ONLY"}</small>
        </article>
        <article>
          <span>{english ? "Known limitations" : "已知限制"}</span>
          <strong>{vm.limitation_count}</strong>
          <small>{vm.validation_count} validation records</small>
        </article>
        <article>
          <span>{english ? "Root graph" : "根图状态"}</span>
          <strong>{vm.root_graph_status}</strong>
          <small>{vm.root_ref_count}/{vm.root_ref_expected} refs present</small>
        </article>
      </section>

      <div className="fouiFieldExperienceGrid">
        <section className="fouiPanel fouiFieldCurrentCard">
          <header className="fouiPanelHeader"><div><span className="fouiEyebrow">CURRENT STATE</span><h3>{english ? "What is established now" : "当前能够成立的田块状态"}</h3></div></header>
          <div className="fouiCurrentObject">
            <div><span>object_ref</span><strong>{core.runtime.posterior_state?.object_ref || "ABSENT"}</strong></div>
            <div><span>object_type</span><strong>{core.runtime.posterior_state?.object_type || "—"}</strong></div>
            <div><span>logical_time</span><strong>{exactState?.logical_time || "NOT_IN_PAGE"}</strong></div>
            <div><span>source_fact_ref</span><strong>{core.runtime.posterior_state?.source_fact_ref || "—"}</strong></div>
          </div>
          <ScalarFacts item={exactState} english={english} />
          <SourceDisclosure title={english ? "Exact state record" : "精确 State record"} value={exactState ?? core.runtime.posterior_state} />
        </section>

        <section className="fouiPanel fouiFieldForecastCard">
          <header className="fouiPanelHeader"><div><span className="fouiEyebrow">FORECAST</span><h3>{english ? "Current forecast context" : "当前预测上下文"}</h3></div></header>
          <div className="fouiCurrentObject">
            <div><span>current_tick_forecast</span><strong>{core.runtime.current_tick_forecast_result?.object_ref || "ABSENT"}</strong></div>
            <div><span>latest_successful</span><strong>{core.runtime.latest_successful_forecast.item?.object_ref || "ABSENT"}</strong></div>
            <div><span>scenario_source</span><strong>{core.runtime.scenario_source_forecast.item?.object_ref || "ABSENT"}</strong></div>
            <div><span>logical_time</span><strong>{exactForecast?.logical_time || "NOT_IN_PAGE"}</strong></div>
          </div>
          <ScalarFacts item={exactForecast} english={english} />
          <SourceDisclosure title={english ? "Exact forecast record" : "精确 Forecast record"} value={exactForecast ?? core.runtime.current_tick_forecast_result} />
        </section>
      </div>

      <section className="fouiPanel">
        <header className="fouiPanelHeader">
          <div><span className="fouiEyebrow">FIELD CHANGE CHAIN</span><h3>{english ? "Evidence → transition → assimilation → current state" : "证据 → 状态转移 → 同化 → 当前状态"}</h3></div>
        </header>
        <div className="fouiRuntimeFlow">
          {[
            ["01", english ? "Evidence window" : "证据窗口", core.runtime.evidence_window],
            ["02", english ? "State transition" : "状态转移", core.runtime.state_transition],
            ["03", english ? "Assimilation" : "同化更新", core.runtime.assimilation_update],
            ["04", english ? "Posterior state" : "后验状态", core.runtime.posterior_state],
          ].map(([order,label,value]) => {
            const ref = value as McftRuntimeReadModelV1["posterior_state"];
            return <article key={String(order)}><span>{String(order)}</span><strong>{String(label)}</strong><small>{ref?.object_ref || "ABSENT"}</small><small>{ref?.object_hash || "—"}</small></article>;
          })}
        </div>
      </section>

      <section className="fouiPanel">
        <header className="fouiPanelHeader"><div><span className="fouiEyebrow">LIMITATIONS / VALIDATION</span><h3>{english ? "What this read can and cannot establish" : "这次读取能够与不能建立什么"}</h3></div></header>
        <div className="fouiDataPair">
          <article><strong>{english ? "Limitations" : "限制"}</strong>{vm.limitations.length ? vm.limitations.map((item,index) => <pre key={index}>{json(item)}</pre>) : <small>NONE_RETURNED</small>}</article>
          <article><strong>{english ? "Validation summary" : "验证摘要"}</strong>{vm.validation_summary.length ? vm.validation_summary.map((item,index) => <pre key={index}>{json(item)}</pre>) : <small>NONE_RETURNED</small>}</article>
        </div>
      </section>

      <section className="fouiPanel">
        <header className="fouiPanelHeader"><div><span className="fouiEyebrow">DATA UTILIZATION</span><h3>{english ? "Every canonical dataset has a place" : "每一组 canonical 数据都有去向"}</h3><p>{english ? "Eager data supports the daily field view. Deeper datasets remain product-accessible on demand instead of being discarded or fetched on every visit." : "首屏数据服务日常田块判断；更深层数据按需进入产品，而不是被丢弃或每次打开都全量请求。"}</p></div></header>
        <div className="fouiDatasetTable">{datasets.map((dataset) => <DatasetRow key={dataset.key} dataset={dataset} english={english} />)}</div>
      </section>

      <section className="fouiFieldExploreGrid">
        <article className="fouiExploreCard">
          <span className="fouiEyebrow">RECENT CHANGES</span>
          <h3>{english ? "History & timeline" : "历史与变化"}</h3>
          <p>{english ? "Load the canonical timeline only when you need to understand what changed." : "需要理解田块发生了什么变化时，再读取 canonical timeline。"}</p>
          <button className="fouiButton" type="button" onClick={() => void loadHistory()} disabled={history.status === "loading"}>{history.status === "ready" ? (english ? "Loaded" : "已加载") : history.status === "loading" ? (english ? "Loading…" : "加载中…") : (english ? "Load history" : "读取历史")}</button>
          {history.status === "error" ? <div className="fouiBoundaryNotice fouiBoundaryNotice--error">{history.error.error_code}</div> : null}
          {history.status === "ready" ? (
            <div className="fouiTimelineList">
              {history.data.timeline.items.slice(0, 8).map((item,index) => <div key={`${recordField(item,"event_ref","object_ref")}:${index}`}><strong>{recordField(item,"event_type","event_kind","type")}</strong><span>{recordField(item,"logical_time","occurred_at","created_at")}</span><small>{recordField(item,"object_ref","event_ref","source_ref")} · {recordField(item,"role","attachment_status","status")}</small></div>)}
              {!history.data.timeline.items.length ? <span className="fouiMuted">NO_TIMELINE_ITEMS</span> : null}
              <SourceDisclosure title={english ? "Full canonical timeline" : "完整 canonical timeline"} value={history.data.timeline} />
            </div>
          ) : null}
        </article>

        <article className="fouiExploreCard">
          <span className="fouiEyebrow">EVIDENCE / PROVENANCE</span>
          <h3>{english ? "Trace & runtime health" : "证据链与运行健康"}</h3>
          <p>{english ? "Load trace edges, nodes, and health roles without changing the current field-state view." : "按需读取 trace nodes/edges 与 health roles，不改变当前田块状态。"}</p>
          <button className="fouiButton" type="button" onClick={() => void loadEvidence()} disabled={evidence.status === "loading"}>{evidence.status === "ready" ? (english ? "Loaded" : "已加载") : evidence.status === "loading" ? (english ? "Loading…" : "加载中…") : (english ? "Load evidence" : "读取证据")}</button>
          {evidence.status === "error" ? <div className="fouiBoundaryNotice fouiBoundaryNotice--error">{evidence.error.error_code}</div> : null}
          {evidence.status === "ready" ? (
            <div className="fouiEvidenceSummary">
              <div><span>{english ? "Trace nodes" : "Trace 节点"}</span><strong>{evidence.data.trace.nodes.length}</strong></div>
              <div><span>{english ? "Trace edges" : "Trace 边"}</span><strong>{evidence.data.trace.edges.length}</strong></div>
              <div><span>{english ? "Health relationship" : "健康关系"}</span><strong>{evidence.data.health.health_relationship}</strong></div>
              <SourceDisclosure title={english ? "Full canonical trace" : "完整 canonical trace"} value={evidence.data.trace} />
              <SourceDisclosure title={english ? "Full canonical health" : "完整 canonical health"} value={evidence.data.health} />
            </div>
          ) : null}
        </article>

        <article className="fouiExploreCard">
          <span className="fouiEyebrow">ADVANCED FIELD DATA</span>
          <h3>{english ? "Scenario, action, residual & model governance" : "情景、行动、残差与模型治理"}</h3>
          <p>{english ? "These datasets stay available in the product but are not paid for on every field visit." : "这些数据继续进入产品，但不会在每次打开田块时都发请求。"}</p>
          <button className="fouiButton" type="button" onClick={() => void loadAdvanced()} disabled={advanced.status === "loading"}>{advanced.status === "ready" ? (english ? "Loaded" : "已加载") : advanced.status === "loading" ? (english ? "Loading…" : "加载中…") : (english ? "Load advanced data" : "读取高级数据")}</button>
          {advanced.status === "error" ? <div className="fouiBoundaryNotice fouiBoundaryNotice--error">{advanced.error.error_code}</div> : null}
        </article>
      </section>

      {advanced.status === "ready" ? (
        <section className="fouiAdvancedDataGrid">
          <CollectionSummary title={english ? "Scenarios" : "情景"} page={advanced.data.scenarios} english={english} />
          <CollectionSummary title={english ? "Action lifecycle" : "行动生命周期"} page={advanced.data.actionLifecycle} english={english} />
          <CollectionSummary title={english ? "Forecast residuals" : "预测残差"} page={advanced.data.residuals} english={english} />
          <CollectionSummary title={english ? "Calibration candidates" : "校准候选"} page={advanced.data.calibration} english={english} />
          <CollectionSummary title={english ? "Shadow evaluation" : "影子评估"} page={advanced.data.shadowEvaluation} english={english} />
          <CollectionSummary title={english ? "Model activation" : "模型激活"} page={advanced.data.modelActivation} english={english} />
        </section>
      ) : null}

      <section className="fouiPanel">
        <header className="fouiPanelHeader"><div><span className="fouiEyebrow">CANONICAL READBACK</span><h3>{english ? "Product presentation never destroys source data" : "产品展示不会破坏来源数据"}</h3></div></header>
        <div className="fouiContentIdentity">
          <div><span>root_graph_content_hash</span><strong>{vm.content_identity.root_graph_content_hash}</strong></div>
          <div><span>attachment_content_hash</span><strong>{vm.content_identity.attachment_content_hash}</strong></div>
          <div><span>response_instance_hash</span><strong>{vm.content_identity.response_instance_hash}</strong></div>
          <div><span>response_started_at</span><strong>{vm.response_started_at}</strong></div>
        </div>
        <SourceDisclosure title={english ? "Full runtime response" : "完整 Runtime 响应"} value={core.runtime} />
        <SourceDisclosure title={english ? "Full state collection" : "完整 State 集合"} value={core.states} />
        <SourceDisclosure title={english ? "Full forecast collection" : "完整 Forecast 集合"} value={core.forecasts} />
      </section>
    </div>
  );
}
