import React from "react";
import { Link } from "react-router-dom";
import EmptyState from "../components/common/EmptyState";
import { fetchWorkAssignments, type WorkAssignmentItem, type WorkAssignmentStatus } from "../api/humanAssignments";

const STATUS_META: Array<{ code: WorkAssignmentStatus; label: string }> = [
  { code: "ASSIGNED", label: "待接单" },
  { code: "ACCEPTED", label: "已接单" },
  { code: "ARRIVED", label: "执行中" },
  { code: "SUBMITTED", label: "已提交" },
];

function toTimeLabel(iso: string): string {
  const ts = Date.parse(String(iso ?? ""));
  if (!Number.isFinite(ts)) return "-";
  return new Date(ts).toLocaleString("zh-CN", { hour12: false });
}

export default function HumanAssignmentsPage(): React.ReactElement {
  const [loading, setLoading] = React.useState<boolean>(true);
  const [error, setError] = React.useState<string>("");
  const [items, setItems] = React.useState<WorkAssignmentItem[]>([]);

  const reload = React.useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const res = await fetchWorkAssignments({ limit: 200 });
      setItems(Array.isArray(res.items) ? res.items : []);
    } catch (err: any) {
      setError(String(err?.message ?? "加载失败"));
      setItems([]);
    } finally {
      setLoading(false);
    }
  }, []);

  React.useEffect(() => {
    void reload();
  }, [reload]);

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
      </section>

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
                      </div>
                    </div>
                    <Link className="btn" to={`/human-assignments/${encodeURIComponent(item.assignment_id)}`}>进入详情</Link>
                  </article>
                ))}
              </div>
            ) : (
              !loading ? <EmptyState title={`${group.label}暂无任务`} description="可刷新后重试" /> : <div className="muted">加载中...</div>
            )}
          </section>
        );
      })}
    </div>
  );
}
