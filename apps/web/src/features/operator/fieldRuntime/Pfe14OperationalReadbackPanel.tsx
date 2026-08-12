// Purpose: render the qualified PFE-14 Scheduler, Evidence and narrow Class-B operational readback.
// Boundary: server-returned operational values only; no browser freshness, degradation, slot-state, Runtime-mode, or recovery inference.

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

function scopeKey(scope: McftFieldTwinScopeV1): string {
  return `${scope.tenant_id}|${scope.project_id}|${scope.group_id}|${scope.field_id}|${scope.season_id}|${scope.zone_id}`;
}

function valueText(value: string | number | boolean | null | undefined): string {
  return value === null || value === undefined || value === "" ? "—" : String(value);
}

function Metric({ label, value, note }: { label: string; value: string | number | boolean | null | undefined; note?: string }): React.ReactElement {
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
            <h2 className="operatorFieldRuntime__panelTitle">{english ? "Runtime operations" : "运行状态"}</h2>
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
  const status = operational.operational_status;
  const slotWindow = operational.slot_window;
  const boundarySlot = evidence.eligibility_boundary?.slot_id ?? null;
  const degradationReasons = status.degradation_reason_codes.length ? status.degradation_reason_codes.join(" | ") : "NONE";

  return (
    <section className="operatorFieldRuntime__panel pfe14OperationalReadback" data-pfe14-operational-state="ready" data-runtime-degradation={status.runtime_degradation_status}>
      <header className="operatorFieldRuntime__panelHeader">
        <div>
          <h2 className="operatorFieldRuntime__panelTitle">{english ? "Runtime operations" : "运行状态"}</h2>
          <p className="operatorFieldRuntime__panelMeta">
            {english
              ? "Server-owned operational projection. Statuses below are read verdicts; the browser does not reconstruct Runtime truth."
              : "服务器权威运行投影。下列状态均为服务器 verdict；浏览器不重建 Runtime truth。"}
          </p>
        </div>
        <span className="pfe14OperationalReadback__sourceBadge">GET /runtime/operational-summary</span>
      </header>

      <div className="pfe14OperationalReadback__section">
        <h3>{english ? "Operational status" : "运行判定"}</h3>
        <div className="operatorFieldRuntime__summaryGrid">
          <Metric label={english ? "Runtime degradation" : "Runtime 降级状态"} value={status.runtime_degradation_status} note={english ? "Server verdict" : "服务器 verdict"} />
          <Metric label={english ? "Degradation reasons" : "降级原因"} value={degradationReasons} note={english ? "Ordered server reason codes" : "服务器有序 reason codes"} />
          <Metric label={english ? "Forecast status" : "Forecast 状态"} value={status.forecast_status} note={english ? "Validated server projection" : "服务器已验证投影"} />
          <Metric label={english ? "Scenario-source eligible" : "Scenario-source 可用"} value={status.scenario_source_eligible} note={english ? "Null means the server did not establish a verdict." : "null 表示服务器未建立该 verdict。"} />
        </div>
      </div>

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
          <h3>{english ? "O00–O23 persisted slot window" : "O00–O23 持久化时隙窗口"}</h3>
          <small>{english ? "States are copied from the server. NOT_MATERIALIZED is data absence only, never a missed/backfill verdict." : "状态直接来自服务器。NOT_MATERIALIZED 只表示尚未物化，绝不等同于 missed/backfill。"}</small>
        </div>
        {slotWindow ? (
          <>
            <div className="pfe14OperationalReadback__slotStrip" aria-label="O00 to O23 persisted slot window" data-slot-window="established">
              {slotWindow.entries.map((entry) => (
                <span
                  key={entry.slot_id}
                  data-slot-state={entry.state}
                  data-evidence-boundary={boundarySlot === entry.slot_id ? "true" : "false"}
                  title={`${entry.logical_time} / ${entry.state}`}
                >
                  <b>{entry.slot_id}</b>
                  <small>{entry.state}</small>
                </span>
              ))}
            </div>
            <p className="pfe14OperationalReadback__slotMeta">
              {english ? "Schedule start" : "Schedule 起点"}: {slotWindow.schedule_start_logical_time} · interval_seconds={slotWindow.interval_seconds}
            </p>
          </>
        ) : (
          <p className="pfe14OperationalReadback__unavailable" data-slot-window="not-established">
            {english ? "The server has not established a persisted 24-slot window. No per-slot state is inferred." : "服务器尚未建立持久化 24-slot 窗口；不推断任何时隙状态。"}
          </p>
        )}
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
