import React from "react"; // React hooks for the operations cockpit.
import { Link } from "react-router-dom"; // Internal navigation links.
import {
  fetchAuthMe,
  fetchOperationsConsole,
  createApproval,
  decideApproval,
  dispatchAoActTask,
  retryAoActTask,
  type AuthMe,
  type OperationsConsoleResponse,
  type OperationsConsoleApprovalDetail,
  type OperationsConsoleMonitoringItem,
} from "../lib/api"; // Reuse Commercial v1 APIs plus the new operations aggregate.

function getStoredToken(): string {
  try { return localStorage.getItem("geox_ao_act_token") || "dev_ao_act_admin_v0"; } catch { return "dev_ao_act_admin_v0"; } // Keep page usable in dev when local storage is empty.
}

function shortJson(v: unknown): string {
  try { return JSON.stringify(v ?? null, null, 2); } catch { return String(v); } // Safe preview for operator detail panels.
}

function targetLabel(target: any): string {
  if (typeof target === "string") return target; // Legacy string target.
  if (target && typeof target === "object") {
    const kind = String(target.kind ?? "field"); // Default target kind for display.
    const ref = String(target.ref ?? target.field_id ?? target.id ?? ""); // Normalize the reference key.
    return ref ? `${kind}:${ref}` : kind; // Human-readable label.
  }
  return "-"; // Empty fallback.
}

function presetTemplate(actionType: string): { parameters: any; device_id?: string } {
  if (actionType === "IRRIGATE") return { parameters: { duration_min: 15, flow_rate: 12 } }; // Default irrigation template.
  if (actionType === "SPRAY") return { parameters: { dose_ml: 120, speed_kmh: 4 } }; // Default spray template.
  if (actionType === "PLOW") return { parameters: { depth_cm: 18, speed_kmh: 5 }, device_id: "dev_demo" }; // Default plow template.
  return { parameters: { duration_min: 10 } }; // Safe generic fallback.
}

export default function OperationsPage(): React.ReactElement {
  const [token] = React.useState<string>(getStoredToken()); // AO-ACT token from the current browser session.
  const [session, setSession] = React.useState<AuthMe | null>(null); // Current actor session info.
  const [consoleData, setConsoleData] = React.useState<OperationsConsoleResponse | null>(null); // New aggregate payload for the page.
  const [statusText, setStatusText] = React.useState<string>(""); // Small operator feedback line.
  const [loading, setLoading] = React.useState<boolean>(false); // Disable actions during refresh.
  const [selectedApprovalId, setSelectedApprovalId] = React.useState<string>(""); // Detail panel selection for approvals.
  const [selectedTaskId, setSelectedTaskId] = React.useState<string>(""); // Detail panel selection for monitoring items.

  const [issuer, setIssuer] = React.useState("human"); // Wizard: issuer id.
  const [actionType, setActionType] = React.useState("IRRIGATE"); // Wizard: action template family.
  const [targetText, setTargetText] = React.useState('field_demo'); // Wizard: target reference.
  const [requestDeviceId, setRequestDeviceId] = React.useState(""); // Wizard: optional device pinning.
  const [parametersText, setParametersText] = React.useState(JSON.stringify(presetTemplate("IRRIGATE").parameters)); // Wizard: editable parameters JSON.
  const [retryDeviceId, setRetryDeviceId] = React.useState("dev_demo"); // Retry path default device.

  async function refresh(): Promise<void> {
    setLoading(true); // Freeze repeated clicks while requests are in flight.
    try {
      const [me, overview] = await Promise.all([
        fetchAuthMe(token),
        fetchOperationsConsole(token),
      ]); // Fetch actor session and the new cockpit aggregate in parallel.
      setSession(me); // Keep role info for button gating.
      setConsoleData(overview); // Replace the whole page state atomically.
      setSelectedApprovalId((prev) => prev || String(overview.approvals?.[0]?.request_id ?? "")); // Default to the latest approval.
      setSelectedTaskId((prev) => prev || String(overview.monitoring?.[0]?.act_task_id ?? "")); // Default to the latest task.
      setStatusText(`已刷新：待审批 ${overview.summary.approvals_pending} / 可重试 ${overview.summary.retryable_tasks} / 回执 ${overview.summary.receipts}`); // One-line operational summary.
    } catch (e: any) {
      setStatusText(`加载失败：${e?.bodyText || e?.message || String(e)}`); // Preserve raw API error text for debugging.
    } finally {
      setLoading(false); // Re-enable page actions after refresh.
    }
  }

  async function onCreateApproval(): Promise<void> {
    if (session?.role === "operator") {
      setStatusText("当前操作员角色不能发起审批。"); // Product gating stays explicit in UI.
      return;
    }
    setStatusText("正在提交作业审批..."); // Wizard feedback text.
    try {
      const parsedParameters = JSON.parse(parametersText || "{}"); // Wizard parameters stay JSON-first for minimum surface area.
      const body = {
        issuer,
        action_type: actionType,
        target: targetText.trim(),
        time_window: { start_ts: Date.now() - 60_000, end_ts: Date.now() + 3_600_000 },
        parameter_schema: { keys: Object.keys(parsedParameters).map((name) => ({ name, type: typeof parsedParameters[name] === "number" ? "number" : typeof parsedParameters[name] === "boolean" ? "boolean" : "string" })) },
        parameters: parsedParameters,
        constraints: {},
        meta: requestDeviceId.trim() ? { device_id: requestDeviceId.trim() } : {},
      }; // Keep the request payload aligned with approval_request_v1.
      const created = await createApproval(token, body); // Create approval through the stable Commercial v1 wrapper.
      setSelectedApprovalId(String(created.request_id ?? "")); // Jump the detail panel to the newly created request.
      setStatusText(`审批请求已创建：${created.request_id}`); // Operator feedback.
      await refresh(); // Pull the derived detail/hash/risk info back from the aggregate route.
    } catch (e: any) {
      setStatusText(`创建失败：${e?.bodyText || e?.message || String(e)}`); // Surface parse and API errors directly.
    }
  }

  async function onTemplateChange(nextActionType: string): Promise<void> {
    setActionType(nextActionType); // Update the selected template family.
    const nextPreset = presetTemplate(nextActionType); // Read the suggested parameters for this action.
    setParametersText(JSON.stringify(nextPreset.parameters)); // Replace the JSON editor content with the preset.
    if (nextPreset.device_id) setRequestDeviceId(nextPreset.device_id); // Some templates prefer a default device.
  }

  async function onDecide(requestId: string, decision: "APPROVE" | "REJECT"): Promise<void> {
    setStatusText(`正在${decision === "APPROVE" ? "批准" : "驳回"} ${requestId}...`); // Show action in progress.
    try {
      const res = await decideApproval(token, requestId, { decision, reason: "ops_workbench" }); // Use the stable wrapper route.
      if (decision === "APPROVE" && res?.act_task_id) setSelectedTaskId(String(res.act_task_id)); // Jump to the generated task after approval.
      await refresh(); // Pull back latest approval/task state.
    } catch (e: any) {
      setStatusText(`审批失败：${e?.bodyText || e?.message || String(e)}`); // Preserve backend error text.
    }
  }

  async function onDispatch(actTaskId: string): Promise<void> {
    setStatusText(`正在下发 ${actTaskId}...`); // Show progress before explicit dispatch.
    try {
      await dispatchAoActTask(token, actTaskId, { device_id: retryDeviceId.trim() || undefined }); // Existing explicit dispatch path.
      setSelectedTaskId(actTaskId); // Keep the monitoring panel focused on this task.
      await refresh(); // Pull latest queue state.
    } catch (e: any) {
      setStatusText(`下发失败：${e?.bodyText || e?.message || String(e)}`); // Bubble backend error.
    }
  }

  async function onRetry(actTaskId: string): Promise<void> {
    setStatusText(`正在请求重试 ${actTaskId}...`); // Show retry intent.
    try {
      await retryAoActTask(token, actTaskId, { device_id: retryDeviceId.trim() || undefined, retry_reason: "ops_console_manual_retry", adapter_hint: "ops_console" }); // Restricted retry entry.
      setSelectedTaskId(actTaskId); // Keep focus on the retried task.
      await refresh(); // Pull latest queue state and retry counts.
    } catch (e: any) {
      setStatusText(`重试失败：${e?.bodyText || e?.message || String(e)}`); // Explicitly show retry rejection reasons.
    }
  }

  React.useEffect(() => {
    void refresh(); // Load page once after mount.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const summary = consoleData?.summary ?? { approvals_pending: 0, approvals_decided: 0, dispatch_queue: 0, receipts: 0, retryable_tasks: 0 }; // Default empty state before data arrives.
  const approvals = consoleData?.approvals ?? []; // Approval detail list.
  const monitoring = consoleData?.monitoring ?? []; // Task monitoring list.
  const selectedApproval: OperationsConsoleApprovalDetail | null = approvals.find((item) => String(item.request_id) === selectedApprovalId) ?? approvals[0] ?? null; // Resolve current approval detail.
  const selectedTask: OperationsConsoleMonitoringItem | null = monitoring.find((item) => item.act_task_id === selectedTaskId) ?? monitoring[0] ?? null; // Resolve current task detail.

  return (
    <div className="stackList compactList">
      <section className="hero card">
        <div>
          <div className="eyebrow">Operations / 作业运营台</div>
          <h2 className="heroTitle">作业向导、审批详情、执行监控</h2>
          <p className="heroText">本页把蓝图中的审批详情、执行监控和受限失败重试合并成一个最小可演示工作台。</p>
        </div>
        <div className="heroActions">
          <button className="btn btnPrimary" onClick={() => void refresh()} disabled={loading}>刷新数据</button>
          <Link className="btn" to="/audit-export">查看审计与导出</Link>
        </div>
      </section>

      <section className="summaryGrid">
        <div className="summaryCard card"><div className="summaryLabel">待审批</div><div className="summaryValue">{summary.approvals_pending}</div></div>
        <div className="summaryCard card"><div className="summaryLabel">已决策</div><div className="summaryValue">{summary.approvals_decided}</div></div>
        <div className="summaryCard card"><div className="summaryLabel">队列中</div><div className="summaryValue">{summary.dispatch_queue}</div></div>
        <div className="summaryCard card"><div className="summaryLabel">可重试任务</div><div className="summaryValue">{summary.retryable_tasks}</div></div>
      </section>

      <section className="card">
        <div className="subSectionTitle">作业向导</div>
        <div className="formGridTwo">
          <label className="field"><span>发起人</span><input value={issuer} onChange={(e) => setIssuer(e.target.value)} /></label>
          <label className="field"><span>模板</span><select value={actionType} onChange={(e) => void onTemplateChange(e.target.value)}><option value="IRRIGATE">灌溉</option><option value="SPRAY">喷洒</option><option value="PLOW">翻地</option><option value="HARROW">耙地</option><option value="HARVEST">采收</option></select></label>
          <label className="field"><span>目标</span><input value={targetText} onChange={(e) => setTargetText(e.target.value)} placeholder="field_demo" /></label>
          <label className="field"><span>设备</span><input value={requestDeviceId} onChange={(e) => setRequestDeviceId(e.target.value)} placeholder="dev_demo" /></label>
          <label className="field" style={{ gridColumn: "1 / -1" }}><span>参数 JSON</span><textarea rows={6} value={parametersText} onChange={(e) => setParametersText(e.target.value)} /></label>
        </div>
        <div className="heroActions">
          <button className="btn btnPrimary" onClick={() => void onCreateApproval()} disabled={loading || session?.role === "operator"}>提交审批</button>
          <div className="metaText">当前角色：{session?.role === "admin" ? "管理员" : session?.role === "operator" ? "操作员" : "未识别"}</div>
        </div>
      </section>

      <section className="detailGrid" style={{ display: "grid", gridTemplateColumns: "1.1fr 1fr", gap: 16 }}>
        <div className="card">
          <div className="subSectionTitle">审批详情</div>
          <div className="tableWrap">
            <table className="tableCompact">
              <thead><tr><th>请求</th><th>类型</th><th>状态</th><th>设备</th><th>操作</th></tr></thead>
              <tbody>
                {approvals.length < 1 ? <tr><td colSpan={5}>暂无审批。</td></tr> : approvals.map((item) => (
                  <tr key={String(item.request_id)}>
                    <td><button className="btn btnLink" onClick={() => setSelectedApprovalId(String(item.request_id ?? ""))}>{item.request_id}</button></td>
                    <td>{item.action_type || "-"}</td>
                    <td>{item.status}</td>
                    <td>{item.device_id || "-"}</td>
                    <td className="actionsRow">
                      {item.status === "PENDING" ? (
                        <>
                          <button className="btn btnPrimary" onClick={() => void onDecide(String(item.request_id), "APPROVE")} disabled={session?.role !== "admin"}>批准</button>
                          <button className="btn" onClick={() => void onDecide(String(item.request_id), "REJECT")} disabled={session?.role !== "admin"}>驳回</button>
                        </>
                      ) : <span className="pill">已决策</span>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {selectedApproval ? (
            <div className="stackList compactList" style={{ marginTop: 12 }}>
              <div className="subSectionTitle">单条审批详情</div>
              <div className="metaText">风险提示：{selectedApproval.risk_hint}</div>
              <div className="metaText">影响范围：{targetLabel(selectedApproval.impact_scope)}</div>
              <div className="metaText">参数快照哈希：{selectedApproval.proposal_hash}</div>
              <pre className="codeBlock">{shortJson(selectedApproval.parameter_snapshot)}</pre>
            </div>
          ) : null}
        </div>

        <div className="card">
          <div className="subSectionTitle">执行监控</div>
          <label className="field" style={{ marginBottom: 12 }}><span>默认重试设备</span><input value={retryDeviceId} onChange={(e) => setRetryDeviceId(e.target.value)} placeholder="dev_demo" /></label>
          <div className="tableWrap">
            <table className="tableCompact">
              <thead><tr><th>任务</th><th>状态</th><th>回执</th><th>操作</th></tr></thead>
              <tbody>
                {monitoring.length < 1 ? <tr><td colSpan={4}>暂无任务。</td></tr> : monitoring.map((item) => (
                  <tr key={item.act_task_id}>
                    <td><button className="btn btnLink" onClick={() => setSelectedTaskId(item.act_task_id)}>{item.act_task_id}</button></td>
                    <td>{item.state}</td>
                    <td>{item.latest_receipt_status || "-"}</td>
                    <td className="actionsRow">
                      <button className="btn" onClick={() => void onDispatch(item.act_task_id)} disabled={item.state !== "CREATED"}>下发</button>
                      <button className="btn btnPrimary" onClick={() => void onRetry(item.act_task_id)} disabled={!item.retry_allowed || session?.role !== "admin"}>失败重试</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {selectedTask ? (
            <div className="stackList compactList" style={{ marginTop: 12 }}>
              <div className="subSectionTitle">任务监控详情</div>
              <div className="metaText">动作：{selectedTask.action_type || "-"}</div>
              <div className="metaText">目标：{targetLabel(selectedTask.target)}</div>
              <div className="metaText">设备：{selectedTask.device_id || "-"}</div>
              <div className="metaText">参数哈希：{selectedTask.parameters_hash}</div>
              <div className="metaText">最新回执：{selectedTask.latest_receipt_status || "无"}</div>
              <pre className="codeBlock">{shortJson(selectedTask.parameters)}</pre>
            </div>
          ) : null}
        </div>
      </section>

      <section className="card">
        <div className="subSectionTitle">页面状态</div>
        <div className="metaText">{statusText || "准备就绪"}</div>
      </section>
    </div>
  );
}
