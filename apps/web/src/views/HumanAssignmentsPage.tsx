import React from "react";
import { Link } from "react-router-dom";
import EmptyState from "../components/common/EmptyState";
import {
  batchCancelWorkAssignments,
  fetchHumanExecutors,
  fetchWorkAssignments,
  fetchWorkAssignmentSlaSummary,
  reassignWorkAssignment,
  type HumanExecutorItem,
  type WorkAssignmentItem,
  type WorkAssignmentSlaSummary,
  type WorkAssignmentStatus
} from "../api/humanAssignments";

const STATUS_META: Array<{ code: WorkAssignmentStatus; label: string }> = [
  { code: "ASSIGNED", label: "待接单" },
  { code: "ACCEPTED", label: "已接单" },
  { code: "ARRIVED", label: "执行中" },
  { code: "SUBMITTED", label: "已提交" },
  { code: "CANCELLED", label: "已取消" },
  { code: "EXPIRED", label: "已超时" },
];

function toTimeLabel(raw: string | number | null | undefined): string {
  const ts = typeof raw === "number" ? raw : Date.parse(String(raw ?? ""));
  if (!Number.isFinite(ts)) return "-";
  return new Date(ts).toLocaleString("zh-CN", { hour12: false });
}

function toSlaLabel(item: WorkAssignmentItem): string {
  const now = Date.now();
  if (item.status === "EXPIRED") return "已超时（未接单）";
  if (item.status === "CANCELLED" && (item.expired_reason === "ARRIVE_TIMEOUT" || item.expired_reason === "ACCEPT_TIMEOUT")) return "已超时";
  if (item.status === "ASSIGNED") {
    const ts = Number(item.accept_deadline_ts ?? NaN);
    if (!Number.isFinite(ts)) return "接单 SLA 未配置";
    const leftMs = ts - now;
    if (leftMs <= 0) return "已超时";
    return `剩余接单时间 ${Math.ceil(leftMs / 60_000)} 分钟`;
  }
  if (item.status === "ACCEPTED" || item.status === "ARRIVED") {
    const ts = Number(item.arrive_deadline_ts ?? NaN);
    if (!Number.isFinite(ts)) return "到场 SLA 未配置";
    const leftMs = ts - now;
    if (leftMs <= 0) return "已超时";
    return `剩余到场时间 ${Math.ceil(leftMs / 60_000)} 分钟`;
  }
  return "-";
}

export default function HumanAssignmentsPage(): React.ReactElement {
  const [loading, setLoading] = React.useState<boolean>(true);
  const [error, setError] = React.useState<string>("");
  const [items, setItems] = React.useState<WorkAssignmentItem[]>([]);
  const [executors, setExecutors] = React.useState<HumanExecutorItem[]>([]);
  const [toast, setToast] = React.useState("");
  const [reassignTarget, setReassignTarget] = React.useState<WorkAssignmentItem | null>(null);
  const [reassignExecutorId, setReassignExecutorId] = React.useState("");
  const [reassignReason, setReassignReason] = React.useState("");
  const [slaSummary, setSlaSummary] = React.useState<WorkAssignmentSlaSummary | null>(null);

  const reload = React.useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const [res, executorRows, summary] = await Promise.all([
        fetchWorkAssignments({ limit: 200 }),
        fetchHumanExecutors({ status: "ACTIVE", limit: 200 }),
        fetchWorkAssignmentSlaSummary(),
      ]);
      setItems(Array.isArray(res.items) ? res.items : []);
      setExecutors(executorRows);
      setSlaSummary(summary);
    } catch (err: any) {
      setError(String(err?.message ?? "加载失败"));
      setItems([]);
      setSlaSummary(null);
    } finally {
      setLoading(false);
    }
  }, []);

  const handleOpenReassign = (item: WorkAssignmentItem) => {
    setReassignTarget(item);
    setReassignExecutorId("");
    setReassignReason("");
  };

  const handleDoReassign = async () => {
    if (!reassignTarget || !reassignExecutorId) return;
    try {
      await reassignWorkAssignment(reassignTarget.assignment_id, {
        executor_id: reassignExecutorId,
        reason: reassignReason.trim() || "MANUAL_REASSIGN",
      });
      setToast(`改派成功：${reassignTarget.assignment_id}`);
      setReassignTarget(null);
      await reload();
    } catch (err: any) {
      setToast(`改派失败：${String(err?.message ?? "未知错误")}`);
    }
  };

  const handleCancel = async (item: WorkAssignmentItem) => {
    if (!globalThis.confirm(`确认撤单 ${item.assignment_id}？`)) return;
    try {
      await batchCancelWorkAssignments({ items: [{ assignment_id: item.assignment_id, note: "UI_CONFIRM_CANCEL" }] });
      setToast(`撤单成功：${item.assignment_id}`);
      await reload();
    } catch (err: any) {
      setToast(`撤单失败：${String(err?.message ?? "未知错误")}`);
    }
  };

  React.useEffect(() => {
    void reload();
  }, [reload]);

  const sourceLabel = (originType?: string): string => (String(originType ?? "manual").toLowerCase() === "auto_fallback" ? "自动转人工" : "人工派发");

  return (
    <div className="productPage">
      <section className="card sectionBlock">
        <div className="sectionHeader">
          <div>
            <div className="eyebrow">GEOX / 人工执行</div>
            <h1 className="pageTitle">人工执行任务</h1>
            <div className="pageLead">按状态查看任务，快速进入详情页完成接单、执行与提交。</div>
          </div>
          <button className="btn" onClick={() => void reload()} disabled={loading}>刷新</button>
        </div>
        {error ? <div className="muted" style={{ marginTop: 10 }}>加载异常：{error}</div> : null}
        {toast ? <div className="muted" style={{ marginTop: 10 }}>{toast}</div> : null}
      </section>
      {slaSummary ? (
        <section className="card section" style={{ marginTop: 16 }}>
          <div className="row" style={{ gap: 8, flexWrap: "wrap" }}>
            <span className="pill">任务总量：{slaSummary.total_count}</span>
            <span className="pill">超时(总)：{slaSummary.accept_timeout_count + slaSummary.arrive_timeout_count}</span>
            <span className="pill">接单超时：{slaSummary.accept_timeout_count}</span>
            <span className="pill">到场超时：{slaSummary.arrive_timeout_count}</span>
            <span className="pill">已超时状态：{slaSummary.expired_count}</span>
            <span className="pill">已取消状态：{slaSummary.cancelled_count}</span>
          </div>
        </section>
      ) : null}

      {STATUS_META.map((group) => {
        const rows = items.filter((x) => x.status === group.code);
        return (
          <section key={group.code} className="card section" style={{ marginTop: 16 }}>
            <div className="row" style={{ justifyContent: "space-between", marginBottom: 12 }}>
              <h3 className="h3" style={{ margin: 0 }}>{group.label}</h3>
              <span className="pill">{rows.length} 条</span>
            </div>
            {rows.length ? (
              <div className="list">
                {rows.map((item) => (
                  <article key={item.assignment_id} className="item">
                    <div>
                      <div className="title">任务 {item.assignment_id}</div>
                      <div className="meta">
                        <span>任务编号：{item.act_task_id}</span>
                        <span>执行人：{item.executor_id}</span>
                        <span>分配时间：{toTimeLabel(item.assigned_at)}</span>
                        <span>来源：{sourceLabel(item.origin_type)}</span>
                        <span>最后更新时间：{toTimeLabel(Number(item.updated_ts_ms ?? 0))}</span>
                        <span>{toSlaLabel(item)}</span>
                      </div>
                    </div>
                    <div className="row" style={{ gap: 8 }}>
                      <Link className="btn" to={`/human-assignments/${encodeURIComponent(item.assignment_id)}`}>进入详情</Link>
                      {["ASSIGNED", "ACCEPTED", "ARRIVED"].includes(item.status) ? (
                        <>
                          <button className="btn" onClick={() => handleOpenReassign(item)}>改派</button>
                          <button className="btn" onClick={() => void handleCancel(item)}>撤单</button>
                        </>
                      ) : null}
                    </div>
                  </article>
                ))}
              </div>
            ) : (
              !loading ? <EmptyState title={`${group.label}暂无任务`} description="可刷新后重试" /> : <div className="muted">加载中...</div>
            )}
          </section>
        );
      })}

      {reassignTarget ? (
        <div className="card section" style={{ marginTop: 16 }}>
          <div className="row" style={{ justifyContent: "space-between", marginBottom: 8 }}>
            <h3 className="h3" style={{ margin: 0 }}>改派执行人</h3>
            <button className="btn" onClick={() => setReassignTarget(null)}>关闭</button>
          </div>
          <div className="meta">
            <span>派单号：{reassignTarget.assignment_id}</span>
            <span>当前执行人：{reassignTarget.executor_id}</span>
          </div>
          <div className="row" style={{ gap: 12, marginTop: 12, flexWrap: "wrap" }}>
            <select className="input" value={reassignExecutorId} onChange={(e) => setReassignExecutorId(e.target.value)}>
              <option value="">请选择新执行人</option>
              {executors.map((x) => (
                <option key={x.executor_id} value={x.executor_id}>{x.display_name}（{x.executor_id}）</option>
              ))}
            </select>
            <input className="input" placeholder="改派原因" value={reassignReason} onChange={(e) => setReassignReason(e.target.value)} />
            <button className="btn" onClick={() => void handleDoReassign()} disabled={!reassignExecutorId}>确认改派</button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
