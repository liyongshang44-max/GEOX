import React from "react";
import EmptyState from "../../../components/common/EmptyState";
import {
  batchCreateWorkAssignments,
  fetchDispatchWorkbenchTasks,
  fetchHumanExecutorAvailability,
  type DispatchWorkbenchTaskItem,
  type HumanExecutorAvailabilityItem,
} from "../../../api/humanAssignments";

function formatTs(ts: number | null): string {
  if (!Number.isFinite(Number(ts))) return "-";
  return new Date(Number(ts)).toLocaleString("zh-CN", { hour12: false });
}

function uid(prefix: string): string {
  return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

export default function DispatchWorkbenchPage(): React.ReactElement {
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState("");
  const [fieldId, setFieldId] = React.useState("");
  const [capability, setCapability] = React.useState("");
  const [teamId, setTeamId] = React.useState("");
  const [priority, setPriority] = React.useState("5");
  const [windowStart, setWindowStart] = React.useState("");
  const [windowEnd, setWindowEnd] = React.useState("");
  const [dispatchNote, setDispatchNote] = React.useState("");
  const [tasks, setTasks] = React.useState<DispatchWorkbenchTaskItem[]>([]);
  const [executors, setExecutors] = React.useState<HumanExecutorAvailabilityItem[]>([]);
  const [selectedTaskIds, setSelectedTaskIds] = React.useState<string[]>([]);
  const [selectedExecutorId, setSelectedExecutorId] = React.useState("");
  const [submitting, setSubmitting] = React.useState(false);
  const [resultMsg, setResultMsg] = React.useState("");

  const reload = React.useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const [taskRows, executorRows] = await Promise.all([
        fetchDispatchWorkbenchTasks({
          limit: 200,
          field_id: fieldId.trim() || undefined,
          required_capability: capability.trim() || undefined,
          window_start_ts: windowStart ? Date.parse(windowStart) : undefined,
          window_end_ts: windowEnd ? Date.parse(windowEnd) : undefined,
        }),
        fetchHumanExecutorAvailability({
          team_id: teamId.trim() || undefined,
          capability: capability.trim() || undefined,
          limit: 200,
        }),
      ]);
      setTasks(taskRows);
      setExecutors(executorRows);
      setSelectedTaskIds((prev) => prev.filter((id) => taskRows.some((x) => x.act_task_id === id)));
      setSelectedExecutorId((prev) => (executorRows.some((x) => x.executor_id === prev) ? prev : ""));
    } catch (err: any) {
      setError(String(err?.message ?? "加载失败"));
      setTasks([]);
      setExecutors([]);
    } finally {
      setLoading(false);
    }
  }, [fieldId, capability, teamId, windowStart, windowEnd]);

  React.useEffect(() => {
    void reload();
  }, [reload]);

  const toggleTask = (taskId: string) => {
    setSelectedTaskIds((prev) => (prev.includes(taskId) ? prev.filter((x) => x !== taskId) : [...prev, taskId]));
  };

  const handleBatchDispatch = async () => {
    if (!selectedTaskIds.length || !selectedExecutorId) return;
    setSubmitting(true);
    setResultMsg("");
    try {
      const nowIso = new Date().toISOString();
      const payload = {
        items: selectedTaskIds.map((act_task_id) => ({
          assignment_id: uid("wa"),
          act_task_id,
          executor_id: selectedExecutorId,
          assigned_at: nowIso,
          status: "ASSIGNED" as const,
          dispatch_note: dispatchNote.trim() || undefined,
          priority: Number(priority) || 5,
          required_capabilities: capability.trim() ? [capability.trim()] : undefined,
        })),
      };
      const res = await batchCreateWorkAssignments(payload);
      const createdCount = Array.isArray(res.created) ? res.created.length : 0;
      const errorCount = Array.isArray(res.errors) ? res.errors.length : 0;
      setResultMsg(`派单完成：成功 ${createdCount} 条，失败 ${errorCount} 条`);
      setSelectedTaskIds([]);
      if (createdCount > 0) await reload();
    } catch (err: any) {
      setResultMsg(`派单失败：${String(err?.message ?? "未知错误")}`);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="productPage">
      <section className="card sectionBlock">
        <div className="sectionHeader">
          <div>
            <div className="eyebrow">GEOX / 调度台</div>
            <h1 className="pageTitle">派单调度台</h1>
            <div className="pageLead">左侧待派任务池，右侧可用执行人，支持批量选择并派单。</div>
          </div>
          <button className="btn" onClick={() => void reload()} disabled={loading || submitting}>刷新</button>
        </div>

        <div className="row" style={{ marginTop: 12, gap: 12, flexWrap: "wrap" }}>
          <input className="input" style={{ maxWidth: 200 }} placeholder="field_id" value={fieldId} onChange={(e) => setFieldId(e.target.value)} />
          <input className="input" style={{ maxWidth: 180 }} placeholder="team_id" value={teamId} onChange={(e) => setTeamId(e.target.value)} />
          <input className="input" style={{ maxWidth: 200 }} placeholder="capability" value={capability} onChange={(e) => setCapability(e.target.value)} />
          <label className="muted" style={{ display: "flex", alignItems: "center", gap: 8 }}>
            优先级
            <select className="input" value={priority} onChange={(e) => setPriority(e.target.value)}>
              {Array.from({ length: 9 }, (_, i) => String(i + 1)).map((v) => <option key={v} value={v}>{v}</option>)}
            </select>
          </label>
          <label className="muted" style={{ display: "flex", alignItems: "center", gap: 8 }}>
            开始
            <input className="input" type="datetime-local" value={windowStart} onChange={(e) => setWindowStart(e.target.value)} />
          </label>
          <label className="muted" style={{ display: "flex", alignItems: "center", gap: 8 }}>
            结束
            <input className="input" type="datetime-local" value={windowEnd} onChange={(e) => setWindowEnd(e.target.value)} />
          </label>
          <button className="btn" onClick={() => void reload()} disabled={loading || submitting}>应用筛选</button>
        </div>

        <div className="row" style={{ marginTop: 12, gap: 12 }}>
          <input
            className="input"
            placeholder="派单备注（可选）"
            value={dispatchNote}
            onChange={(e) => setDispatchNote(e.target.value)}
            style={{ flex: 1 }}
          />
          <button
            className="btn"
            onClick={() => void handleBatchDispatch()}
            disabled={submitting || !selectedTaskIds.length || !selectedExecutorId}
          >
            {submitting ? "派单中..." : `批量派单（${selectedTaskIds.length}）`}
          </button>
        </div>

        {error ? <div className="muted" style={{ marginTop: 10 }}>加载异常：{error}</div> : null}
        {resultMsg ? <div className="muted" style={{ marginTop: 10 }}>{resultMsg}</div> : null}
      </section>

      <section className="card section" style={{ marginTop: 16 }}>
        <div className="row" style={{ justifyContent: "space-between", marginBottom: 12 }}>
          <h3 className="h3" style={{ margin: 0 }}>待派任务池</h3>
          <span className="pill">{tasks.length} 条</span>
        </div>
        {tasks.length ? (
          <div className="list">
            {tasks.map((task) => {
              const checked = selectedTaskIds.includes(task.act_task_id);
              return (
                <article key={task.act_task_id} className="item">
                  <div>
                    <label className="title" style={{ display: "flex", alignItems: "center", gap: 8 }}>
                      <input type="checkbox" checked={checked} onChange={() => toggleTask(task.act_task_id)} />
                      任务 {task.act_task_id}
                    </label>
                    <div className="meta">
                      <span>地块：{task.field_id || "-"}</span>
                      <span>动作：{task.action_type || "-"}</span>
                      <span>技能：{task.required_capabilities.join(", ") || "-"}</span>
                      <span>时间窗：{formatTs(task.time_window_start_ts)} ~ {formatTs(task.time_window_end_ts)}</span>
                    </div>
                  </div>
                  <div className="muted">待派单</div>
                </article>
              );
            })}
          </div>
        ) : (
          !loading ? <EmptyState title="暂无未分配任务" description="可调整筛选条件后重试" /> : <div className="muted">加载中...</div>
        )}
      </section>

      <section className="card section" style={{ marginTop: 16 }}>
        <div className="row" style={{ justifyContent: "space-between", marginBottom: 12 }}>
          <h3 className="h3" style={{ margin: 0 }}>可用执行人</h3>
          <span className="pill">{executors.length} 人</span>
        </div>
        {executors.length ? (
          <div className="list">
            {executors.map((executor) => (
              <article
                key={executor.executor_id}
                className="item"
                style={{ border: selectedExecutorId === executor.executor_id ? "1px solid #3b82f6" : undefined }}
              >
                <div>
                  <div className="title">{executor.display_name}（{executor.executor_id}）</div>
                  <div className="meta">
                    <span>班组：{executor.team_id || "-"}</span>
                    <span>技能：{executor.capabilities.join(", ") || "-"}</span>
                    <span>在途任务：{executor.active_assignment_count}</span>
                  </div>
                </div>
                <button className="btn" onClick={() => setSelectedExecutorId(executor.executor_id)}>
                  {selectedExecutorId === executor.executor_id ? "已选择" : "选择执行人"}
                </button>
              </article>
            ))}
          </div>
        ) : (
          !loading ? <EmptyState title="暂无可用执行人" description="请先录入并启用执行人，或调整 team/capability 过滤" /> : <div className="muted">加载中...</div>
        )}
      </section>
    </div>
  );
}
