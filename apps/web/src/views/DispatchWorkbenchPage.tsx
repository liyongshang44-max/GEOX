import React from "react";
import EmptyState from "../components/common/EmptyState";
import {
  batchCancelWorkAssignments,
  batchCreateWorkAssignments,
  batchReassignWorkAssignments,
  fetchDispatchExecutorMatches,
  fetchDispatchWorkbenchTasks,
  fetchHumanExecutorAvailability,
  fetchWorkAssignments,
  type DispatchExecutorMatchItem,
  type DispatchWorkbenchTaskItem,
  type HumanExecutorAvailabilityItem,
  type WorkAssignmentItem,
} from "../api/humanAssignments";

function formatTs(ts: number | null): string {
  if (!Number.isFinite(Number(ts))) return "-";
  return new Date(Number(ts)).toLocaleString("zh-CN", { hour12: false });
}

function uid(prefix: string): string {
  return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

function toCapabilityList(raw: string): string[] {
  return Array.from(new Set(String(raw ?? "").split(",").map((x) => x.trim()).filter(Boolean)));
}

function extractRequiredCapabilities(tasks: DispatchWorkbenchTaskItem[], selectedTaskIds: string[], fallbackCapability: string): string[] {
  const byId = new Map(tasks.map((t) => [t.act_task_id, t.required_capabilities]));
  const caps = selectedTaskIds.flatMap((taskId) => byId.get(taskId) ?? []);
  return Array.from(new Set([...caps, ...toCapabilityList(fallbackCapability)]));
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
  const [matches, setMatches] = React.useState<DispatchExecutorMatchItem[]>([]);
  const [assignments, setAssignments] = React.useState<WorkAssignmentItem[]>([]);
  const [selectedTaskIds, setSelectedTaskIds] = React.useState<string[]>([]);
  const [selectedExecutorId, setSelectedExecutorId] = React.useState("");
  const [selectedAssignmentIds, setSelectedAssignmentIds] = React.useState<string[]>([]);
  const [reassignExecutorId, setReassignExecutorId] = React.useState("");
  const [submitting, setSubmitting] = React.useState(false);
  const [resultMsg, setResultMsg] = React.useState("");

  const reload = React.useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const [taskRows, executorRows, assignmentRes] = await Promise.all([
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
        fetchWorkAssignments({
          limit: 200,
        }),
      ]);
      setTasks(taskRows);
      setExecutors(executorRows);
      const activeAssignments = (assignmentRes.items ?? []).filter((x) => ["ASSIGNED", "ACCEPTED", "ARRIVED"].includes(x.status));
      setAssignments(activeAssignments);
      setSelectedTaskIds((prev) => prev.filter((id) => taskRows.some((x) => x.act_task_id === id)));
      setSelectedAssignmentIds((prev) => prev.filter((id) => activeAssignments.some((x) => x.assignment_id === id)));
      setSelectedExecutorId((prev) => (executorRows.some((x) => x.executor_id === prev) ? prev : ""));
      setReassignExecutorId((prev) => (executorRows.some((x) => x.executor_id === prev) ? prev : ""));
    } catch (err: any) {
      setError(String(err?.message ?? "加载失败"));
      setTasks([]);
      setExecutors([]);
      setAssignments([]);
      setMatches([]);
    } finally {
      setLoading(false);
    }
  }, [fieldId, capability, teamId, windowStart, windowEnd]);

  React.useEffect(() => {
    void reload();
  }, [reload]);

  React.useEffect(() => {
    const requiredCaps = extractRequiredCapabilities(tasks, selectedTaskIds, capability);
    if (!requiredCaps.length && !teamId.trim()) {
      setMatches([]);
      return;
    }
    let cancelled = false;
    void fetchDispatchExecutorMatches({
      team_id: teamId.trim() || undefined,
      required_capabilities: requiredCaps,
      limit: 30,
    }).then((rows) => {
      if (!cancelled) setMatches(rows);
    }).catch(() => {
      if (!cancelled) setMatches([]);
    });
    return () => {
      cancelled = true;
    };
  }, [tasks, selectedTaskIds, capability, teamId]);

  const toggleTask = (taskId: string) => {
    setSelectedTaskIds((prev) => (prev.includes(taskId) ? prev.filter((x) => x !== taskId) : [...prev, taskId]));
  };

  const toggleAssignment = (assignmentId: string) => {
    setSelectedAssignmentIds((prev) => (prev.includes(assignmentId) ? prev.filter((x) => x !== assignmentId) : [...prev, assignmentId]));
  };

  const handleBatchDispatch = async () => {
    if (!selectedTaskIds.length || !selectedExecutorId) return;
    setSubmitting(true);
    setResultMsg("");
    try {
      const nowIso = new Date().toISOString();
      const requiredCaps = extractRequiredCapabilities(tasks, selectedTaskIds, capability);
      const payload = {
        items: selectedTaskIds.map((act_task_id) => ({
          assignment_id: uid("wa"),
          act_task_id,
          executor_id: selectedExecutorId,
          assigned_at: nowIso,
          status: "ASSIGNED" as const,
          dispatch_note: dispatchNote.trim() || undefined,
          priority: Number(priority) || 5,
          required_capabilities: requiredCaps.length ? requiredCaps : undefined,
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

  const handleBatchReassign = async () => {
    if (!selectedAssignmentIds.length || !reassignExecutorId) return;
    setSubmitting(true);
    setResultMsg("");
    try {
      const requiredCaps = toCapabilityList(capability);
      const res = await batchReassignWorkAssignments({
        items: selectedAssignmentIds.map((assignment_id) => ({
          assignment_id,
          executor_id: reassignExecutorId,
          note: dispatchNote.trim() || "DISPATCH_WORKBENCH_BATCH_REASSIGN",
          required_capabilities: requiredCaps.length ? requiredCaps : undefined,
        })),
      });
      const success = Array.isArray(res.updated) ? res.updated.length : 0;
      const failed = Array.isArray(res.errors) ? res.errors.length : 0;
      setResultMsg(`改派完成：成功 ${success} 条，失败 ${failed} 条`);
      setSelectedAssignmentIds([]);
      if (success > 0) await reload();
    } catch (err: any) {
      setResultMsg(`改派失败：${String(err?.message ?? "未知错误")}`);
    } finally {
      setSubmitting(false);
    }
  };

  const handleBatchCancel = async () => {
    if (!selectedAssignmentIds.length) return;
    setSubmitting(true);
    setResultMsg("");
    try {
      const res = await batchCancelWorkAssignments({
        items: selectedAssignmentIds.map((assignment_id) => ({
          assignment_id,
          note: dispatchNote.trim() || "DISPATCH_WORKBENCH_BATCH_CANCEL",
        })),
      });
      const success = Array.isArray(res.updated) ? res.updated.length : 0;
      const failed = Array.isArray(res.errors) ? res.errors.length : 0;
      setResultMsg(`撤单完成：成功 ${success} 条，失败 ${failed} 条`);
      setSelectedAssignmentIds([]);
      if (success > 0) await reload();
    } catch (err: any) {
      setResultMsg(`撤单失败：${String(err?.message ?? "未知错误")}`);
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
            <div className="pageLead">支持批量派单、改派、撤单；并基于 team 与执行人能力匹配推荐执行人。</div>
          </div>
          <button className="btn" onClick={() => void reload()} disabled={loading || submitting}>刷新</button>
        </div>

        <div className="row" style={{ marginTop: 12, gap: 12, flexWrap: "wrap" }}>
          <input className="input" style={{ maxWidth: 200 }} placeholder="field_id" value={fieldId} onChange={(e) => setFieldId(e.target.value)} />
          <input className="input" style={{ maxWidth: 180 }} placeholder="team_id" value={teamId} onChange={(e) => setTeamId(e.target.value)} />
          <input className="input" style={{ maxWidth: 260 }} placeholder="capability（逗号分隔）" value={capability} onChange={(e) => setCapability(e.target.value)} />
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

        <div className="row" style={{ marginTop: 12, gap: 12, flexWrap: "wrap" }}>
          <input
            className="input"
            placeholder="调度备注（派单/改派/撤单共用）"
            value={dispatchNote}
            onChange={(e) => setDispatchNote(e.target.value)}
            style={{ flex: 1, minWidth: 280 }}
          />
          <button className="btn" onClick={() => void handleBatchDispatch()} disabled={submitting || !selectedTaskIds.length || !selectedExecutorId}>
            {submitting ? "处理中..." : `批量派单（${selectedTaskIds.length}）`}
          </button>
          <button className="btn" onClick={() => void handleBatchReassign()} disabled={submitting || !selectedAssignmentIds.length || !reassignExecutorId}>
            {submitting ? "处理中..." : `批量改派（${selectedAssignmentIds.length}）`}
          </button>
          <button className="btn" onClick={() => void handleBatchCancel()} disabled={submitting || !selectedAssignmentIds.length}>
            {submitting ? "处理中..." : `批量撤单（${selectedAssignmentIds.length}）`}
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
          <h3 className="h3" style={{ margin: 0 }}>执行人匹配推荐（能力 + 班组）</h3>
          <span className="pill">{matches.length} 人</span>
        </div>
        {matches.length ? (
          <div className="list">
            {matches.map((executor) => (
              <article key={executor.executor_id} className="item">
                <div>
                  <div className="title">{executor.display_name}（{executor.executor_id}）</div>
                  <div className="meta">
                    <span>班组：{executor.team_id || "-"}</span>
                    <span>能力匹配：{Math.round(executor.capability_match_ratio * 100)}%</span>
                    <span>推荐分：{executor.recommendation_score.toFixed(2)}</span>
                    <span>缺失能力：{executor.missing_capabilities.join(", ") || "无"}</span>
                  </div>
                </div>
              </article>
            ))}
          </div>
        ) : (
          <div className="muted">选择任务或输入能力/team 后将显示推荐列表。</div>
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
                style={{ border: selectedExecutorId === executor.executor_id || reassignExecutorId === executor.executor_id ? "1px solid #3b82f6" : undefined }}
              >
                <div>
                  <div className="title">{executor.display_name}（{executor.executor_id}）</div>
                  <div className="meta">
                    <span>班组：{executor.team_id || "-"}</span>
                    <span>技能：{executor.capabilities.join(", ") || "-"}</span>
                    <span>在途任务：{executor.active_assignment_count}</span>
                  </div>
                </div>
                <div className="row" style={{ gap: 8 }}>
                  <button className="btn" onClick={() => setSelectedExecutorId(executor.executor_id)}>
                    {selectedExecutorId === executor.executor_id ? "派单已选" : "用于派单"}
                  </button>
                  <button className="btn" onClick={() => setReassignExecutorId(executor.executor_id)}>
                    {reassignExecutorId === executor.executor_id ? "改派已选" : "用于改派"}
                  </button>
                </div>
              </article>
            ))}
          </div>
        ) : (
          !loading ? <EmptyState title="暂无可用执行人" description="请先录入并启用执行人，或调整 team/capability 过滤" /> : <div className="muted">加载中...</div>
        )}
      </section>

      <section className="card section" style={{ marginTop: 16 }}>
        <div className="row" style={{ justifyContent: "space-between", marginBottom: 12 }}>
          <h3 className="h3" style={{ margin: 0 }}>进行中派单（可改派/撤单）</h3>
          <span className="pill">{assignments.length} 条</span>
        </div>
        {assignments.length ? (
          <div className="list">
            {assignments.map((item) => {
              const checked = selectedAssignmentIds.includes(item.assignment_id);
              return (
                <article key={item.assignment_id} className="item">
                  <div>
                    <label className="title" style={{ display: "flex", alignItems: "center", gap: 8 }}>
                      <input type="checkbox" checked={checked} onChange={() => toggleAssignment(item.assignment_id)} />
                      派单 {item.assignment_id}
                    </label>
                    <div className="meta">
                      <span>任务：{item.act_task_id}</span>
                      <span>执行人：{item.executor_id}</span>
                      <span>状态：{item.status}</span>
                      <span>派发时间：{item.assigned_at}</span>
                    </div>
                  </div>
                </article>
              );
            })}
          </div>
        ) : (
          <div className="muted">暂无可改派或撤单的任务。</div>
        )}
      </section>
    </div>
  );
}
