import React from "react";
import { Link, useSearchParams } from "react-router-dom";
import { fetchAlertWorkboard, summarizeAlertWorkboard, type AlertWorkItemV1, type AlertWorkflowStatus } from "../api/alertWorkflow";
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

  const assignee = searchParams.get("assignee") || "";
  const workflowStatus = searchParams.get("workflow_status") || "";
  const field = searchParams.get("field") || "";
  const onlyBreached = searchParams.get("sla_breached") === "true";
  const alertId = searchParams.get("alert_id") || "";

  React.useEffect(() => {
    let alive = true;
    setLoading(true);
    setError("");
    void fetchAlertWorkboard()
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
  }, []);

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
            </article>
          ))}
          {!loading && !filteredItems.length ? <div className="muted">暂无匹配的工作项</div> : null}
          {error ? <div className="muted">{error}</div> : null}
        </div>
      </SectionCard>
    </div>
  );
}
