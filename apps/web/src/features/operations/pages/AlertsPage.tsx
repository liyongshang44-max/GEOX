import React from "react";
import { Link } from "react-router-dom";
import { fetchAuthMe } from "../../../api/auth";
import { ackAlert, ALERT_SEVERITY, ALERT_STATUS, resolveAlert, type AlertStatus } from "../../../api/alerts";
import { fetchAlertWorkboard, summarizeAlertWorkboard, type AlertWorkItemV1 } from "../../../api/alertWorkflow";
import { alertCategoryLabel, alertStatusLabel } from "../../../lib/alertLabels";

function fmtTs(iso: string | null | undefined): string {
  if (!iso) return "-";
  const ts = Date.parse(String(iso));
  if (!Number.isFinite(ts) || ts <= 0) return "-";
  return new Date(ts).toLocaleString("zh-CN", { hour12: false });
}

function toObjectDetailPath(objectType: string, objectId: string): string | null {
  const safeId = encodeURIComponent(String(objectId ?? "").trim());
  if (!safeId) return null;
  const key = String(objectType ?? "").trim().toUpperCase();
  if (key.includes("OPERATION")) return `/operations/${safeId}`;
  if (key.includes("FIELD")) return `/fields/${safeId}`;
  if (key.includes("DEVICE")) return `/devices/${safeId}`;
  return null;
}

function resolveRelatedLinks(item: AlertWorkItemV1): Array<{ label: string; to: string }> {
  const links: Array<{ label: string; to: string }> = [];
  const seen = new Set<string>();
  const push = (label: string, to: string | null): void => {
    if (!to) return;
    const key = `${label}:${to}`;
    if (seen.has(key)) return;
    seen.add(key);
    links.push({ label, to });
  };

  push(`关联${item.object_type}`, toObjectDetailPath(item.object_type, item.object_id));
  for (const ref of item.source_refs || []) {
    const labelType = String(ref.type ?? "关联对象").toUpperCase();
    push(`来源${labelType}`, toObjectDetailPath(labelType, ref.id));
  }
  return links;
}

export default function AlertsPage(): React.ReactElement {
  const [items, setItems] = React.useState<AlertWorkItemV1[]>([]);
  const [busy, setBusy] = React.useState(false);
  const [statusText, setStatusText] = React.useState("正在准备告警中心...");
  const [lastAction, setLastAction] = React.useState("-");
  const [severityFilter, setSeverityFilter] = React.useState<"" | keyof typeof ALERT_SEVERITY>("");
  const [statusFilter, setStatusFilter] = React.useState<"" | keyof typeof ALERT_STATUS>("");
  const [categoryFilter, setCategoryFilter] = React.useState("");
  const [role, setRole] = React.useState<string>("operator");
  const [summary, setSummary] = React.useState<{ total: number; unassigned: number; inProgress: number; breached: number }>({
    total: 0,
    unassigned: 0,
    inProgress: 0,
    breached: 0,
  });

  const canResolve = role !== "operator";

  async function refresh(): Promise<void> {
    setBusy(true);
    setStatusText("正在同步 AlertV1 列表...");
    try {
      const allItems = await fetchAlertWorkboard();
      const nextItems = allItems.filter((row) => {
        if (severityFilter && row.severity !== severityFilter) return false;
        if (statusFilter && row.workflow_status !== statusFilter) return false;
        if (categoryFilter.trim() && String(row.category || "").toUpperCase().includes(categoryFilter.trim().toUpperCase()) === false) return false;
        return true;
      });
      const nextSummary = summarizeAlertWorkboard(nextItems);
      setItems(nextItems);
      setSummary({ total: nextSummary.total, unassigned: nextSummary.unassigned, inProgress: nextSummary.in_progress, breached: nextSummary.sla_breached });
      setStatusText(`已加载 ${nextItems.length} 条告警。`);
    } catch (e: unknown) {
      setStatusText(`读取失败：${e instanceof Error ? e.message : String(e)}`);
    } finally {
      setBusy(false);
    }
  }

  async function handleAck(alertId: string): Promise<void> {
    setBusy(true);
    setLastAction(`正在确认 ${alertId} ...`);
    try {
      await ackAlert(alertId);
      setLastAction(`已确认：${alertId}`);
      await refresh();
    } catch (e: unknown) {
      setLastAction(`确认失败：${e instanceof Error ? e.message : String(e)}`);
    } finally {
      setBusy(false);
    }
  }

  async function handleResolve(alertId: string): Promise<void> {
    if (!canResolve) {
      setLastAction("当前角色无关闭权限（仅管理员可关闭）。");
      return;
    }
    setBusy(true);
    setLastAction(`正在关闭 ${alertId} ...`);
    try {
      await resolveAlert(alertId);
      setLastAction(`已关闭：${alertId}`);
      await refresh();
    } catch (e: unknown) {
      setLastAction(`关闭失败：${e instanceof Error ? e.message : String(e)}`);
    } finally {
      setBusy(false);
    }
  }

  React.useEffect(() => {
    void refresh();
    void fetchAuthMe().then((me) => setRole(String(me.role || "operator"))).catch(() => setRole("operator"));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="consolePage">
      <section className="hero card compactHero">
        <div>
          <div className="eyebrow">Alerts · V1</div>
          <h2 className="heroTitle">告警中心</h2>
          <p className="heroText">摘要卡、筛选器、告警列表与角色化动作（Ack/Resolve）统一基于 /api/v1/alerts/workboard 读模型。</p>
        </div>
        <div className="heroActions">
          <button className="btn primary" onClick={() => void refresh()} disabled={busy}>刷新告警</button>
          <Link className="btn" to="/operations/workboard">进入作业台</Link>
        </div>
      </section>

      <div className="summaryGrid">
        <div className="metricCard card"><div className="metricLabel">告警总数</div><div className="metricValue">{summary.total}</div><div className="metricHint">当前筛选范围</div></div>
        <div className="metricCard card"><div className="metricLabel">未分配</div><div className="metricValue">{summary.unassigned}</div><div className="metricHint">workflow OPEN</div></div>
        <div className="metricCard card"><div className="metricLabel">处理中</div><div className="metricValue">{summary.inProgress}</div><div className="metricHint">ASSIGNED/IN_PROGRESS/ACKED</div></div>
        <div className="metricCard card"><div className="metricLabel">已超时</div><div className="metricValue">{summary.breached}</div><div className="metricHint">sla_breached</div></div>
      </div>

      <section className="card sectionBlock">
        <div className="sectionHeader"><div><div className="sectionTitle">筛选</div><div className="sectionDesc">按严重度/状态/分类过滤告警。</div></div></div>
        <div className="formGridTwo">
          <label className="field">严重度<select className="input" value={severityFilter} onChange={(e) => setSeverityFilter(e.target.value as "" | keyof typeof ALERT_SEVERITY)}><option value="">全部</option><option value="LOW">LOW</option><option value="MEDIUM">MEDIUM</option><option value="HIGH">HIGH</option><option value="CRITICAL">CRITICAL</option></select></label>
          <label className="field">状态<select className="input" value={statusFilter} onChange={(e) => setStatusFilter(e.target.value as "" | AlertStatus)}><option value="">全部</option><option value="OPEN">未处理</option><option value="ACKED">已确认</option><option value="CLOSED">已关闭</option></select></label>
          <label className="field">分类<input className="input" value={categoryFilter} onChange={(e) => setCategoryFilter(e.target.value)} placeholder="如 EVIDENCE_MISSING" /></label>
        </div>
        <div className="inlineActions"><button className="btn" onClick={() => void refresh()} disabled={busy}>应用筛选</button></div>
        <div className="devBanner">当前角色：{role}；最近动作：{lastAction}</div>
      </section>

      <section className="card sectionBlock">
        <div className="sectionHeader"><div><div className="sectionTitle">告警列表</div><div className="sectionDesc">支持 operation / field / device 关联跳转。</div></div></div>
        <div className="list modernList">
          {items.map((item) => {
            const relatedLinks = resolveRelatedLinks(item);
            return (
              <div key={item.alert_id} className="infoCard">
                <div className="jobTitleRow"><div><div className="title">{alertCategoryLabel(item.category)}</div><div className="metaText">{item.alert_id}</div></div><div className={`pill tone-${item.status === "OPEN" ? "bad" : item.status === "ACKED" ? "warn" : "ok"}`}>{alertStatusLabel(item.status)}</div></div>
                <div className="meta wrapMeta">
                  <span>严重度：{item.severity}</span>
                  <span>对象：{item.object_type} / {item.object_id}</span>
                  <span>触发时间：{fmtTs(item.triggered_at)}</span>
                  <span>原因：{item.reasons?.length ? item.reasons.join(" / ") : "-"}</span>
                  <span>assignee：{item.assignee.name || item.assignee.actor_id || "-"}</span>
                  <span>workflow_status：{item.workflow_status}</span>
                  <span>sla_breached：{item.sla_breached ? "是" : "否"}</span>
                </div>
                <div className="inlineActions" style={{ flexWrap: "wrap" }}>
                  {relatedLinks.map((lnk) => <Link key={`${item.alert_id}-${lnk.to}-${lnk.label}`} className="btn" to={lnk.to}>{lnk.label}</Link>)}
                  <Link className="btn" to={`/operations/workboard?alert_id=${encodeURIComponent(item.alert_id)}`}>作业台视图</Link>
                </div>
                <div className="inlineActions"><button className="btn" onClick={() => void handleAck(item.alert_id)} disabled={busy || item.status === "CLOSED"}>确认</button><button className="btn" onClick={() => void handleResolve(item.alert_id)} disabled={busy || item.status === "CLOSED" || !canResolve}>关闭</button></div>
              </div>
            );
          })}
          {!items.length ? <div className="emptyState">当前没有告警。</div> : null}
        </div>
      </section>

      <section className="card sectionBlock"><div className="sectionDesc">{statusText}</div></section>
    </div>
  );
}
