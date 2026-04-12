import React from "react";
import { Link } from "react-router-dom";
import { fetchAuthMe } from "../../../api/auth";
import {
  ALERT_WORKFLOW_STATUS,
  assignAlert,
  closeAlert,
  fetchAlertWorkboard,
  fetchAlertWorkboardSummary,
  noteAlert,
  resolveAlert,
  startAlert,
  type AlertWorkItemV1,
  type AlertWorkflowStatus,
} from "../../../api/alertWorkflow";
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
  const [severityFilter, setSeverityFilter] = React.useState<"" | AlertWorkItemV1["severity"]>("");
  const [workflowStatusFilter, setWorkflowStatusFilter] = React.useState<"" | AlertWorkflowStatus>("");
  const [categoryFilter, setCategoryFilter] = React.useState("");
  const [assigneeFilter, setAssigneeFilter] = React.useState("");
  const [slaBreachedFilter, setSlaBreachedFilter] = React.useState<"" | "true" | "false">("");
  const [role, setRole] = React.useState<string>("operator");
  const [currentActorId, setCurrentActorId] = React.useState<string>("");
  const [currentActorName, setCurrentActorName] = React.useState<string>("");
  const [summary, setSummary] = React.useState<{ total: number; unassigned: number; inProgress: number; breached: number; closedToday: number }>({
    total: 0,
    unassigned: 0,
    inProgress: 0,
    breached: 0,
    closedToday: 0,
  });

  async function refresh(): Promise<void> {
    setBusy(true);
    setStatusText("正在同步 AlertV1 列表...");
    try {
      const queryParams = {
        severity: severityFilter ? [severityFilter] : undefined,
        workflow_status: workflowStatusFilter || undefined,
        category: categoryFilter.trim() ? [categoryFilter.trim()] : undefined,
        assignee_actor_id: assigneeFilter.trim() || undefined,
        sla_breached: slaBreachedFilter === "" ? undefined : slaBreachedFilter === "true",
      };
      const [nextItems, nextSummary] = await Promise.all([
        fetchAlertWorkboard(queryParams),
        fetchAlertWorkboardSummary(queryParams),
      ]);
      setItems(nextItems);
      setSummary({
        total: nextSummary.total,
        unassigned: nextSummary.unassigned,
        inProgress: nextSummary.in_progress,
        breached: nextSummary.sla_breached,
        closedToday: nextSummary.closed_today,
      });
      setStatusText(`已加载 ${nextItems.length} 条告警。`);
    } catch (e: unknown) {
      setStatusText(`读取失败：${e instanceof Error ? e.message : String(e)}`);
    } finally {
      setBusy(false);
    }
  }

  async function runWorkflowAction(item: AlertWorkItemV1, action: "assign" | "start" | "note" | "resolve" | "close"): Promise<void> {
    const alertId = item.alert_id;
    setBusy(true);
    setLastAction(`正在执行 ${action.toUpperCase()}：${alertId} ...`);
    try {
      if (action === "assign") {
        await assignAlert(alertId, {
          assignee_actor_id: currentActorId || role || "operator",
          assignee_name: currentActorName || role || "operator",
        });
      } else if (action === "start") {
        await startAlert(alertId, {});
      } else if (action === "note") {
        await noteAlert(alertId, { note: `操作员 ${currentActorName || role} 在 Alerts 页面记录跟进。` });
      } else if (action === "resolve") {
        await resolveAlert(alertId, {});
      } else {
        await closeAlert(alertId, {});
      }
      setLastAction(`已执行 ${action.toUpperCase()}：${alertId}`);
      await refresh();
    } catch (e: unknown) {
      setLastAction(`${action.toUpperCase()} 失败：${e instanceof Error ? e.message : String(e)}`);
    } finally {
      setBusy(false);
    }
  }

  function getWorkflowActions(status: AlertWorkflowStatus): Array<{ key: "assign" | "start" | "note" | "resolve" | "close"; label: string; enabled: boolean }> {
    return [
      { key: "assign", label: "分配", enabled: status === ALERT_WORKFLOW_STATUS.OPEN },
      { key: "start", label: "开始处理", enabled: status === ALERT_WORKFLOW_STATUS.ASSIGNED || status === ALERT_WORKFLOW_STATUS.ACKED },
      { key: "note", label: "记录备注", enabled: status !== ALERT_WORKFLOW_STATUS.CLOSED },
      { key: "resolve", label: "解决", enabled: status === ALERT_WORKFLOW_STATUS.IN_PROGRESS || status === ALERT_WORKFLOW_STATUS.ACKED || status === ALERT_WORKFLOW_STATUS.ASSIGNED },
      { key: "close", label: "关闭", enabled: status === ALERT_WORKFLOW_STATUS.RESOLVED },
    ];
  }

  React.useEffect(() => {
    void refresh();
    void fetchAuthMe().then((me) => {
      setRole(String(me.role || "operator"));
      setCurrentActorId(String(me.actor_id || "operator"));
      setCurrentActorName(String(me.actor_id || me.role || "operator"));
    }).catch(() => {
      setRole("operator");
      setCurrentActorId("operator");
      setCurrentActorName("operator");
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="consolePage">
      <section className="hero card compactHero">
        <div>
          <div className="eyebrow">Alerts · V1</div>
          <h2 className="heroTitle">告警中心</h2>
          <p className="heroText">摘要卡、筛选器、告警列表与工作流动作（Assign/Start/Note/Resolve/Close）统一基于 /api/v1/alerts/workboard 读模型。</p>
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
        <div className="metricCard card"><div className="metricLabel">今日关闭</div><div className="metricValue">{summary.closedToday}</div><div className="metricHint">closed_today</div></div>
      </div>

      <section className="card sectionBlock">
        <div className="sectionHeader"><div><div className="sectionTitle">筛选</div><div className="sectionDesc">按严重度、分类、工作流状态、assignee、SLA 超时过滤告警（后端参数）。</div></div></div>
        <div className="formGridTwo">
          <label className="field">严重度<select className="input" value={severityFilter} onChange={(e) => setSeverityFilter(e.target.value as "" | AlertWorkItemV1["severity"])}><option value="">全部</option><option value="LOW">LOW</option><option value="MEDIUM">MEDIUM</option><option value="HIGH">HIGH</option><option value="CRITICAL">CRITICAL</option></select></label>
          <label className="field">工作流状态<select className="input" value={workflowStatusFilter} onChange={(e) => setWorkflowStatusFilter(e.target.value as "" | AlertWorkflowStatus)}><option value="">全部</option><option value="OPEN">OPEN</option><option value="ASSIGNED">ASSIGNED</option><option value="IN_PROGRESS">IN_PROGRESS</option><option value="ACKED">ACKED</option><option value="RESOLVED">RESOLVED</option><option value="CLOSED">CLOSED</option></select></label>
          <label className="field">分类<input className="input" value={categoryFilter} onChange={(e) => setCategoryFilter(e.target.value)} placeholder="如 EVIDENCE_MISSING" /></label>
          <label className="field">Assignee<input className="input" value={assigneeFilter} onChange={(e) => setAssigneeFilter(e.target.value)} placeholder="actor_id" /></label>
          <label className="field">SLA 超时<select className="input" value={slaBreachedFilter} onChange={(e) => setSlaBreachedFilter(e.target.value as "" | "true" | "false")}><option value="">全部</option><option value="true">是</option><option value="false">否</option></select></label>
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
                  <span>assignee：<strong>{item.assignee.name || item.assignee.actor_id || "未分配"}</strong></span>
                  <span>workflow_status：<strong>{item.workflow_status}</strong></span>
                  <span>sla_breached：<strong style={{ color: item.sla_breached ? "var(--danger-600, #d32f2f)" : undefined }}>{item.sla_breached ? "是" : "否"}</strong></span>
                </div>
                <div className="inlineActions" style={{ flexWrap: "wrap" }}>
                  {relatedLinks.map((lnk) => <Link key={`${item.alert_id}-${lnk.to}-${lnk.label}`} className="btn" to={lnk.to}>{lnk.label}</Link>)}
                  <Link className="btn" to={`/operations/workboard?alert_id=${encodeURIComponent(item.alert_id)}`}>作业台视图</Link>
                </div>
                <div className="inlineActions">
                  {getWorkflowActions(item.workflow_status).map((action) => (
                    <button key={`${item.alert_id}-${action.key}`} className="btn" onClick={() => void runWorkflowAction(item, action.key)} disabled={busy || !action.enabled}>{action.label}</button>
                  ))}
                </div>
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
