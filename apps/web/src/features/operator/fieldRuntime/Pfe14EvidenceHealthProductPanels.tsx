// Purpose: productize existing canonical Evidence/Health GET responses plus the already-qualified operational summary.
// Boundary: server-returned values only; no browser freshness, degradation, backfill, restart, recovery, or provider-cadence inference.

import React from "react";
import {
  isMcftApiError,
  readMcftOperationalSummary,
  type McftApiErrorV1,
  type McftCanonicalRefV1,
  type McftFieldTwinScopeV1,
  type McftOperationalSummaryV1,
  type McftRuntimeHealthV1,
  type McftTimelinePageV1,
  type McftTraceGraphV1,
} from "../../../api/mcftFieldTwinRuntime";
import { useLocale } from "../../../lib/locale";
import "../../../styles/pfe14EvidenceHealthProductization.css";

type OperationalState =
  | { status: "loading" }
  | { status: "ready"; value: McftOperationalSummaryV1 }
  | { status: "error"; error: McftApiErrorV1 };

function scopeKey(scope: McftFieldTwinScopeV1): string {
  return `${scope.tenant_id}|${scope.project_id}|${scope.group_id}|${scope.field_id}|${scope.season_id}|${scope.zone_id}`;
}

function useOperationalSummary(scope: McftFieldTwinScopeV1): OperationalState {
  const [state, setState] = React.useState<OperationalState>({ status: "loading" });
  const exactScopeKey = React.useMemo(() => scopeKey(scope), [scope]);
  React.useEffect(() => {
    let active = true;
    setState({ status: "loading" });
    void readMcftOperationalSummary(scope)
      .then((value) => { if (active) setState({ status: "ready", value }); })
      .catch((error: unknown) => {
        if (!active) return;
        setState({
          status: "error",
          error: isMcftApiError(error)
            ? error
            : {
                schema_version: "mcft_field_twin_api_error_v1",
                status: 0,
                error_code: error instanceof Error ? error.message : "PFE14_OPERATIONAL_READ_FAILED",
                failed_profiles: [], diagnostics: [], request_id: "NOT_PROVIDED", url: "—",
              },
        });
      });
    return () => { active = false; };
  }, [exactScopeKey]);
  return state;
}

function valueText(value: string | number | null | undefined): string {
  return value === null || value === undefined || value === "" ? "—" : String(value);
}

function Metric({ label, value, note }: { label: string; value: string | number | null | undefined; note?: string }): React.ReactElement {
  return <article className="pfe14EvidenceHealth__metric"><span>{label}</span><strong>{valueText(value)}</strong>{note ? <small>{note}</small> : null}</article>;
}

function Unavailable({ label, detail }: { label: string; detail: string }): React.ReactElement {
  return <article className="pfe14EvidenceHealth__unavailable"><strong>{label}</strong><span>{detail}</span></article>;
}

function OperationalError({ error, english }: { error: McftApiErrorV1; english: boolean }): React.ReactElement {
  return <div className="pfe14EvidenceHealth__operationalError"><strong>{english ? "Operational projection unavailable" : "运行投影暂不可用"}</strong><span>{english ? "Canonical Trace/Health remains readable independently; no fallback values are synthesized." : "规范 Trace/Health 仍独立可读；不会用回放或样例值补写运行数据。"}</span><small>{error.error_code} / HTTP {error.status || "—"} / request_id={error.request_id}</small></div>;
}

function CanonicalRefDetail({ label, value, english }: { label: string; value: McftCanonicalRefV1 | null; english: boolean }): React.ReactElement {
  return (
    <article className="pfe14EvidenceHealth__canonical">
      <span>{label}</span>
      <strong>{value ? (english ? "Canonical record returned" : "已返回规范记录") : (english ? "No canonical record returned" : "未返回规范记录")}</strong>
      {value ? <details><summary>{english ? "Technical identity" : "技术身份"}</summary><dl><div><dt>object_ref</dt><dd>{value.object_ref}</dd></div><div><dt>object_type</dt><dd>{value.object_type}</dd></div><div><dt>object_hash</dt><dd>{value.object_hash}</dd></div><div><dt>source_fact_ref</dt><dd>{value.source_fact_ref || "—"}</dd></div></dl></details> : null}
    </article>
  );
}

export function Pfe14EvidenceProductPanel({ trace, timeline }: { trace: McftTraceGraphV1; timeline: McftTimelinePageV1 | undefined }): React.ReactElement {
  const { locale } = useLocale();
  const english = locale === "en-US";
  const operational = useOperationalSummary(trace.request_scope);
  const operationalValue = operational.status === "ready" ? operational.value : null;
  const evidence = operationalValue?.evidence_availability ?? null;

  return (
    <div className="operatorFieldRuntime__contentGrid" data-pfe14-evidence-product="existing-get-only">
      <section className="operatorFieldRuntime__panel pfe14EvidenceHealth">
        <header className="operatorFieldRuntime__panelHeader"><div><p className="pfe14EvidenceHealth__eyebrow">{english ? "Evidence Availability" : "证据可用性"}</p><h2 className="operatorFieldRuntime__panelTitle">{english ? "Evidence status" : "证据状态"}</h2><p className="operatorFieldRuntime__panelMeta">{english ? "Server-owned availability verdict for this exact Scope. The browser does not reproduce the freshness or provider-publication policy." : "当前精确 Scope 的服务器权威可用性 verdict；浏览器不重算 freshness，也不复制 provider publication policy。"}</p></div></header>
        {operational.status === "loading" ? <p className="pfe14EvidenceHealth__loading">{english ? "Loading qualified operational projection…" : "正在读取已资格化运行投影…"}</p> : null}
        {operational.status === "error" ? <OperationalError error={operational.error} english={english} /> : null}
        {evidence && operationalValue ? <><div className="pfe14EvidenceHealth__grid"><Metric label={english ? "Eligibility boundary" : "资格边界"} value={evidence.eligibility_boundary ? `${evidence.eligibility_boundary.slot_id} / ${evidence.eligibility_boundary.logical_time}` : null} /><Metric label={english ? "Freshness verdict" : "新鲜度 verdict"} value={evidence.freshness_status} note={english ? "Server verdict" : "服务器 verdict"} /><Metric label={english ? "Latest observed" : "最近观测时间"} value={evidence.latest_evidence_observed_at} /><Metric label={english ? "Latest ingested" : "最近摄取时间"} value={evidence.latest_evidence_ingested_at} /><Metric label={english ? "Evidence age (ms)" : "Evidence age（ms）"} value={evidence.evidence_age_ms} note={english ? "Server boundary-relative value" : "服务器边界相对值"} /><Metric label={english ? "Coverage ratio (raw)" : "Coverage ratio（原始值）"} value={evidence.coverage_ratio} note={english ? "No browser percentage conversion" : "浏览器不转换为新的百分比语义"} /><Metric label={english ? "Maximum gap (ms)" : "Maximum gap（ms）"} value={evidence.maximum_gap_ms} /><Metric label={english ? "Future excluded" : "Future excluded"} value={evidence.future_excluded_count} /><Metric label={english ? "Late Evidence" : "Late Evidence"} value={evidence.late_evidence_count} /><Metric label={english ? "Out-of-order" : "Out-of-order"} value={evidence.out_of_order_count} /></div><details className="pfe14EvidenceHealth__technical"><summary>{english ? "Operational technical details" : "运行技术详情"}</summary><dl><div><dt>freshness_threshold_ms</dt><dd>{evidence.freshness_threshold_ms}</dd></div><div><dt>operational_content_hash</dt><dd>{operationalValue.operational_content_hash}</dd></div><div><dt>response_instance_hash</dt><dd>{operationalValue.response_instance_hash}</dd></div><div><dt>response_started_at</dt><dd>{operationalValue.response_started_at}</dd></div></dl></details></> : null}
        <div className="pfe14EvidenceHealth__unavailableGrid"><Unavailable label={english ? "Missing-source identity" : "缺失来源身份"} detail={english ? "Not exposed by the current qualified Evidence Availability contract; no source is guessed from Trace contents." : "当前已资格化 Evidence Availability 合同未暴露；不会从 Trace 内容猜测缺失来源。"} /><Unavailable label={english ? "Provider publication profile" : "Provider publication profile"} detail={english ? "Upstream MCFT authority only. PFE displays the server verdict and does not infer KBS cadence." : "仅属于上游 MCFT authority；PFE 只展示服务器 verdict，不推断 KBS cadence。"} /></div>
      </section>
      <section className="operatorFieldRuntime__panel pfe14EvidenceHealth">
        <header className="operatorFieldRuntime__panelHeader"><div><h2 className="operatorFieldRuntime__panelTitle">{english ? "Evidence trace summary" : "证据追踪摘要"}</h2><p className="operatorFieldRuntime__panelMeta">{english ? "Returned-page inventory only; raw node payloads remain in the Audit surface." : "只展示当前响应页库存；原始 node payload 继续留在 Audit 页面。"}</p></div></header>
        <div className="pfe14EvidenceHealth__grid"><Metric label={english ? "Trace nodes returned" : "返回 Trace nodes"} value={trace.nodes.length} /><Metric label={english ? "Trace edges returned" : "返回 Trace edges"} value={trace.edges.length} /><Metric label={english ? "Timeline items returned" : "返回 Timeline items"} value={timeline?.items.length ?? null} /><Metric label={english ? "Timeline has more" : "Timeline has more"} value={timeline ? String(timeline.has_more) : null} /></div>
        <details className="pfe14EvidenceHealth__technical"><summary>{english ? "Trace / Timeline technical identity" : "Trace / Timeline 技术身份"}</summary><dl><div><dt>trace_graph_content_hash</dt><dd>{trace.trace_graph_content_hash}</dd></div><div><dt>trace_response_started_at</dt><dd>{trace.response_started_at}</dd></div><div><dt>timeline_page_content_hash</dt><dd>{timeline?.timeline_page_content_hash || "—"}</dd></div><div><dt>timeline_next_cursor</dt><dd>{timeline?.next_cursor || "—"}</dd></div></dl></details>
      </section>
    </div>
  );
}

export function Pfe14RuntimeHealthProductPanel({ health }: { health: McftRuntimeHealthV1 }): React.ReactElement {
  const { locale } = useLocale();
  const english = locale === "en-US";
  const operational = useOperationalSummary(health.request_scope);
  const operationalValue = operational.status === "ready" ? operational.value : null;
  const scheduler = operationalValue?.scheduler_summary ?? null;
  const evidence = operationalValue?.evidence_availability ?? null;

  return (
    <div className="operatorFieldRuntime__contentGrid" data-pfe14-health-product="existing-get-only">
      <section className="operatorFieldRuntime__panel pfe14EvidenceHealth">
        <header className="operatorFieldRuntime__panelHeader"><div><p className="pfe14EvidenceHealth__eyebrow">{english ? "Canonical Runtime Health" : "规范 Runtime Health"}</p><h2 className="operatorFieldRuntime__panelTitle">{english ? "Runtime health records" : "运行健康记录"}</h2><p className="operatorFieldRuntime__panelMeta">{english ? "Canonical Health records and exact relationship returned by the current GET response." : "只展示当前 GET 响应返回的规范 Health 记录与精确 relationship。"}</p></div></header>
        <div className="pfe14EvidenceHealth__canonicalGrid"><CanonicalRefDetail label={english ? "Terminal record-set Health" : "Terminal record-set Health"} value={health.terminal_record_set_health} english={english} /><CanonicalRefDetail label={english ? "Latest operational Runtime Health" : "Latest operational Runtime Health"} value={health.latest_operational_runtime_health} english={english} /><Metric label={english ? "Health relationship" : "Health relationship"} value={health.health_relationship} note={english ? "Exact server enum" : "服务器精确枚举"} /></div>
        <details className="pfe14EvidenceHealth__technical"><summary>{english ? "Health technical details" : "Health 技术详情"}</summary><dl><div><dt>health_content_hash</dt><dd>{health.health_content_hash}</dd></div><div><dt>response_instance_hash</dt><dd>{health.response_instance_hash}</dd></div><div><dt>response_started_at</dt><dd>{health.response_started_at}</dd></div></dl></details>
      </section>
      <section className="operatorFieldRuntime__panel pfe14EvidenceHealth">
        <header className="operatorFieldRuntime__panelHeader"><div><h2 className="operatorFieldRuntime__panelTitle">{english ? "Operational signals" : "运行信号"}</h2><p className="operatorFieldRuntime__panelMeta">{english ? "Separate server signals. PFE does not combine them into a new degradation verdict." : "这些是独立服务器信号；PFE 不把它们合成为新的 degradation verdict。"}</p></div></header>
        {operational.status === "loading" ? <p className="pfe14EvidenceHealth__loading">{english ? "Loading qualified operational projection…" : "正在读取已资格化运行投影…"}</p> : null}
        {operational.status === "error" ? <OperationalError error={operational.error} english={english} /> : null}
        {scheduler && evidence ? <div className="pfe14EvidenceHealth__grid"><Metric label={english ? "Scheduler status" : "Scheduler status"} value={scheduler.scheduler_status} /><Metric label={english ? "Latest resolved slot" : "最近已终结时隙"} value={scheduler.latest_completed_slot} /><Metric label={english ? "Next target slot" : "下一目标时隙"} value={scheduler.next_target_slot} /><Metric label={english ? "Scheduler lag (ms)" : "Scheduler lag（ms）"} value={scheduler.scheduler_lag_ms} note={english ? "Server-computed" : "服务器计算"} /><Metric label={english ? "Evidence freshness" : "Evidence freshness"} value={evidence.freshness_status} note={english ? "Server verdict" : "服务器 verdict"} /><Metric label={english ? "Evidence boundary" : "Evidence 边界"} value={evidence.eligibility_boundary ? `${evidence.eligibility_boundary.slot_id} / ${evidence.eligibility_boundary.logical_time}` : null} /></div> : null}
        <div className="pfe14EvidenceHealth__unavailableGrid"><Unavailable label={english ? "Missed-slot count / backfill" : "Missed-slot count / backfill"} detail={english ? "Not exposed by the current qualified product projection." : "当前已资格化产品投影未暴露。"} /><Unavailable label={english ? "Runtime degradation verdict / reasons" : "Runtime degradation verdict / reasons"} detail={english ? "Not exposed; PFE does not derive it from scheduler lag or Evidence freshness." : "当前未暴露；PFE 不根据 scheduler lag 或 Evidence freshness 自行推导。"} /><Unavailable label={english ? "Restart / recovery" : "Restart / recovery"} detail={english ? "No authoritative current product source; current lease/fencing state is not accepted as recovery history." : "当前没有权威产品来源；不会把 lease/fencing 当前状态当成 recovery history。"} /></div>
      </section>
    </div>
  );
}
