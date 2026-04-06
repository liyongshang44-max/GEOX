import React from "react";
import EmptyState from "../components/common/EmptyState";
import {
  fetchDispatchWorkbenchTasks,
  fetchHumanExecutors,
  type DispatchWorkbenchTaskItem,
  type HumanExecutorItem,
} from "../api/humanAssignments";

function formatTs(ts: number | null): string {
  if (!Number.isFinite(Number(ts))) return "-";
  return new Date(Number(ts)).toLocaleString("zh-CN", { hour12: false });
}

export default function DispatchWorkbenchPage(): React.ReactElement {
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState("");
  const [fieldId, setFieldId] = React.useState("");
  const [skill, setSkill] = React.useState("");
  const [windowStart, setWindowStart] = React.useState("");
  const [windowEnd, setWindowEnd] = React.useState("");
  const [tasks, setTasks] = React.useState<DispatchWorkbenchTaskItem[]>([]);
  const [executors, setExecutors] = React.useState<HumanExecutorItem[]>([]);

  const reload = React.useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const [taskRows, executorRows] = await Promise.all([
        fetchDispatchWorkbenchTasks({
          limit: 200,
          field_id: fieldId.trim() || undefined,
          required_capability: skill.trim() || undefined,
          window_start_ts: windowStart ? Date.parse(windowStart) : undefined,
          window_end_ts: windowEnd ? Date.parse(windowEnd) : undefined,
        }),
        fetchHumanExecutors({ status: "ACTIVE", limit: 200 }),
      ]);
      setTasks(taskRows);
      setExecutors(executorRows);
    } catch (err: any) {
      setError(String(err?.message ?? "加载失败"));
      setTasks([]);
      setExecutors([]);
    } finally {
      setLoading(false);
    }
  }, [fieldId, skill, windowStart, windowEnd]);

  React.useEffect(() => {
    void reload();
  }, [reload]);

  return (
    <div className="productPage">
      <section className="card sectionBlock">
        <div className="sectionHeader">
          <div>
            <div className="eyebrow">GEOX / 调度台</div>
            <h1 className="pageTitle">派单调度台</h1>
            <div className="pageLead">按地块 / 时间窗 / 技能筛选未分配任务，结合执行人资质快速派单。</div>
          </div>
          <button className="btn" onClick={() => void reload()} disabled={loading}>刷新</button>
        </div>

        <div className="row" style={{ marginTop: 12, gap: 12, flexWrap: "wrap" }}>
          <input className="input" style={{ maxWidth: 220 }} placeholder="按地块过滤（field_id）" value={fieldId} onChange={(e) => setFieldId(e.target.value)} />
          <input className="input" style={{ maxWidth: 220 }} placeholder="按技能过滤（capability）" value={skill} onChange={(e) => setSkill(e.target.value)} />
          <label className="muted" style={{ display: "flex", alignItems: "center", gap: 8 }}>
            开始
            <input className="input" type="datetime-local" value={windowStart} onChange={(e) => setWindowStart(e.target.value)} />
          </label>
          <label className="muted" style={{ display: "flex", alignItems: "center", gap: 8 }}>
            结束
            <input className="input" type="datetime-local" value={windowEnd} onChange={(e) => setWindowEnd(e.target.value)} />
          </label>
          <button className="btn" onClick={() => void reload()} disabled={loading}>应用筛选</button>
        </div>

        {error ? <div className="muted" style={{ marginTop: 10 }}>加载异常：{error}</div> : null}
      </section>

      <section className="card section" style={{ marginTop: 16 }}>
        <div className="row" style={{ justifyContent: "space-between", marginBottom: 12 }}>
          <h3 className="h3" style={{ margin: 0 }}>未分配任务</h3>
          <span className="pill">{tasks.length} 条</span>
        </div>
        {tasks.length ? (
          <div className="list">
            {tasks.map((task) => (
              <article key={task.act_task_id} className="item">
                <div>
                  <div className="title">任务 {task.act_task_id}</div>
                  <div className="meta">
                    <span>地块：{task.field_id || "-"}</span>
                    <span>动作：{task.action_type || "-"}</span>
                    <span>技能：{task.required_capabilities.join(", ") || "-"}</span>
                    <span>时间窗：{formatTs(task.time_window_start_ts)} ~ {formatTs(task.time_window_end_ts)}</span>
                  </div>
                </div>
                <div className="muted">待派单</div>
              </article>
            ))}
          </div>
        ) : (
          !loading ? <EmptyState title="暂无未分配任务" description="可调整筛选条件后重试" /> : <div className="muted">加载中...</div>
        )}
      </section>

      <section className="card section" style={{ marginTop: 16 }}>
        <div className="row" style={{ justifyContent: "space-between", marginBottom: 12 }}>
          <h3 className="h3" style={{ margin: 0 }}>可用执行人（ACTIVE）</h3>
          <span className="pill">{executors.length} 人</span>
        </div>
        {executors.length ? (
          <div className="list">
            {executors.map((executor) => (
              <article key={executor.executor_id} className="item">
                <div>
                  <div className="title">{executor.display_name}（{executor.executor_id}）</div>
                  <div className="meta">
                    <span>班组：{executor.team_id || "-"}</span>
                    <span>技能：{executor.capabilities.join(", ") || "-"}</span>
                  </div>
                </div>
              </article>
            ))}
          </div>
        ) : (
          !loading ? <EmptyState title="暂无可用执行人" description="请先在执行人管理中录入并启用" /> : <div className="muted">加载中...</div>
        )}
      </section>
    </div>
  );
}
