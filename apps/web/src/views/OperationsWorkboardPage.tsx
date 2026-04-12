import React from "react";
import { Link, useSearchParams } from "react-router-dom";
import {
  assignAlert,
  closeAlert,
  fetchAlertWorkboard,
  noteAlert,
  resolveAlert,
  startAlert,
  summarizeAlertWorkboard,
  type AlertWorkItemV1,
  type AlertWorkflowMutationPayload,
  type AlertWorkflowStatus,
} from "../api/alertWorkflow";
import { alertCategoryLabel } from "../lib/alertLabels";
import { PageHeader, SectionCard } from "../shared/ui";

const STATUS_TEXT: Record<string, string> = {
  OPEN: "未分配",
  ASSIGNED: "已分配",
  IN_PROGRESS: "处理中",
  ACKED: "已确认",
  RESOLVED: "已解决",
  CLOSED: "已关闭",
};

function formatDeadline(deadlineMs: number | null): string {
  if (!deadlineMs) return "--";
  const date = new Date(deadlineMs);
  return Number.isNaN(date.getTime()) ? "--" : date.toLocaleString("zh-CN", { hour12: false });
}

export default function OperationsWorkboardPage(): React.ReactElement {
  const [searchParams] = useSearchParams();
  const [items, setItems] = React.useState<AlertWorkItemV1[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState("");
  const [assigneeDrafts, setAssigneeDrafts] = React.useState<Record<string, string>>({});
  const [noteDrafts, setNoteDrafts] = React.useState<Record<string, string>>({});
  const [pendingActions, setPendingActions] = React.useState<Record<string, boolean>>({});
  const [actionErrors, setActionErrors] = React.useState<Record<string, string>>({});

  const assignee = searchParams.get("assignee") || "";
  const workflowStatus = searchParams.get("workflow_status") || "";
  const field = searchParams.get("field") || "";
  const onlyBreached = searchParams.get("sla_breached") === "true";
  const alertId = searchParams.get("alert_id") || "";

  const loadWorkboard = React.useCallback(async (): Promise<AlertWorkItemV1[]> => {
    setLoading(true);
    setError("");
    const rows = await fetchAlertWorkboard();
    return rows;
  }, []);

  React.useEffect(() => {
    let alive = true;
    void loadWorkboard()
      .then((rows) => {
        if (!alive) return;
        setItems(rows);
      })
      .catch((e: unknown) => {
        if (!alive) return;
        setItems([]);
        setError(String(e instanceof Error ? e.message : "加载失败"));
      })
      .finally(() => {
        if (!alive) return;
        setLoading(false);
      });
    return () => {
      alive = false;
    };
  }, [loadWorkboard]);

  const runAction = React.useCallback(async (item: AlertWorkItemV1, action: "assign" | "start" | "note" | "resolve" | "close") => {
    const actionKey = `${item.alert_id}:${action}`;
    const assigneeActorId = (assigneeDrafts[item.alert_id] || "").trim();
    const note = (noteDrafts[item.alert_id] || "").trim();
    const payload: AlertWorkflowMutationPayload = {};

    if (assigneeActorId) payload.assignee_actor_id = assigneeActorId;
    if (note) payload.note = note;

    setPendingActions((prev) => ({ ...prev, [actionKey]: true }));
    setActionErrors((prev) => ({ ...prev, [item.alert_id]: "" }));

    try {
      if (action === "assign") await assignAlert(item.alert_id, payload);
      if (action === "start") await startAlert(item.alert_id, payload);
      if (action === "note") await noteAlert(item.alert_id, payload);
      if (action === "resolve") await resolveAlert(item.alert_id, payload);
      if (action === "close") await closeAlert(item.alert_id, payload);
      const rows = await loadWorkboard();
      setItems(rows);
    } catch (e: unknown) {
      setActionErrors((prev) => ({ ...prev, [item.alert_id]: String(e instanceof Error ? e.message : "操作失败") }));
    } finally {
      setPendingActions((prev) => ({ ...prev, [actionKey]: false }));
    }
  }, [assigneeDrafts, loadWorkboard, noteDrafts]);

  const filteredItems = React.useMemo(() => items.filter((item) => {
    if (assignee && `${item.assignee.name || ""}${item.assignee.actor_id || ""}`.toLowerCase().includes(assignee.toLowerCase()) === false) return false;
    if (workflowStatus && item.workflow_status !== (workflowStatus as AlertWorkflowStatus)) return false;
    if (field && String(item.field_id || "").includes(field) === false) return false;
    if (onlyBreached && !item.sla_breached) return false;
    if (alertId && item.alert_id !== alertId) return false;
    return true;
  }), [alertId, assignee, field, items, onlyBreached, workflowStatus]);

  const summary = React.useMemo(() => summarizeAlertWorkboard(filteredItems), [filteredItems]);

  return (
    <div className="demoDashboardPage">
      <PageHeader
        eyebrow="GEOX / 运营作业台"
        title="Operations Workboard"
        description="统一使用 /api/v1/alerts/workboard 读模型。"
        actions={<Link className="btn" to="/operations">返回作业页</Link>}
      />

      <SectionCard title="顶部摘要">
        <div className="kvGrid2">
          <div><strong>未分配：</strong>{summary.unassigned}</div>
          <div><strong>处理中：</strong>{summary.in_progress}</div>
          <div><strong>已超时：</strong>{summary.sla_breached}</div>
          <div><strong>总数：</strong>{summary.total}</div>
        </div>
      </SectionCard>

      <SectionCard title={`工作项列表（${filteredItems.length}）`} subtitle="支持通过 query 参数跳转过滤视图：assignee / workflow_status / field / sla_breached / alert_id">
        <div className="list">
          {loading ? <div className="muted">正在加载...</div> : null}
          {!loading && filteredItems.map((item) => (
            <article key={item.alert_id} className="item">
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12 }}>
                <div>
                  <strong>{item.alert_id} · {alertCategoryLabel(item.category)}</strong>
                  <div className="muted">{item.field_id || "--"} · {STATUS_TEXT[item.workflow_status] || item.workflow_status} · P{item.priority}</div>
                </div>
                <span className={`statusTag ${item.sla_breached ? "tone-warning" : "tone-neutral"}`}>{item.sla_breached ? "已超时" : "SLA 正常"}</span>
              </div>
              <div className="kvGrid2" style={{ marginTop: 8 }}>
                <div><strong>assignee：</strong>{item.assignee.name || item.assignee.actor_id || "--"}</div>
                <div><strong>workflow_status：</strong>{item.workflow_status}</div>
                <div><strong>SLA：</strong>{formatDeadline(item.sla_due_at)}</div>
                <div><strong>最后备注：</strong>{item.last_note || "--"}</div>
              </div>
              <div style={{ marginTop: 12, borderTop: "1px solid #eee", paddingTop: 12 }}>
                <div className="kvGrid2">
                  <label>
                    <strong>assignee_actor_id：</strong>
                    <input
                      value={assigneeDrafts[item.alert_id] ?? ""}
                      onChange={(event) => {
                        const nextValue = event.currentTarget.value;
                        setAssigneeDrafts((prev) => ({ ...prev, [item.alert_id]: nextValue }));
                      }}
                      placeholder="输入要指派的 actor_id"
                      disabled={Object.keys(pendingActions).some((key) => key.startsWith(`${item.alert_id}:`) && pendingActions[key])}
                    />
                  </label>
                  <label>
                    <strong>备注：</strong>
                    <input
                      value={noteDrafts[item.alert_id] ?? ""}
                      onChange={(event) => {
                        const nextValue = event.currentTarget.value;
                        setNoteDrafts((prev) => ({ ...prev, [item.alert_id]: nextValue }));
                      }}
                      placeholder="输入备注内容"
                      disabled={Object.keys(pendingActions).some((key) => key.startsWith(`${item.alert_id}:`) && pendingActions[key])}
                    />
                  </label>
                </div>
                <div style={{ marginTop: 8, display: "flex", gap: 8, flexWrap: "wrap" }}>
                  {([
                    { key: "assign", label: "指派" },
                    { key: "start", label: "开始处理" },
                    { key: "note", label: "备注" },
                    { key: "resolve", label: "解决" },
                    { key: "close", label: "关闭" },
                  ] as const).map((action) => {
                    const isPending = pendingActions[`${item.alert_id}:${action.key}`] === true;
                    const itemBusy = Object.keys(pendingActions).some((key) => key.startsWith(`${item.alert_id}:`) && pendingActions[key]);
                    return (
                      <button
                        key={action.key}
                        type="button"
                        className="btn"
                        disabled={itemBusy}
                        onClick={() => {
                          void runAction(item, action.key);
                        }}
                      >
                        {isPending ? `${action.label}中...` : action.label}
                      </button>
                    );
                  })}
                </div>
                {actionErrors[item.alert_id] ? <div className="muted" style={{ marginTop: 8, color: "#b42318" }}>{actionErrors[item.alert_id]}</div> : null}
              </div>
            </article>
          ))}
          {!loading && !filteredItems.length ? <div className="muted">暂无匹配的工作项</div> : null}
          {error ? <div className="muted">{error}</div> : null}
        </div>
      </SectionCard>
    </div>
  );
}
