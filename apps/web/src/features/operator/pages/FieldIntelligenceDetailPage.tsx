import React from "react";
import { Link, useParams, useSearchParams } from "react-router-dom";
import {
  isMcftApiError,
  resolveMcftRuntimeScope,
  type McftApiErrorV1,
  type McftCollectionPageV1,
  type McftRuntimeReadModelV1,
} from "../../../api/mcftFieldTwinRuntime";
import {
  readFouiMcftForecasts,
  readFouiMcftRuntime,
  readFouiMcftStates,
} from "../../../api/fouiFieldIntelligence";
import { useLocale } from "../../../lib/locale";
import { buildFieldIntelligenceOverviewVmV1 } from "../../../viewmodels/mcftFieldIntelligenceVm";
import "../../../styles/fouiFieldOperations.css";

type LoadState =
  | { status: "loading" }
  | { status: "ready"; runtime: McftRuntimeReadModelV1; states: McftCollectionPageV1; forecasts: McftCollectionPageV1 }
  | { status: "error"; error: McftApiErrorV1 };

function json(value: unknown): string {
  try { return JSON.stringify(value, null, 2); } catch { return String(value ?? "—"); }
}

function SourceDisclosure({ title, value }: { title: string; value: unknown }): React.ReactElement {
  return <details className="fouiCanonicalDisclosure"><summary>{title}</summary><p>Lossless readback of the authenticated canonical GET response.</p><pre>{json(value)}</pre></details>;
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
  const [loadState, setLoadState] = React.useState<LoadState>({ status: "loading" });

  React.useEffect(() => {
    let active = true;
    if (!scopeResolution.ok) return () => { active = false; };
    setLoadState({ status: "loading" });
    Promise.all([
      readFouiMcftRuntime(scopeResolution.scope),
      readFouiMcftStates(scopeResolution.scope),
      readFouiMcftForecasts(scopeResolution.scope),
    ]).then(([runtime, states, forecasts]) => {
      if (active) setLoadState({ status: "ready", runtime, states, forecasts });
    }).catch((reason: unknown) => {
      if (!active) return;
      const error: McftApiErrorV1 = isMcftApiError(reason)
        ? reason
        : { schema_version: "mcft_field_twin_api_error_v1", status: 0, error_code: reason instanceof Error ? reason.message : "MCFT_RUNTIME_READ_FAILED", failed_profiles: [], diagnostics: [], request_id: "NOT_PROVIDED", url: "—" };
      setLoadState({ status: "error", error });
    });
    return () => { active = false; };
  }, [scopeResolution.ok ? Object.values(scopeResolution.scope).join("|") : scopeResolution.missing_keys.join("|")]);

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

  const canonicalBase = `/operator/fields/${encodeURIComponent(fieldId)}?${query}`;

  if (loadState.status === "loading") return <div className="fouiPage"><div className="fouiEmpty">{english ? "Loading canonical field data…" : "正在读取规范田块数据…"}</div></div>;
  if (loadState.status === "error") return <div className="fouiPage"><div className="fouiBoundaryNotice fouiBoundaryNotice--error">{loadState.error.error_code} · {loadState.error.diagnostics.join(" | ")}</div></div>;

  const vm = buildFieldIntelligenceOverviewVmV1(loadState.runtime);
  const latestState = loadState.states.items[0] ?? null;
  const latestForecast = loadState.forecasts.items[0] ?? null;

  return (
    <div className="fouiPage fouiFieldIntelligence" data-foui-surface="field-intelligence-detail">
      <section className="fouiHero fouiFieldHero">
        <div>
          <span className="fouiEyebrow">FIELD INTELLIGENCE / CURRENT WORLD</span>
          <h2>{fieldId}</h2>
          <p>{english ? "A product view over the canonical MCFT read model. No source ref, hash, limitation, or validation record is replaced by presentation." : "这是 canonical MCFT 读模型之上的产品视图。展示层不会替换任何 source ref、hash、limitation 或 validation record。"}</p>
        </div>
        <div className="fouiHeroActions">
          <Link className="fouiSecondaryLink" to={canonicalBase}>{english ? "Canonical technical view" : "规范技术视图"}</Link>
          <Link className="fouiSecondaryLink" to="/operator/agronomy">{english ? "Agronomy" : "农艺"}</Link>
        </div>
      </section>

      <section className="fouiMetricGrid">
        <article className="fouiMetricCard"><span>{english ? "Root graph" : "根图状态"}</span><strong>{vm.root_graph_status}</strong><small>{vm.root_ref_count}/{vm.root_ref_expected} refs present</small></article>
        <article className="fouiMetricCard"><span>{english ? "State records" : "状态记录"}</span><strong>{loadState.states.items.length}</strong><small>{loadState.states.collection_kind}</small></article>
        <article className="fouiMetricCard"><span>{english ? "Forecast records" : "预测记录"}</span><strong>{loadState.forecasts.items.length}</strong><small>{loadState.forecasts.collection_kind}</small></article>
        <article className="fouiMetricCard"><span>{english ? "Limitations" : "限制"}</span><strong>{vm.limitation_count}</strong><small>{vm.validation_count} validation records</small></article>
      </section>

      <div className="fouiDashboardGrid">
        <section className="fouiPanel fouiPanel--wide">
          <header className="fouiPanelHeader"><div><span className="fouiEyebrow">CURRENT STATE</span><h3>{english ? "Current field chain" : "当前田块状态链"}</h3></div></header>
          <div className="fouiRuntimeFlow">
            {[
              ["01", english ? "Evidence window" : "证据窗口", loadState.runtime.evidence_window],
              ["02", english ? "State transition" : "状态转移", loadState.runtime.state_transition],
              ["03", english ? "Assimilation" : "同化更新", loadState.runtime.assimilation_update],
              ["04", english ? "Posterior state" : "后验状态", loadState.runtime.posterior_state],
            ].map(([order,label,value]) => {
              const ref = value as any;
              return <article key={String(order)}><span>{String(order)}</span><strong>{String(label)}</strong><small>{ref?.object_ref || "ABSENT"}</small><small>{ref?.object_hash || "—"}</small></article>;
            })}
          </div>
          <div className="fouiDataPair">
            <article><span className="fouiEyebrow">{english ? "Latest state record" : "最新状态记录"}</span><strong>{latestState?.object_ref || "ABSENT"}</strong><p>{latestState ? `${latestState.object_type} · ${latestState.logical_time}` : (english ? "No state item returned." : "未返回状态条目。")}</p></article>
            <article><span className="fouiEyebrow">{english ? "Current forecast" : "当前预测"}</span><strong>{loadState.runtime.current_tick_forecast_result?.object_ref || "ABSENT"}</strong><p>{latestForecast ? `${latestForecast.object_type} · ${latestForecast.logical_time}` : (english ? "No forecast item returned." : "未返回预测条目。")}</p></article>
          </div>
        </section>

        <section className="fouiPanel">
          <header className="fouiPanelHeader"><div><span className="fouiEyebrow">ATTACHMENTS</span><h3>{english ? "Decision & action context" : "决策与行动上下文"}</h3></div></header>
          <div className="fouiRefList">
            {[
              [english ? "Latest forecast" : "最近成功预测", loadState.runtime.latest_successful_forecast],
              [english ? "Current scenario" : "当前情景", loadState.runtime.current_scenario_attachment],
              [english ? "Human decision" : "人工决策", loadState.runtime.current_human_decision],
              [english ? "Approved plan" : "已批准计划", loadState.runtime.current_approved_plan],
            ].map(([label,value]) => {
              const attachment = value as any;
              return <article key={String(label)}><span>{String(label)}</span><strong>{attachment?.attachment_status || "NOT_RETURNED"}</strong><small>{attachment?.reason_code || "—"}</small><small>{attachment?.item?.object_ref || "—"}</small></article>;
            })}
          </div>
        </section>
      </div>

      <section className="fouiPanel">
        <header className="fouiPanelHeader"><div><span className="fouiEyebrow">LIMITATIONS / VALIDATION</span><h3>{english ? "What the current read can and cannot establish" : "当前读取能够与不能建立的内容"}</h3></div></header>
        <div className="fouiDataPair">
          <article><strong>{english ? "Limitations" : "限制"}</strong>{vm.limitations.length ? vm.limitations.map((item,index) => <pre key={index}>{json(item)}</pre>) : <small>NONE_RETURNED</small>}</article>
          <article><strong>{english ? "Validation summary" : "验证摘要"}</strong>{vm.validation_summary.length ? vm.validation_summary.map((item,index) => <pre key={index}>{json(item)}</pre>) : <small>NONE_RETURNED</small>}</article>
        </div>
      </section>

      <section className="fouiPanel">
        <header className="fouiPanelHeader"><div><span className="fouiEyebrow">ON-DEMAND CANONICAL DATASETS</span><h3>{english ? "Load deeper data only when needed" : "更深层数据按需读取"}</h3></div></header>
        <div className="fouiCapabilityLinks fouiCapabilityLinks--four">
          {[
            ["State", ""],
            ["Forecast", "/forecast"],
            ["Scenario", "/scenario"],
            ["Action lifecycle", "/action-lifecycle"],
            ["Residual", "/residual"],
            ["Calibration", "/calibration"],
            ["Evidence / Trace", "/evidence-trace"],
            ["Health", "/health"],
          ].map(([label,path]) => <Link key={label} to={`/operator/fields/${encodeURIComponent(fieldId)}${path}?${query}`}><strong>{label}</strong><small>{english ? "Canonical GET-only technical readback" : "Canonical GET-only 技术回查"}</small></Link>)}
        </div>
      </section>

      <section className="fouiPanel">
        <header className="fouiPanelHeader"><div><span className="fouiEyebrow">CANONICAL DATA</span><h3>{english ? "Nothing is thrown away" : "后端数据不丢弃"}</h3></div></header>
        <div className="fouiContentIdentity">
          <div><span>root_graph_content_hash</span><strong>{vm.content_identity.root_graph_content_hash}</strong></div>
          <div><span>attachment_content_hash</span><strong>{vm.content_identity.attachment_content_hash}</strong></div>
          <div><span>response_instance_hash</span><strong>{vm.content_identity.response_instance_hash}</strong></div>
          <div><span>response_started_at</span><strong>{vm.response_started_at}</strong></div>
        </div>
        <SourceDisclosure title={english ? "Full runtime response" : "完整 Runtime 响应"} value={loadState.runtime} />
        <SourceDisclosure title={english ? "Full state collection" : "完整 State 集合"} value={loadState.states} />
        <SourceDisclosure title={english ? "Full forecast collection" : "完整 Forecast 集合"} value={loadState.forecasts} />
      </section>
    </div>
  );
}
