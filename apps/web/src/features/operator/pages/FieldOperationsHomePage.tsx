import React from "react";
import { Link, useSearchParams } from "react-router-dom";
import {
  buildOperatorTwinScopeQuery,
  fetchOperatorTwinOverview,
  type OperatorTwinOverviewV1,
  type OperatorTwinRequestScope,
} from "../../../api/operatorTwin";
import {
  fetchOperatorWorkbench,
  type OperatorWorkbenchItem,
  type OperatorWorkbenchQueueKey,
  type OperatorWorkbenchResponse,
} from "../../../api/operatorWorkbench";
import { localizedText, useLocale, type LocalizedCopy } from "../../../lib/locale";
import "../../../styles/fouiFieldOperations.css";

type LoadState = "loading" | "ready" | "partial" | "error";

const COPY = {
  eyebrow: { zh: "田间智能", en: "Field Intelligence" },
  hero: { zh: "从田间现实开始。", en: "Start with field reality." },
  heroLead: {
    zh: "先看当前田块状态，再进入农艺判断与受治理作业。页面只展示现有只读来源，不补造缺失权威。",
    en: "Begin with current field state, then move into agronomy and governed operations. This page only displays existing read sources and never invents missing authority.",
  },
  attention: { zh: "需要处理", en: "Needs attention" },
  fields: { zh: "范围内田块", en: "Fields in scope" },
  approvals: { zh: "等待审批", en: "Awaiting approval" },
  evidence: { zh: "证据待复核", en: "Evidence review" },
  fieldOverview: { zh: "田块概览", en: "Field overview" },
  attentionQueue: { zh: "当前运营事项", en: "Current operating items" },
  viewFields: { zh: "查看全部田块", en: "View all fields" },
  openField: { zh: "进入田块", en: "Open field" },
  openItem: { zh: "处理事项", en: "Open item" },
  currentState: { zh: "当前状态", en: "Current state" },
  currentRisk: { zh: "当前风险 / 限制", en: "Current risk / limitation" },
  coverage: { zh: "数据覆盖", en: "Data coverage" },
  unavailable: { zh: "当前数据不可用", en: "Current data unavailable" },
  noFields: { zh: "当前范围没有可展示田块。", en: "No fields are available in the current scope." },
  noAttention: { zh: "当前没有可展示的运营待处理事项。", en: "No operating items are currently available." },
  sourceLimited: {
    zh: "运营事项来自有限 fallback 来源；页面保持原始队列语义，不使用旧 priority 作为产品权威。",
    en: "Operating items are from limited fallback sources. The page preserves queue semantics and does not use legacy priority as product authority.",
  },
} as const satisfies Record<string, LocalizedCopy>;

const QUEUE_COPY: Record<OperatorWorkbenchQueueKey, LocalizedCopy> = {
  APPROVAL_PENDING: { zh: "审批待处理", en: "Approval required" },
  DISPATCH_PENDING: { zh: "派发待处理", en: "Dispatch pending" },
  EXECUTION_EXCEPTION: { zh: "执行异常", en: "Execution intervention" },
  ACCEPTANCE_PENDING: { zh: "验收待处理", en: "Acceptance pending" },
  EVIDENCE_INSUFFICIENT: { zh: "证据不足", en: "Evidence incomplete" },
  ACCEPTANCE_FAILED: { zh: "验收未通过", en: "Acceptance review" },
  DEVICE_OFFLINE: { zh: "设备离线", en: "Device offline" },
  ALERT_OVERDUE: { zh: "告警超时", en: "Alert overdue" },
};

function scopeFromSearchParams(searchParams: URLSearchParams): OperatorTwinRequestScope {
  return {
    tenant_id: searchParams.get("tenant_id"),
    project_id: searchParams.get("project_id"),
    group_id: searchParams.get("group_id"),
  };
}

function countQueue(items: OperatorWorkbenchItem[], keys: OperatorWorkbenchQueueKey[]): number {
  return items.filter((item) => keys.includes(item.queue)).length;
}

function updatedText(value: string | null | undefined, locale: string): string {
  if (!value) return locale === "zh-CN" ? "更新时间未提供" : "Update time unavailable";
  const ms = Date.parse(value);
  if (!Number.isFinite(ms)) return value;
  return new Date(ms).toLocaleString(locale === "zh-CN" ? "zh-CN" : "en-US", { hour12: false });
}

export default function FieldOperationsHomePage(): React.ReactElement {
  const { locale } = useLocale();
  const [searchParams] = useSearchParams();
  const t = React.useCallback((copy: LocalizedCopy) => localizedText(copy, locale), [locale]);
  const scope = React.useMemo(() => scopeFromSearchParams(searchParams), [searchParams]);
  const scopeQuery = React.useMemo(() => buildOperatorTwinScopeQuery(scope), [scope]);
  const [state, setState] = React.useState<LoadState>("loading");
  const [overview, setOverview] = React.useState<OperatorTwinOverviewV1 | null>(null);
  const [workbench, setWorkbench] = React.useState<OperatorWorkbenchResponse | null>(null);
  const [errors, setErrors] = React.useState<string[]>([]);

  React.useEffect(() => {
    let active = true;
    setState("loading");
    setErrors([]);
    Promise.allSettled([fetchOperatorTwinOverview(scope), fetchOperatorWorkbench()]).then((results) => {
      if (!active) return;
      const nextErrors: string[] = [];
      const twin = results[0];
      const ops = results[1];
      if (twin.status === "fulfilled") setOverview(twin.value.operator_twin_overview_v1);
      else {
        setOverview(null);
        nextErrors.push(twin.reason instanceof Error ? twin.reason.message : String(twin.reason));
      }
      if (ops.status === "fulfilled") setWorkbench(ops.value);
      else {
        setWorkbench(null);
        nextErrors.push(ops.reason instanceof Error ? ops.reason.message : String(ops.reason));
      }
      setErrors(nextErrors);
      setState(nextErrors.length === 0 ? "ready" : (nextErrors.length === 2 ? "error" : "partial"));
    });
    return () => { active = false; };
  }, [scope]);

  const items = workbench?.items ?? [];
  const visibleFields = overview?.fields ?? [];
  const approvalCount = countQueue(items, ["APPROVAL_PENDING"]);
  const evidenceCount = countQueue(items, ["ACCEPTANCE_PENDING", "EVIDENCE_INSUFFICIENT", "ACCEPTANCE_FAILED"]);

  return (
    <div className="fouiPage fouiHome" data-foui-surface="home">
      <section className="fouiHero">
        <div>
          <span className="fouiEyebrow">{t(COPY.eyebrow)}</span>
          <h2>{t(COPY.hero)}</h2>
          <p>{t(COPY.heroLead)}</p>
        </div>
        <div className="fouiHeroActions">
          <Link className="fouiPrimaryLink" to={"/operator/fields" + scopeQuery}>{t(COPY.viewFields)}</Link>
          <Link className="fouiSecondaryLink" to="/operator/operations">{locale === "zh-CN" ? "查看运营" : "Open operations"}</Link>
        </div>
      </section>

      <section className="fouiMetricGrid" aria-label={locale === "zh-CN" ? "当前摘要" : "Current summary"}>
        <article className="fouiMetricCard"><span>{t(COPY.attention)}</span><strong>{items.length}</strong><small>{workbench?.dataScope ?? "—"}</small></article>
        <article className="fouiMetricCard"><span>{t(COPY.fields)}</span><strong>{visibleFields.length}</strong><small>operator_twin_overview_v1</small></article>
        <article className="fouiMetricCard"><span>{t(COPY.approvals)}</span><strong>{approvalCount}</strong><small>APPROVAL_PENDING</small></article>
        <article className="fouiMetricCard"><span>{t(COPY.evidence)}</span><strong>{evidenceCount}</strong><small>acceptance / evidence queues</small></article>
      </section>

      {workbench?.dataScope === "FALLBACK_LIMITED" ? <div className="fouiBoundaryNotice">{t(COPY.sourceLimited)}</div> : null}
      {state === "error" ? <div className="fouiBoundaryNotice fouiBoundaryNotice--error">{t(COPY.unavailable)}{errors.length ? " · " + errors.join(" | ") : ""}</div> : null}
      {state === "partial" ? <div className="fouiBoundaryNotice">{locale === "zh-CN" ? "部分只读来源暂不可用；其余来源继续显示。" : "Some read sources are unavailable; remaining sources are still shown."}</div> : null}

      <div className="fouiDashboardGrid">
        <section className="fouiPanel fouiPanel--wide">
          <header className="fouiPanelHeader">
            <div><span className="fouiEyebrow">MCFT / CURRENT WORLD</span><h3>{t(COPY.fieldOverview)}</h3></div>
            <Link to={"/operator/fields" + scopeQuery}>{t(COPY.viewFields)}</Link>
          </header>
          {visibleFields.length ? (
            <div className="fouiFieldGrid">
              {visibleFields.slice(0, 6).map((field) => (
                <article className="fouiFieldCard" key={field.field_id}>
                  <div className="fouiFieldCardTop"><div><strong>{field.field_name}</strong><small>{field.field_id} · {field.crop_text || "—"}</small></div><span className={field.low_confidence ? "fouiStatePill fouiStatePill--limited" : "fouiStatePill"}>{field.low_confidence ? (locale === "zh-CN" ? "受限" : "Limited") : (locale === "zh-CN" ? "当前" : "Current")}</span></div>
                  <dl className="fouiFieldFacts">
                    <div><dt>{t(COPY.currentState)}</dt><dd>{field.current_state_text || "—"}</dd></div>
                    <div><dt>{t(COPY.currentRisk)}</dt><dd>{field.risk_text || "—"}</dd></div>
                    <div><dt>{t(COPY.coverage)}</dt><dd>{field.data_coverage_text || "—"}</dd></div>
                  </dl>
                  <Link to={field.twin_href + scopeQuery}>{t(COPY.openField)} →</Link>
                </article>
              ))}
            </div>
          ) : <div className="fouiEmpty">{state === "loading" ? (locale === "zh-CN" ? "正在读取田块…" : "Loading fields…") : t(COPY.noFields)}</div>}
        </section>

        <section className="fouiPanel">
          <header className="fouiPanelHeader"><div><span className="fouiEyebrow">OPERATIONS</span><h3>{t(COPY.attentionQueue)}</h3></div><Link to="/operator/operations">{locale === "zh-CN" ? "查看全部" : "View all"}</Link></header>
          {items.length ? (
            <div className="fouiAttentionList">
              {items.slice(0, 7).map((item) => (
                <article className="fouiAttentionItem" key={item.id}>
                  <div><span className="fouiStatePill">{t(QUEUE_COPY[item.queue])}</span><strong>{item.title}</strong><p>{item.description}</p><small>{[item.fieldName, item.operationName, updatedText(item.updatedAt, locale)].filter(Boolean).join(" · ")}</small></div>
                  <Link to={item.actionHref} aria-label={t(COPY.openItem) + ": " + item.title}>→</Link>
                </article>
              ))}
            </div>
          ) : <div className="fouiEmpty">{state === "loading" ? (locale === "zh-CN" ? "正在读取运营事项…" : "Loading operating items…") : t(COPY.noAttention)}</div>}
        </section>
      </div>

      <section className="fouiDomainGrid" aria-label={locale === "zh-CN" ? "产品工作域" : "Product work areas"}>
        <Link className="fouiDomainCard" to="/operator/fields"><span>01</span><strong>{locale === "zh-CN" ? "田间智能" : "Field Intelligence"}</strong><p>{locale === "zh-CN" ? "当前田块状态、预测、证据轨迹与已知限制。" : "Current field state, forecast, evidence trace, and known limitations."}</p></Link>
        <Link className="fouiDomainCard" to="/operator/agronomy"><span>02</span><strong>{locale === "zh-CN" ? "农艺 / 规划" : "Agronomy / Planning"}</strong><p>{locale === "zh-CN" ? "种植规划、农艺建议与决策历史；缺失 projection 明确保持未开放。" : "Season planning, agronomic guidance, and decision history; missing projections remain explicitly unavailable."}</p></Link>
        <Link className="fouiDomainCard" to="/operator/operations"><span>03</span><strong>{locale === "zh-CN" ? "运营" : "Operations"}</strong><p>{locale === "zh-CN" ? "审批、派发、执行回执与证据复核，权威仍由 B-Line command boundary 拥有。" : "Approval, dispatch, execution receipts, and evidence review while B-Line retains command authority."}</p></Link>
      </section>
    </div>
  );
}
