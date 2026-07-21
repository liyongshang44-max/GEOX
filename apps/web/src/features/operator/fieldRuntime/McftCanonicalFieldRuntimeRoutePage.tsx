// Purpose: render the MCFT-CAP-07 S5 canonical Operator Field Runtime integration.
// Boundary: canonical S4 GET-only responses only; no legacy truth fallback, numeric confidence, recommendation, approval, dispatch, activation, or persistence.

import React from "react";
import { NavLink, useParams, useSearchParams } from "react-router-dom";
import {
  isMcftApiError,
  loadMcftCanonicalTab,
  resolveMcftRuntimeScope,
  type McftApiErrorV1,
  type McftAttachmentV1,
  type McftCanonicalRefV1,
  type McftCanonicalTabKey,
  type McftCollectionPageV1,
  type McftCollectionSummaryV1,
  type McftFieldTwinScopeV1,
  type McftRuntimeReadModelV1,
  type McftTabBundleV1,
} from "../../../api/mcftFieldTwinRuntime";
import { useLocale } from "../../../lib/locale";
import "../../../styles/operatorFieldRuntime.css";

export type McftCanonicalFieldRuntimeRouteKey = McftCanonicalTabKey | "fields" | "evidence" | "audit";
type Props = { tab: McftCanonicalFieldRuntimeRouteKey };

type LoadState =
  | { status: "idle" }
  | { status: "loading" }
  | { status: "ready"; bundle: McftTabBundleV1 }
  | { status: "error"; error: McftApiErrorV1 };

type TabDefinition = {
  key: McftCanonicalTabKey;
  path: string;
  zh: string;
  en: string;
};

const TABS: TabDefinition[] = [
  { key: "overview", path: "", zh: "总览", en: "Overview" },
  { key: "state", path: "state", zh: "状态", en: "State" },
  { key: "forecast", path: "forecast", zh: "预测", en: "Forecast" },
  { key: "scenario", path: "scenario", zh: "情景", en: "Scenario" },
  { key: "action-lifecycle", path: "action-lifecycle", zh: "行动生命周期", en: "Action Lifecycle" },
  { key: "residual", path: "residual", zh: "残差验证", en: "Residual Verification" },
  { key: "calibration", path: "calibration", zh: "校准", en: "Calibration" },
  { key: "evidence-trace", path: "evidence-trace", zh: "证据 / 追踪", en: "Evidence / Trace" },
  { key: "health", path: "health", zh: "健康", en: "Health" },
];

const MANDATORY_ROOTS: Array<[string, keyof McftRuntimeReadModelV1]> = [
  ["Active Lineage", "active_lineage"],
  ["Checkpoint", "checkpoint"],
  ["Runtime Tick", "runtime_tick"],
  ["Evidence Window", "evidence_window"],
  ["State Transition", "state_transition"],
  ["Assimilation Update", "assimilation_update"],
  ["Posterior State", "posterior_state"],
  ["Terminal Record-Set Health", "terminal_record_set_health"],
  ["Runtime Config", "runtime_config"],
];

function normalizeTab(tab: McftCanonicalFieldRuntimeRouteKey): McftCanonicalTabKey | "fields" {
  if (tab === "evidence" || tab === "audit") return "evidence-trace";
  return tab;
}

function text(value: unknown, fallback = "—"): string {
  if (value === null || value === undefined || value === "") return fallback;
  return String(value);
}

function field(record: Record<string, unknown>, ...keys: string[]): string {
  for (const key of keys) {
    const value = record[key];
    if (value !== null && value !== undefined && value !== "") return String(value);
  }
  return "—";
}

function tabPath(fieldId: string, tab: TabDefinition, query: string): string {
  const base = tab.key === "overview"
    ? `/operator/fields/${encodeURIComponent(fieldId)}`
    : `/operator/fields/${encodeURIComponent(fieldId)}/${tab.path}`;
  return query ? `${base}?${query}` : base;
}

function Panel({ title, subtitle, children }: { title: string; subtitle?: string; children: React.ReactNode }): React.ReactElement {
  return (
    <section className="operatorFieldRuntime__panel">
      <header className="operatorFieldRuntime__panelHeader">
        <div>
          <h2 className="operatorFieldRuntime__panelTitle">{title}</h2>
          {subtitle ? <p className="operatorFieldRuntime__panelMeta">{subtitle}</p> : null}
        </div>
      </header>
      {children}
    </section>
  );
}

function RefCard({ label, value }: { label: string; value: McftCanonicalRefV1 | null | undefined }): React.ReactElement {
  return (
    <article className="operatorFieldRuntime__metricCard">
      <span>{label}</span>
      <strong>{value ? value.object_ref : "ABSENT"}</strong>
      <small>{value ? value.object_type : "No canonical object attached"}</small>
      <small>{value ? value.object_hash : "—"}</small>
      <small>source_fact_ref: {value?.source_fact_ref || "—"}</small>
    </article>
  );
}

function AttachmentCard({ label, attachment }: { label: string; attachment: McftAttachmentV1 | null | undefined }): React.ReactElement {
  const item = attachment?.item || null;
  return (
    <article className="operatorFieldRuntime__metricCard">
      <span>{label}</span>
      <strong>{attachment?.attachment_status || "NOT_RETURNED"}</strong>
      <small>reason_code: {attachment?.reason_code || "—"}</small>
      <small>object_ref: {item?.object_ref || "—"}</small>
      <small>object_hash: {item?.object_hash || "—"}</small>
    </article>
  );
}

function SummaryCard({ label, summary }: { label: string; summary: McftCollectionSummaryV1 | null | undefined }): React.ReactElement {
  return (
    <article className="operatorFieldRuntime__metricCard">
      <span>{label}</span>
      <strong>{summary?.attachment_status || "NOT_RETURNED"}</strong>
      <small>reason_code: {summary?.reason_code || "—"}</small>
      <small>count_status: {summary?.count_status || "—"}</small>
      <small>total_count: {summary?.total_count === null || summary?.total_count === undefined ? "NOT_COMPUTED" : summary.total_count}</small>
      <small>latest_item_ref: {summary?.latest_item_ref || "—"}</small>
    </article>
  );
}

function CollectionPanel({ title, page }: { title: string; page: McftCollectionPageV1 | undefined }): React.ReactElement {
  if (!page) return <Panel title={title}><p className="operatorFieldRuntime__panelMeta">Collection response was not requested for this tab.</p></Panel>;
  return (
    <Panel title={title} subtitle={`${page.collection_kind} / fixed_root_ref=${page.fixed_root_ref}`}>
      <div className="operatorFieldRuntime__summaryGrid">
        <article className="operatorFieldRuntime__metricCard"><span>Items</span><strong>{page.items.length}</strong><small>Bounded page, not inferred total</small></article>
        <article className="operatorFieldRuntime__metricCard"><span>Page limit</span><strong>{page.page_limit}</strong><small>has_more: {String(page.has_more)}</small></article>
        <article className="operatorFieldRuntime__metricCard"><span>Page hash</span><strong>{page.collection_page_content_hash}</strong><small>next_cursor: {page.next_cursor || "—"}</small></article>
      </div>
      <div className="operatorFieldRuntime__table">
        <div className="operatorFieldRuntime__tableHeader"><span>Object ref</span><span>Object type</span><span>Logical time</span><span>Attachment status</span></div>
        {page.items.map((item) => (
          <div className="operatorFieldRuntime__tableRow" key={`${item.object_ref}:${item.object_hash}`}>
            <span>{item.object_ref}<br /><small>{item.object_hash}</small></span>
            <span>{item.object_type}</span>
            <span>{item.logical_time}</span>
            <span>{item.attachment_status}</span>
          </div>
        ))}
      </div>
      {page.items.length === 0 ? <p className="operatorFieldRuntime__panelMeta">No visible canonical items in the exact scope.</p> : null}
    </Panel>
  );
}

function Overview({ runtime }: { runtime: McftRuntimeReadModelV1 }): React.ReactElement {
  return (
    <div className="operatorFieldRuntime__contentGrid">
      <Panel title="Current Runtime Root" subtitle={`root_graph_status=${runtime.root_graph_status}`}>
        <div className="operatorFieldRuntime__summaryGrid">
          {MANDATORY_ROOTS.map(([label, key]) => <RefCard key={String(key)} label={label} value={runtime[key] as McftCanonicalRefV1 | null | undefined} />)}
        </div>
      </Panel>
      <Panel title="Current Attachments" subtitle="Exact attachment status and reason codes">
        <div className="operatorFieldRuntime__summaryGrid">
          <RefCard label="Current Tick Forecast Result" value={runtime.current_tick_forecast_result} />
          <AttachmentCard label="Latest Successful Forecast" attachment={runtime.latest_successful_forecast} />
          <AttachmentCard label="Scenario Source Forecast" attachment={runtime.scenario_source_forecast} />
          <AttachmentCard label="Current Scenario" attachment={runtime.current_scenario_attachment} />
          <AttachmentCard label="Latest Scenario in Scope" attachment={runtime.latest_scenario_in_scope} />
          <AttachmentCard label="Current Human Decision" attachment={runtime.current_human_decision} />
          <AttachmentCard label="Current Approved Plan" attachment={runtime.current_approved_plan} />
        </div>
      </Panel>
      <Panel title="Optional Collection Summaries" subtitle="No unbounded count is inferred">
        <div className="operatorFieldRuntime__summaryGrid">
          <SummaryCard label="Action Feedback" summary={runtime.action_feedback_summary} />
          <SummaryCard label="Forecast Residual" summary={runtime.forecast_residual_summary} />
          <SummaryCard label="Calibration Candidate" summary={runtime.calibration_candidate_summary} />
          <SummaryCard label="Shadow Evaluation" summary={runtime.shadow_evaluation_summary} />
          <SummaryCard label="Model Activation" summary={runtime.model_activation_summary} />
        </div>
      </Panel>
      <Panel title="Content Identity">
        <div className="operatorFieldRuntime__meta">
          <div><strong>root_graph_content_hash</strong><span>{runtime.root_graph_content_hash}</span></div>
          <div><strong>attachment_content_hash</strong><span>{runtime.attachment_content_hash}</span></div>
          <div><strong>response_instance_hash</strong><span>{runtime.response_instance_hash}</span></div>
          <div><strong>response_started_at</strong><span>{runtime.response_started_at}</span></div>
        </div>
      </Panel>
    </div>
  );
}

function Forecast({ runtime, collection }: { runtime: McftRuntimeReadModelV1; collection: McftCollectionPageV1 | undefined }): React.ReactElement {
  return (
    <div className="operatorFieldRuntime__contentGrid">
      <Panel title="Forecast Pointer Semantics" subtitle="These pointers are not interchangeable">
        <div className="operatorFieldRuntime__summaryGrid">
          <RefCard label="Current Tick Forecast Result" value={runtime.current_tick_forecast_result} />
          <AttachmentCard label="Latest Successful Forecast" attachment={runtime.latest_successful_forecast} />
          <AttachmentCard label="Scenario Source Forecast" attachment={runtime.scenario_source_forecast} />
        </div>
      </Panel>
      <CollectionPanel title="Forecast Collection" page={collection} />
    </div>
  );
}

function Scenario({ runtime, collection }: { runtime: McftRuntimeReadModelV1; collection: McftCollectionPageV1 | undefined }): React.ReactElement {
  return (
    <div className="operatorFieldRuntime__contentGrid">
      <Panel title="Scenario Attachments">
        <div className="operatorFieldRuntime__summaryGrid">
          <AttachmentCard label="Current Scenario Attachment" attachment={runtime.current_scenario_attachment} />
          <AttachmentCard label="Latest Scenario in Scope" attachment={runtime.latest_scenario_in_scope} />
          <AttachmentCard label="Scenario Source Forecast" attachment={runtime.scenario_source_forecast} />
        </div>
      </Panel>
      <CollectionPanel title="Scenario Collection" page={collection} />
    </div>
  );
}

function ActionLifecycle({ runtime, collection }: { runtime: McftRuntimeReadModelV1; collection: McftCollectionPageV1 | undefined }): React.ReactElement {
  return (
    <div className="operatorFieldRuntime__contentGrid">
      <Panel title="Action Lifecycle Attachments" subtitle="Read-only decision, plan, and feedback visibility">
        <div className="operatorFieldRuntime__summaryGrid">
          <AttachmentCard label="Current Human Decision" attachment={runtime.current_human_decision} />
          <AttachmentCard label="Current Approved Plan" attachment={runtime.current_approved_plan} />
          <SummaryCard label="Action Feedback Summary" summary={runtime.action_feedback_summary} />
        </div>
      </Panel>
      <CollectionPanel title="Action Feedback Collection" page={collection} />
    </div>
  );
}

function Governance({ bundle }: { bundle: McftTabBundleV1 }): React.ReactElement {
  return (
    <div className="operatorFieldRuntime__contentGrid">
      <CollectionPanel title="Calibration Candidate" page={bundle.governance?.calibration_candidate} />
      <CollectionPanel title="Shadow Evaluation" page={bundle.governance?.shadow_evaluation} />
      <CollectionPanel title="Model Activation" page={bundle.governance?.model_activation} />
      <Panel title="Governance Boundary"><p className="operatorFieldRuntime__panelMeta">Candidate and evaluation visibility does not activate a model, change Runtime Config, or authorize Runtime consumption.</p></Panel>
    </div>
  );
}

function EvidenceTrace({ bundle }: { bundle: McftTabBundleV1 }): React.ReactElement {
  const trace = bundle.trace;
  const timeline = bundle.timeline;
  return (
    <div className="operatorFieldRuntime__contentGrid">
      <Panel title="Trace Graph" subtitle={`trace_graph_content_hash=${trace?.trace_graph_content_hash || "—"}`}>
        <div className="operatorFieldRuntime__table">
          <div className="operatorFieldRuntime__tableHeader"><span>Node ref</span><span>Node type</span><span>Logical time</span><span>Status / hash</span></div>
          {(trace?.nodes || []).map((node, index) => (
            <div className="operatorFieldRuntime__tableRow" key={`${field(node, "object_ref", "node_ref")}:${index}`}>
              <span>{field(node, "object_ref", "node_ref", "id")}</span>
              <span>{field(node, "object_type", "node_type", "kind")}</span>
              <span>{field(node, "logical_time", "occurred_at", "created_at")}</span>
              <span>{field(node, "attachment_status", "validation_status", "status")}<br /><small>{field(node, "object_hash", "content_hash")}</small></span>
            </div>
          ))}
        </div>
        <p className="operatorFieldRuntime__panelMeta">nodes={(trace?.nodes || []).length} / edges={(trace?.edges || []).length}</p>
      </Panel>
      <Panel title="Timeline" subtitle={`timeline_page_content_hash=${timeline?.timeline_page_content_hash || "—"}`}>
        <div className="operatorFieldRuntime__table">
          <div className="operatorFieldRuntime__tableHeader"><span>Event</span><span>Object ref</span><span>Logical time</span><span>Role / status</span></div>
          {(timeline?.items || []).map((item, index) => (
            <div className="operatorFieldRuntime__tableRow" key={`${field(item, "event_ref", "object_ref")}:${index}`}>
              <span>{field(item, "event_type", "event_kind", "type")}</span>
              <span>{field(item, "object_ref", "event_ref", "source_ref")}</span>
              <span>{field(item, "logical_time", "occurred_at", "created_at")}</span>
              <span>{field(item, "role", "attachment_status", "status")}</span>
            </div>
          ))}
        </div>
        <p className="operatorFieldRuntime__panelMeta">items={(timeline?.items || []).length} / has_more={String(timeline?.has_more || false)} / next_cursor={timeline?.next_cursor || "—"}</p>
      </Panel>
    </div>
  );
}

function Health({ bundle }: { bundle: McftTabBundleV1 }): React.ReactElement {
  const health = bundle.health;
  if (!health) return <Panel title="Health"><p>Health response missing.</p></Panel>;
  return (
    <div className="operatorFieldRuntime__contentGrid">
      <Panel title="Runtime Health" subtitle={`Health Relationship: ${health.health_relationship}`}>
        <div className="operatorFieldRuntime__summaryGrid">
          <RefCard label="Terminal Record-Set Health" value={health.terminal_record_set_health} />
          <RefCard label="Latest Operational Runtime Health" value={health.latest_operational_runtime_health} />
          <article className="operatorFieldRuntime__metricCard"><span>Health Relationship</span><strong>{health.health_relationship}</strong><small>{health.health_content_hash}</small></article>
        </div>
      </Panel>
      <Panel title="Health Role Resolution">
        <div className="operatorFieldRuntime__table">
          <div className="operatorFieldRuntime__tableHeader"><span>Object ref</span><span>Role</span><span>Family</span><span>Status</span></div>
          {(health.health_role_resolutions || []).map((item, index) => (
            <div className="operatorFieldRuntime__tableRow" key={`${field(item, "object_ref", "health_ref")}:${index}`}>
              <span>{field(item, "object_ref", "health_ref")}</span>
              <span>{field(item, "role", "resolved_role")}</span>
              <span>{field(item, "profile_family", "role_family", "family")}</span>
              <span>{field(item, "validation_status", "status")}</span>
            </div>
          ))}
        </div>
      </Panel>
    </div>
  );
}

function ErrorPanel({ error, english }: { error: McftApiErrorV1; english: boolean }): React.ReactElement {
  return (
    <Panel title={english ? "Canonical Runtime read failed" : "规范运行读取失败"} subtitle={`HTTP ${error.status} / ${error.error_code}`}>
      <div className="operatorFieldRuntime__meta">
        <div><strong>request_id</strong><span>{error.request_id}</span></div>
        <div><strong>failed_profiles</strong><span>{error.failed_profiles.join(", ") || "—"}</span></div>
        <div><strong>diagnostics</strong><span>{error.diagnostics.join(" | ") || "—"}</span></div>
        <div><strong>url</strong><span>{error.url}</span></div>
      </div>
    </Panel>
  );
}

function renderBundle(bundle: McftTabBundleV1): React.ReactElement {
  if (bundle.tab === "overview" && bundle.runtime) return <Overview runtime={bundle.runtime} />;
  if (bundle.tab === "state") return <CollectionPanel title="State Collection" page={bundle.collection} />;
  if (bundle.tab === "forecast" && bundle.runtime) return <Forecast runtime={bundle.runtime} collection={bundle.collection} />;
  if (bundle.tab === "scenario" && bundle.runtime) return <Scenario runtime={bundle.runtime} collection={bundle.collection} />;
  if (bundle.tab === "action-lifecycle" && bundle.runtime) return <ActionLifecycle runtime={bundle.runtime} collection={bundle.collection} />;
  if (bundle.tab === "residual") return <CollectionPanel title="Residual Verification Collection" page={bundle.collection} />;
  if (bundle.tab === "calibration") return <Governance bundle={bundle} />;
  if (bundle.tab === "evidence-trace") return <EvidenceTrace bundle={bundle} />;
  return <Health bundle={bundle} />;
}

function scopeLine(scope: McftFieldTwinScopeV1): string {
  return `${scope.tenant_id} / ${scope.project_id} / ${scope.group_id} / ${scope.field_id} / ${scope.season_id} / ${scope.zone_id}`;
}

export default function McftCanonicalFieldRuntimeRoutePage({ tab }: Props): React.ReactElement {
  const { locale } = useLocale();
  const english = locale === "en-US";
  const params = useParams();
  const [searchParams] = useSearchParams();
  const query = searchParams.toString();
  const normalizedTab = normalizeTab(tab);
  const fieldId = String(params.fieldId || "").trim();
  const scopeResolution = React.useMemo(
    () => resolveMcftRuntimeScope(fieldId, new URLSearchParams(query)),
    [fieldId, query],
  );
  const [loadState, setLoadState] = React.useState<LoadState>({ status: "idle" });

  React.useEffect(() => {
    let active = true;
    if (normalizedTab === "fields" || !scopeResolution.ok) {
      setLoadState({ status: "idle" });
      return () => { active = false; };
    }
    setLoadState({ status: "loading" });
    void loadMcftCanonicalTab(scopeResolution.scope, normalizedTab)
      .then((bundle) => { if (active) setLoadState({ status: "ready", bundle }); })
      .catch((error: unknown) => {
        if (!active) return;
        const normalized: McftApiErrorV1 = isMcftApiError(error)
          ? error
          : { schema_version: "mcft_field_twin_api_error_v1", status: 0, error_code: error instanceof Error ? error.message : "MCFT_RUNTIME_READ_FAILED", failed_profiles: [], diagnostics: [], request_id: "NOT_PROVIDED", url: "—" };
        setLoadState({ status: "error", error: normalized });
      });
    return () => { active = false; };
  }, [normalizedTab, scopeResolution.ok ? scopeLine(scopeResolution.scope) : scopeResolution.missing_keys.join("|")]);

  if (normalizedTab === "fields") {
    return (
      <main className="operatorFieldRuntime operatorProductSurface" data-mcft-cap-07-s5="canonical-operator-integration">
        <header className="operatorFieldRuntime__header">
          <div><p className="operatorFieldRuntime__eyebrow">MCFT-CAP-07.S5</p><h1 className="operatorFieldRuntime__title">{english ? "Canonical Field Runtime" : "规范地块运行"}</h1><p className="operatorFieldRuntime__subtitle">{english ? "Select a field, season, and zone. No field-only scope degradation is permitted." : "选择地块、季节与分区；禁止降级为仅地块范围。"}</p></div>
        </header>
        <Panel title={english ? "Required scope" : "必需范围"}><p>tenant_id / project_id / group_id / field_id / season_id / zone_id</p><p className="operatorFieldRuntime__panelMeta">{english ? "Open a field route with season_id and zone_id query parameters. Tenant, project, and group may come from the authenticated session." : "请使用包含 season_id 与 zone_id 查询参数的地块路由；租户、项目和分组可来自已认证会话。"}</p></Panel>
      </main>
    );
  }

  return (
    <main className="operatorFieldRuntime operatorProductSurface" data-mcft-cap-07-s5="canonical-operator-integration">
      <header className="operatorFieldRuntime__header">
        <div>
          <p className="operatorFieldRuntime__eyebrow">MCFT-CAP-07.S5 / GET-only canonical Runtime</p>
          <h1 className="operatorFieldRuntime__title">{english ? "Canonical Field Runtime" : "规范地块运行"}</h1>
          <p className="operatorFieldRuntime__subtitle">{english ? "Read-only deterministic replay integration. No recommendation, approval, dispatch, activation, or persistence." : "只读确定性回放集成；不创建建议、审批、派发、激活或持久化。"}</p>
        </div>
        <dl className="operatorFieldRuntime__meta">
          <div><dt>Field</dt><dd>{fieldId || "—"}</dd></div>
          <div><dt>Runtime mode</dt><dd>READ_ONLY_DETERMINISTIC_REPLAY</dd></div>
          <div><dt>Source</dt><dd>/api/v1/operator/twin/fields/:field_id/runtime*</dd></div>
        </dl>
      </header>

      <nav className="operatorFieldRuntime__tabs" aria-label="Canonical Field Runtime tabs">
        {TABS.map((definition) => (
          <NavLink
            key={definition.key}
            to={tabPath(fieldId, definition, query)}
            className={({ isActive }) => `operatorFieldRuntime__tab${isActive || normalizedTab === definition.key ? " operatorFieldRuntime__tab--active" : ""}`}
            data-mcft-tab={definition.key}
          >
            <span>{english ? definition.en : definition.zh}</span>
            <small className="operatorFieldRuntime__tabStatus">CANONICAL</small>
          </NavLink>
        ))}
      </nav>

      {!scopeResolution.ok ? (
        <Panel title={english ? "Exact six-key scope required" : "需要精确六键范围"} subtitle={`missing=${scopeResolution.missing_keys.join(",")}`}>
          <p className="operatorFieldRuntime__panelMeta">{english ? "The canonical client will not issue a request until every scope key is present. Add season_id and zone_id to the URL or restore the authenticated tenant context." : "在全部范围键齐备前，规范客户端不会发出请求。请在 URL 中加入 season_id、zone_id，或恢复已认证租户上下文。"}</p>
        </Panel>
      ) : (
        <div className="operatorFieldRuntime__routeNotice"><span>Exact scope</span><strong>{scopeLine(scopeResolution.scope)}</strong></div>
      )}

      {scopeResolution.ok && loadState.status === "loading" ? <Panel title={english ? "Loading canonical read model" : "正在加载规范读模型"}><p>GET-only snapshot read in progress.</p></Panel> : null}
      {scopeResolution.ok && loadState.status === "error" ? <ErrorPanel error={loadState.error} english={english} /> : null}
      {scopeResolution.ok && loadState.status === "ready" ? renderBundle(loadState.bundle) : null}
    </main>
  );
}
