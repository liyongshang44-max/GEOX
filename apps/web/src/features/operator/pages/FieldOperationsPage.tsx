import React from "react";
import { Link } from "react-router-dom";
import {
  fetchOperatorWorkbench,
  type OperatorWorkbenchItem,
  type OperatorWorkbenchQueueKey,
  type OperatorWorkbenchResponse,
} from "../../../api/operatorWorkbench";
import { localizedText, useLocale, type LocalizedCopy } from "../../../lib/locale";
import "../../../styles/fouiFieldOperations.css";

type LoadState = "loading" | "ready" | "error";

const GROUPS: Array<{ key: OperatorWorkbenchQueueKey; label: LocalizedCopy; description: LocalizedCopy }> = [
  { key: "APPROVAL_PENDING", label: { zh: "等待审批", en: "Approval required" }, description: { zh: "建议或动作等待具备权限的人做出审批决定。", en: "Recommendations or actions awaiting an authorized approval decision." } },
  { key: "DISPATCH_PENDING", label: { zh: "等待派发", en: "Dispatch pending" }, description: { zh: "已有执行任务，但尚未形成派发。", en: "Execution tasks exist but have not yet been dispatched." } },
  { key: "EXECUTION_EXCEPTION", label: { zh: "执行介入", en: "Execution intervention" }, description: { zh: "执行链出现异常，需要运营人员复核。", en: "The execution chain contains an exception that needs operator review." } },
  { key: "ACCEPTANCE_PENDING", label: { zh: "等待证据验收", en: "Evidence acceptance pending" }, description: { zh: "执行已报告，但执行证据尚未形成验收结论。", en: "Execution has been reported but execution evidence has not yet received an acceptance result." } },
  { key: "EVIDENCE_INSUFFICIENT", label: { zh: "证据不足", en: "Evidence incomplete" }, description: { zh: "当前证据不足以满足定义的验收要求。", en: "Current evidence is insufficient for the defined acceptance requirement." } },
  { key: "ACCEPTANCE_FAILED", label: { zh: "验收复核", en: "Acceptance review" }, description: { zh: "执行证据未通过当前验收规则，需要复核或补证。", en: "Execution evidence did not pass the current acceptance rule and needs review or additional evidence." } },
];

const COPY = {
  eyebrow: { zh: "运营与问责", en: "Operations & Accountability" },
  title: { zh: "从批准到证据，保持每一步可追踪。", en: "Keep every step traceable from approval to proof." },
  lead: {
    zh: "这个页面只组织现有 B-Line 运营能力。Approve、Dispatch 等写动作仍由原 command API 重新认证与授权；FOUI 不拥有 approve()。",
    en: "This page organizes existing B-Line operating capabilities. Write actions such as Approve and Dispatch remain reauthenticated and reauthorized by the existing command APIs; FOUI does not own approve().",
  },
} as const satisfies Record<string, LocalizedCopy>;

function updatedText(value: string | null | undefined, locale: string): string {
  if (!value) return locale === "zh-CN" ? "更新时间未提供" : "Update time unavailable";
  const ms = Date.parse(value);
  if (!Number.isFinite(ms)) return value;
  return new Date(ms).toLocaleString(locale === "zh-CN" ? "zh-CN" : "en-US", { hour12: false });
}

function OperationItem({ item, locale }: { item: OperatorWorkbenchItem; locale: string }): React.ReactElement {
  return (
    <article className="fouiOperationItem">
      <div className="fouiOperationItemMain">
        <strong>{item.title}</strong>
        <p>{item.description}</p>
        <small>{[item.fieldName, item.operationName, updatedText(item.updatedAt, locale)].filter(Boolean).join(" · ")}</small>
      </div>
      <div className="fouiOperationItemActions">
        <Link to={item.actionHref}>{locale === "zh-CN" ? "打开" : "Open"} →</Link>
        {item.relatedHref ? <Link className="fouiTextLink" to={item.relatedHref}>{locale === "zh-CN" ? "查看对象" : "View object"}</Link> : null}
      </div>
    </article>
  );
}

export default function FieldOperationsPage(): React.ReactElement {
  const { locale } = useLocale();
  const t = (copy: LocalizedCopy) => localizedText(copy, locale);
  const [state, setState] = React.useState<LoadState>("loading");
  const [workbench, setWorkbench] = React.useState<OperatorWorkbenchResponse | null>(null);
  const [error, setError] = React.useState("");

  React.useEffect(() => {
    let active = true;
    setState("loading");
    fetchOperatorWorkbench()
      .then((response) => { if (!active) return; setWorkbench(response); setState("ready"); })
      .catch((reason: unknown) => { if (!active) return; setError(reason instanceof Error ? reason.message : String(reason)); setState("error"); });
    return () => { active = false; };
  }, []);

  const items = workbench?.items ?? [];

  return (
    <div className="fouiPage fouiOperations" data-foui-surface="operations">
      <section className="fouiHero">
        <div><span className="fouiEyebrow">{t(COPY.eyebrow)}</span><h2>{t(COPY.title)}</h2><p>{t(COPY.lead)}</p></div>
        <div className="fouiHeroActions"><Link className="fouiSecondaryLink" to="/operator/approvals">{locale === "zh-CN" ? "审批" : "Approvals"}</Link><Link className="fouiSecondaryLink" to="/operator/dispatch">{locale === "zh-CN" ? "派发" : "Dispatch"}</Link></div>
      </section>

      <section className="fouiMetricGrid">
        {GROUPS.slice(0, 4).map((group) => <article className="fouiMetricCard" key={group.key}><span>{t(group.label)}</span><strong>{items.filter((item) => item.queue === group.key).length}</strong><small>{group.key}</small></article>)}
      </section>

      {workbench?.dataScope === "FALLBACK_LIMITED" ? <div className="fouiBoundaryNotice">{locale === "zh-CN" ? "当前运营数据为有限 fallback 视图；不把 legacy priority / severity 升格为 FOUI attention authority。" : "Current operating data is a limited fallback view; legacy priority / severity is not promoted into FOUI attention authority."}</div> : null}
      {state === "error" ? <div className="fouiBoundaryNotice fouiBoundaryNotice--error">{locale === "zh-CN" ? "运营数据读取失败：" : "Operations read failed: "}{error}</div> : null}

      <section className="fouiOperationsBoard" aria-label={locale === "zh-CN" ? "运营队列" : "Operations queues"}>
        {GROUPS.map((group) => {
          const groupItems = items.filter((item) => item.queue === group.key);
          return (
            <article className="fouiPanel fouiQueuePanel" key={group.key}>
              <header className="fouiPanelHeader"><div><span className="fouiEyebrow">{group.key}</span><h3>{t(group.label)}</h3><p>{t(group.description)}</p></div><strong className="fouiQueueCount">{groupItems.length}</strong></header>
              {groupItems.length ? <div className="fouiOperationList">{groupItems.slice(0, 8).map((item) => <OperationItem key={item.id} item={item} locale={locale} />)}</div> : <div className="fouiEmpty">{state === "loading" ? (locale === "zh-CN" ? "正在读取…" : "Loading…") : (locale === "zh-CN" ? "当前没有该类事项。" : "No items in this queue.")}</div>}
            </article>
          );
        })}
      </section>

      <section className="fouiPanel">
        <header className="fouiPanelHeader"><div><span className="fouiEyebrow">EXISTING B-LINE SURFACES</span><h3>{locale === "zh-CN" ? "现有能力入口" : "Existing operating capabilities"}</h3></div></header>
        <div className="fouiCapabilityLinks">
          <Link to="/operator/approvals"><strong>{locale === "zh-CN" ? "审批" : "Approvals"}</strong><small>Approval Request / Approval Decision</small></Link>
          <Link to="/operator/dispatch"><strong>{locale === "zh-CN" ? "派发" : "Dispatch"}</strong><small>Task / Dispatch / ACK / Receipt</small></Link>
          <Link to="/operator/acceptance"><strong>{locale === "zh-CN" ? "证据验收" : "Evidence acceptance"}</strong><small>AcceptanceResult ≠ Outcome</small></Link>
          <Link to="/operator/evidence"><strong>{locale === "zh-CN" ? "证据导出" : "Evidence export"}</strong><small>{locale === "zh-CN" ? "导出能力，不等于 canonical Evidence chain" : "Export capability, not the canonical Evidence chain"}</small></Link>
        </div>
      </section>
    </div>
  );
}
