// Purpose: render the qualified PFE-14 S4 Scheduler Summary and Evidence Availability readback.
// Boundary: server-returned operational values only; no browser freshness, scheduler, Runtime-mode, or recovery inference.

import React from "react";
import {
  isMcftApiError,
  readMcftOperationalSummary,
  type McftApiErrorV1,
  type McftFieldTwinScopeV1,
  type McftOperationalSummaryV1,
} from "../../../api/mcftFieldTwinRuntime";
import { useLocale } from "../../../lib/locale";
import "../../../styles/pfe14OperationalReadback.css";

type Props = { scope: McftFieldTwinScopeV1 };

type OperationalLoadState =
  | { status: "loading" }
  | { status: "ready"; value: McftOperationalSummaryV1 }
  | { status: "error"; error: McftApiErrorV1 };

const SLOT_LABELS = Array.from({ length: 24 }, (_, index) => `O${String(index).padStart(2, "0")}`);

function scopeKey(scope: McftFieldTwinScopeV1): string {
  return `${scope.tenant_id}|${scope.project_id}|${scope.group_id}|${scope.field_id}|${scope.season_id}|${scope.zone_id}`;
}

function valueText(value: string | number | null | undefined): string {
  return value === null || value === undefined || value === "" ? "—" : String(value);
}

function Metric({ label, value, note }: { label: string; value: string | number | null | undefined; note?: string }): React.ReactElement {
  return (
    <article className="operatorFieldRuntime__metricCard pfe14OperationalReadback__metric">
      <span>{label}</span>
      <strong>{valueText(value)}</strong>
      {note ? <small>{note}</small> : null}
    </article>
  );
}

function ReadbackError({ error, english }: { error: McftApiErrorV1; english: boolean }): React.ReactElement {
  return (
    <section className="operatorFieldRuntime__panel pfe14OperationalReadback" data-pfe14-operational-state="error">
      <header className="operatorFieldRuntime__panelHeader">
        <div>
          <h2 className="operatorFieldRuntime__panelTitle">{english ? "Operational readback unavailable" : "运行读回暂不可用"}</h2>
          <p className="operatorFieldRuntime__panelMeta">{english ? "The canonical Runtime root remains independently readable; no fallback operational values are synthesized." : "规范 Runtime 根读模型仍独立可读；这里不会用回放或样例值替代运行数据。"}</p>
        </div>
      </header>
      <div className="operatorFieldRuntime__meta">
        <div><strong>error_code</strong><span>{error.error_code}</span></div>
        <div><strong>HTTP</strong><span>{error.status || "—"}</span></div>
        <div><strong>request_id</strong><span>{error.request_id}</span></div>
        <div><strong>diagnostics</strong><span>{error.diagnostics.join(" | ") || "—"}</span></div>
      </div>
    </section>
  );
}

export default function Pfe14OperationalReadbackPanel({ scope }: Props): React.ReactElement {
  const { locale } = useLocale();
  const english = locale === "en-US";
  const [state, setState] = React.useState<OperationalLoadState>({ status: "loading" });
  const exactScopeKey = React.useMemo(() => scopeKey(scope), [scope]);

  React.useEffect(() => {
    let active = true;
    setState({ status: "loading" });
    void readMcftOperationalSummary(scope)
      .then((value) => { if (active) setState({ status: "ready", value }); })
      .catch((error: unknown) => {
        if (!active) return;
        const normalized: McftApiErrorV1 = isMcftApiError(error)
          ? error
          : {
              schema_version: "mcft_field_twin_api_error_v1",
              status: 0,
              error_code: error instanceof Error ? error.message : "PFE14_OPERATIONAL_READ_FAILED",
              failed_profiles: [],
              diagnostics: [],
              request_id: "NOT_PROVIDED",
              url: "—",
            };
        setState({ status: "error", error: normalized });
      });
    return () => { active = false; };
  }, [exactScopeKey]);

  if (state.status === "loading") {
    return (
      <section className="operatorFieldRuntime__panel pfe14OperationalReadback" data-pfe14-operational-state="loading">
        <header className="operatorFieldRuntime__panelHeader">
          <div>
            <h2 className="operatorFieldRuntime__panelTitle">{english ? "Scheduler & Evidence" : "调度与证据"}</h2>
            <p className="operatorFieldRuntime__panelMeta">{english ? "Loading the qualified GET-only operational projection." : "正在读取已资格化的 GET-only 运行投影。"}</p>
          </div>
        </header>
      </section>
    );
  }

  if (state.status === "error") return <ReadbackError error={state.error} english={english} />;

  const operational = state.value;
  const scheduler = operational.scheduler_summary;
  const evidence = operational.evidence_availability;
  const boundarySlot = evidence.eligibility_boundary?.slot_id ?? null;

  return (
    <section className="operatorFieldRuntime__panel pfe14OperationalReadback" data-pfe14-operational-state="ready">
      <header className="operatorFieldRuntime__panelHeader">
        <div>
          <h2 className="operatorFieldRuntime__panelTitle">{english ? "Scheduler & Evidence" : "调度与证据"}</h2>
          <p className="operatorFieldRuntime__panelMeta">
            {english
              ? "Server-owned operational projection. This does not change the current Runtime context or create canonical Twin truth."
              : "服务器权威运行投影；它不改变当前 Runtime context，也不生成新的规范 Twin truth。"}
          </p>
        </div>
        <span className="pfe14OperationalReadback__sourceBadge">GET /runtime/operational-summary</span>
      </header>

      <div className="pfe14OperationalReadback__section">
        <h3>{english ? "Scheduler Summary" : "调度摘要"}</h3>
        <div className="operatorFieldRuntime__summaryGrid">
          <Metric label={english ? "Scheduler status" : "调度状态"} value={scheduler.scheduler_status} />
          <Metric label={english ? "Latest resolved slot" : "最近已终结时隙"} value={scheduler.latest_completed_slot} note={scheduler.latest_tick_status ? `terminal_status=${scheduler.latest_tick_status}` : undefined} />
          <Metric label={english ? "Next target slot" : "下一目标时隙"} value={scheduler.next_target_slot} />
          <Metric label={english ? "Scheduler lag (ms)" : "调度滞后（ms）"} value={scheduler.scheduler_lag_ms} note={english ? "Server-computed with PostgreSQL clock" : "由服务器使用 PostgreSQL 时钟计算"} />
          <Metric label={english ? "Latest tick completed" : "最近 Tick 完成时间"} value={scheduler.latest_tick_completed_at} />
          <Metric label={english ? "Latest tick started" : "最近 Tick 开始时间"} value={scheduler.latest_tick_started_at} note={english ? "Null is preserved; scheduler claim time is not substituted." : "保留 null；不拿 scheduler claim time 冒充 Tick start。"} />
        </div>
      </div>

      <div className="pfe14OperationalReadback__section">
        <h3>{english ? "Evidence Availability" : "证据可用性"}</h3>
        <div className="operatorFieldRuntime__summaryGrid">
          <Metric label={english ? "Eligibility boundary" : "资格边界"} value={evidence.eligibility_boundary ? `${evidence.eligibility_boundary.slot_id} / ${evidence.eligibility_boundary.logical_time}` : null} />
          <Metric label={english ? "Freshness status" : "新鲜度状态"} value={evidence.freshness_status} note={english ? "Server verdict" : "服务器 verdict"} />
          <Metric label={english ? "Latest observed" : "最近观测时间"} value={evidence.latest_evidence_observed_at} />
          <Metric label={english ? "Latest ingested" : "最近入库时间"} value={evidence.latest_evidence_ingested_at} />
          <Metric label={english ? "Evidence age (ms)" : "证据年龄（ms）"} value={evidence.evidence_age_ms} note={english ? "Measured at eligibility boundary" : "以资格边界为参照"} />
          <Metric label={english ? "Freshness threshold (ms)" : "新鲜度阈值（ms）"} value={evidence.freshness_threshold_ms} />
          <Metric label={english ? "Coverage ratio" : "覆盖率"} value={evidence.coverage_ratio} note={english ? "Raw server ratio; not converted in browser" : "服务器原始 ratio；浏览器不换算"} />
          <Metric label={english ? "Maximum gap (ms)" : "最大缺口（ms）"} value={evidence.maximum_gap_ms} />
          <Metric label={english ? "Future excluded" : "未来数据排除数"} value={evidence.future_excluded_count} />
          <Metric label={english ? "Late evidence" : "迟到证据数"} value={evidence.late_evidence_count} />
          <Metric label={english ? "Out-of-order" : "乱序证据数"} value={evidence.out_of_order_count} />
        </div>
      </div>

      <div className="pfe14OperationalReadback__section">
        <div className="pfe14OperationalReadback__stripHeader">
          <h3>{english ? "O00–O23 structure" : "O00–O23 结构条"}</h3>
          <small>{english ? "Only the exact server-returned Evidence boundary is marked. No per-slot state is inferred." : "只标记服务器明确返回的 Evidence boundary；不推断其他时隙状态。"}</small>
        </div>
        <div className="pfe14OperationalReadback__slotStrip" aria-label="O00 to O23 structural strip">
          {SLOT_LABELS.map((slot) => (
            <span key={slot} data-evidence-boundary={boundarySlot === slot ? "true" : "false"}>{slot}</span>
          ))}
        </div>
      </div>

      <details className="pfe14OperationalReadback__technical">
        <summary>{english ? "Technical source and limitations" : "技术来源与限制"}</summary>
        <dl className="operatorFieldRuntime__meta">
          <div><dt>response_started_at</dt><dd>{operational.response_started_at}</dd></div>
          <div><dt>operational_content_hash</dt><dd>{operational.operational_content_hash}</dd></div>
          <div><dt>response_instance_hash</dt><dd>{operational.response_instance_hash}</dd></div>
          <div><dt>latest_tick_ref</dt><dd>{valueText(scheduler.latest_tick_ref)}</dd></div>
          <div><dt>limitations</dt><dd>{operational.limitations.join(" | ") || "—"}</dd></div>
          <div><dt>validation_summary</dt><dd>{operational.validation_summary.join(" | ") || "—"}</dd></div>
        </dl>
      </details>
    </section>
  );
}
