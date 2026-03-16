import React from "react";
import { Link } from "react-router-dom";
import {
  createApproval,
  createOperationPlan,
  decideApproval,
  dispatchAoActTask,
  fetchAuthMe,
  fetchFields,
  fetchOperationPlanDetail,
  fetchOperationPlans,
  fetchOperationsConsole,
  persistApiBase,
  readStoredApiBase,
  retryAoActTask,
  submitOperationPlanApproval,
  updateOperationPlanStatus,
  type AuthMe,
  type FieldListItem,
  type OperationPlanItem,
  type OperationsConsoleApprovalDetail,
  type OperationsConsoleMonitoringItem,
  type OperationsConsoleResponse,
} from "../lib/api";

function getStoredToken(): string {
  try { return localStorage.getItem("geox_ao_act_token") || "dev_ao_act_admin_v0"; } catch { return "dev_ao_act_admin_v0"; }
}

function shortJson(v: unknown): string {
  try { return JSON.stringify(v ?? null, null, 2); } catch { return String(v); }
}

function targetLabel(target: any): string {
  if (typeof target === "string") return target;
  if (target && typeof target === "object") {
    const kind = String(target.kind ?? "field");
    const ref = String(target.ref ?? target.field_id ?? target.id ?? "");
    return ref ? `${kind}:${ref}` : kind;
  }
  return "-";
}

function fmtTs(ms: number | null | undefined): string {
  if (!ms || !Number.isFinite(ms)) return "-";
  return new Date(ms).toLocaleString();
}

function presetTemplate(actionType: string): { parameters: any; device_id?: string; title: string } {
  if (actionType === "IRRIGATE") return { parameters: { duration_min: 15, flow_rate: 12 }, title: "灌溉计划" };
  if (actionType === "SPRAY") return { parameters: { dose_ml: 120, speed_kmh: 4 }, title: "喷洒计划" };
  if (actionType === "PLOW") return { parameters: { depth_cm: 18, speed_kmh: 5 }, device_id: "dev_demo", title: "翻地计划" };
  return { parameters: { duration_min: 10 }, title: "作业计划" };
}

function normalizeFieldId(field: any): string {
  return String(field?.field_id ?? field?.id ?? "").trim();
}

function normalizeFieldName(field: any): string {
  return String(field?.name ?? field?.display_name ?? field?.field_id ?? "").trim();
}

function planWorkflowSteps(plan: OperationPlanItem | null): Array<{ label: string; done: boolean; active: boolean }> {
  if (!plan) return [];
  const status = String(plan.status ?? "DRAFT");
  return [
    { label: "计划", done: true, active: status === "DRAFT" },
    { label: "READY", done: ["READY","APPROVAL_PENDING","TASK_CREATED","ARCHIVED"].includes(status), active: status === "READY" },
    { label: "审批", done: ["APPROVAL_PENDING","TASK_CREATED","REJECTED","ARCHIVED"].includes(status), active: status === "APPROVAL_PENDING" || status === "REJECTED" },
    { label: "任务", done: ["TASK_CREATED","ARCHIVED"].includes(status) || Boolean(plan.act_task_id), active: status === "TASK_CREATED" },
    { label: "回执", done: Boolean(plan.latest_receipt_status), active: Boolean(plan.latest_receipt_status) },
  ];
}

export default function OperationsPage(): React.ReactElement {
  const [token] = React.useState<string>(getStoredToken());
  const [apiBaseInput, setApiBaseInput] = React.useState<string>(readStoredApiBase());
  const [session, setSession] = React.useState<AuthMe | null>(null);
  const [consoleData, setConsoleData] = React.useState<OperationsConsoleResponse | null>(null);
  const [plans, setPlans] = React.useState<OperationPlanItem[]>([]);
  const [fields, setFields] = React.useState<FieldListItem[]>([]);
  const [selectedPlanId, setSelectedPlanId] = React.useState<string>("");
  const [selectedApprovalId, setSelectedApprovalId] = React.useState<string>("");
  const [selectedTaskId, setSelectedTaskId] = React.useState<string>("");
  const [statusText, setStatusText] = React.useState<string>("");
  const [loading, setLoading] = React.useState<boolean>(false);

  const [planFieldId, setPlanFieldId] = React.useState<string>("field_c8_demo");
  const [planTemplate, setPlanTemplate] = React.useState<string>("IRRIGATE");
  const [planTitle, setPlanTitle] = React.useState<string>("演示灌溉计划");
  const [planStart, setPlanStart] = React.useState<string>(new Date(Date.now() + 30 * 60_000).toISOString().slice(0, 16));
  const [planEnd, setPlanEnd] = React.useState<string>(new Date(Date.now() + 120 * 60_000).toISOString().slice(0, 16));
  const [planParametersText, setPlanParametersText] = React.useState<string>(JSON.stringify(presetTemplate("IRRIGATE").parameters));

  const [issuer, setIssuer] = React.useState("human");
  const [actionType, setActionType] = React.useState("IRRIGATE");
  const [targetText, setTargetText] = React.useState("field_c8_demo");
  const [requestDeviceId, setRequestDeviceId] = React.useState("");
  const [parametersText, setParametersText] = React.useState(JSON.stringify(presetTemplate("IRRIGATE").parameters));
  const [retryDeviceId, setRetryDeviceId] = React.useState("dev_demo");

  async function refresh(): Promise<void> {
    setLoading(true);
    try {
      const [me, overview, planItems, fieldItems] = await Promise.all([
        fetchAuthMe(token),
        fetchOperationsConsole(token),
        fetchOperationPlans(token, { limit: 20 }),
        fetchFields(token),
      ]);
      setSession(me);
      setConsoleData(overview);
      setPlans(planItems);
      setFields(fieldItems);
      setSelectedPlanId((prev) => prev || String(planItems?.[0]?.plan_id ?? ""));
      setSelectedApprovalId((prev) => prev || String(overview.approvals?.[0]?.request_id ?? ""));
      setSelectedTaskId((prev) => prev || String(overview.monitoring?.[0]?.act_task_id ?? ""));
      if (!planFieldId && fieldItems.length > 0) setPlanFieldId(normalizeFieldId(fieldItems[0]));
      setStatusText(`已刷新：计划 ${planItems.length} / 待审批 ${overview.summary.approvals_pending} / 可重试 ${overview.summary.retryable_tasks}`);
    } catch (e: any) {
      setStatusText(`加载失败：${e?.bodyText || e?.message || String(e)}`);
    } finally {
      setLoading(false);
    }
  }

  async function onPersistApiBase(): Promise<void> {
    const next = persistApiBase(apiBaseInput);
    setApiBaseInput(next);
    setStatusText(`已切换 API 基址：${next}`);
    await refresh();
  }

  async function onPlanTemplateChange(nextActionType: string): Promise<void> {
    setPlanTemplate(nextActionType);
    const preset = presetTemplate(nextActionType);
    setPlanParametersText(JSON.stringify(preset.parameters));
    setPlanTitle(`演示${preset.title}`);
  }

  async function onCreatePlan(): Promise<void> {
    setStatusText("正在创建作业计划...");
    try {
      const parameters = JSON.parse(planParametersText || "{}");
      const body = {
        field_id: planFieldId.trim(),
        template_code: planTemplate,
        title: planTitle.trim(),
        scheduled_start_ts_ms: Date.parse(planStart),
        scheduled_end_ts_ms: Date.parse(planEnd),
        parameters,
        meta: {},
      };
      const created = await createOperationPlan(token, body);
      setSelectedPlanId(String(created.plan_id ?? ""));
      setStatusText(`计划已创建：${created.plan_id}`);
      await refresh();
    } catch (e: any) {
      setStatusText(`计划创建失败：${e?.bodyText || e?.message || String(e)}`);
    }
  }

  async function onPlanStatus(planId: string, nextStatus: string): Promise<void> {
    setStatusText(`正在更新计划状态为 ${nextStatus}...`);
    try {
      await updateOperationPlanStatus(token, planId, nextStatus as any);
      setStatusText(`计划 ${planId} 已更新为 ${nextStatus}`);
      await refresh();
    } catch (e: any) {
      setStatusText(`状态更新失败：${e?.bodyText || e?.message || String(e)}`);
    }
  }

  async function onPlanSubmitApproval(planId: string): Promise<void> {
    setStatusText(`正在为计划 ${planId} 提交审批...`);
    try {
      const linked = await submitOperationPlanApproval(token, planId);
      setSelectedPlanId(planId);
      setSelectedApprovalId(String(linked.approval_request_id ?? ""));
      setStatusText(`计划已关联审批：${linked.approval_request_id}`);
      await refresh();
    } catch (e: any) {
      setStatusText(`计划提交审批失败：${e?.bodyText || e?.message || String(e)}`);
    }
  }

  async function onUsePlanForApproval(planId: string): Promise<void> {
    try {
      const detail = await fetchOperationPlanDetail(token, planId);
      setSelectedPlanId(planId);
      setActionType(String(detail.template_code ?? "IRRIGATE"));
      setTargetText(String(detail.field_id ?? ""));
      setParametersText(JSON.stringify(detail.plan_payload?.parameters ?? {}));
      setStatusText(`已将计划 ${planId} 带入审批向导。`);
    } catch (e: any) {
      setStatusText(`读取计划详情失败：${e?.bodyText || e?.message || String(e)}`);
    }
  }

  async function onCreateApproval(): Promise<void> {
    if (session?.role === "operator") {
      setStatusText("当前操作员角色不能发起审批。");
      return;
    }
    setStatusText("正在提交作业审批...");
    try {
      const parsedParameters = JSON.parse(parametersText || "{}");
      const body = {
        issuer,
        action_type: actionType,
        target: targetText.trim(),
        time_window: { start_ts: Date.now() - 60_000, end_ts: Date.now() + 3_600_000 },
        parameter_schema: { keys: Object.keys(parsedParameters).map((name) => ({ name, type: typeof parsedParameters[name] === "number" ? "number" : typeof parsedParameters[name] === "boolean" ? "boolean" : "string" })) },
        parameters: parsedParameters,
        constraints: {},
        meta: {
          ...(requestDeviceId.trim() ? { device_id: requestDeviceId.trim() } : {}),
          ...(selectedPlanId ? { plan_id: selectedPlanId } : {}),
        },
      };
      const created = await createApproval(token, body);
      setSelectedApprovalId(String(created.request_id ?? ""));
      setStatusText(`审批请求已创建：${created.request_id}`);
      await refresh();
    } catch (e: any) {
      setStatusText(`创建失败：${e?.bodyText || e?.message || String(e)}`);
    }
  }

  async function onTemplateChange(nextActionType: string): Promise<void> {
    setActionType(nextActionType);
    const nextPreset = presetTemplate(nextActionType);
    setParametersText(JSON.stringify(nextPreset.parameters));
    if (nextPreset.device_id) setRequestDeviceId(nextPreset.device_id);
  }

  async function onDecide(requestId: string, decision: "APPROVE" | "REJECT"): Promise<void> {
    setStatusText(`正在${decision === "APPROVE" ? "批准" : "驳回"} ${requestId}...`);
    try {
      const res = await decideApproval(token, requestId, { decision, reason: "ops_workbench" });
      if (decision === "APPROVE" && res?.act_task_id) setSelectedTaskId(String(res.act_task_id));
      if (selectedPlan?.approval_request_id === requestId) setSelectedPlanId(String(selectedPlan.plan_id ?? ""));
      setStatusText(`${requestId} 已${decision === "APPROVE" ? "批准" : "驳回"}。`);
      await refresh();
    } catch (e: any) {
      setStatusText(`审批失败：${e?.bodyText || e?.message || String(e)}`);
    }
  }

  async function onDispatch(actTaskId: string): Promise<void> {
    setStatusText(`正在下发 ${actTaskId}...`);
    try {
      await dispatchAoActTask(token, actTaskId, { device_id: retryDeviceId.trim() || undefined });
      setSelectedTaskId(actTaskId);
      await refresh();
    } catch (e: any) {
      setStatusText(`下发失败：${e?.bodyText || e?.message || String(e)}`);
    }
  }

  async function onRetry(actTaskId: string): Promise<void> {
    setStatusText(`正在请求重试 ${actTaskId}...`);
    try {
      await retryAoActTask(token, actTaskId, { device_id: retryDeviceId.trim() || undefined, retry_reason: "ops_console_manual_retry", adapter_hint: "ops_console" });
      setSelectedTaskId(actTaskId);
      await refresh();
    } catch (e: any) {
      setStatusText(`重试失败：${e?.bodyText || e?.message || String(e)}`);
    }
  }

  React.useEffect(() => {
    void refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const summary = consoleData?.summary ?? { approvals_pending: 0, approvals_decided: 0, dispatch_queue: 0, receipts: 0, retryable_tasks: 0 };
  const approvals = consoleData?.approvals ?? [];
  const monitoring = consoleData?.monitoring ?? [];
  const selectedPlan = plans.find((item) => item.plan_id === selectedPlanId) ?? plans[0] ?? null;
  const selectedApproval: OperationsConsoleApprovalDetail | null = approvals.find((item) => String(item.request_id) === selectedApprovalId) ?? approvals[0] ?? null;
  const selectedTask: OperationsConsoleMonitoringItem | null = monitoring.find((item) => item.act_task_id === selectedTaskId) ?? monitoring[0] ?? null;
  const planSteps = planWorkflowSteps(selectedPlan);

  return (
    <div className="stackList compactList">
      <section className="hero card compactHero">
        <div>
          <div className="eyebrow">Operations / 作业运营台</div>
          <h2 className="heroTitle">计划、审批、执行的一体化工作台</h2>
          <p className="heroText">本轮把 OperationPlan 对象正式建出来，并在同一页串起状态流转、审批关联和执行监控，避免继续用临时表单拼装审批请求。</p>
        </div>
        <div className="heroActions">
          <button className="btn btnPrimary" onClick={() => void refresh()} disabled={loading}>刷新数据</button>
          <Link className="btn" to="/audit-export">查看审计与导出</Link>
        </div>
      </section>

      <section className="card">
        <div className="sectionHeader">
          <div>
            <div className="sectionTitle">接口连接</div>
            <div className="sectionDesc">默认仍指向 3001。若你正在用本地 tsx watch 跑新代码，请把 API 基址切到 3000。</div>
          </div>
        </div>
        <div className="formGrid twoCols">
          <label className="field"><span>API 基址</span><input value={apiBaseInput} onChange={(e) => setApiBaseInput(e.target.value)} placeholder="http://127.0.0.1:3000" /></label>
          <div className="field fieldAction"><span>&nbsp;</span><button className="btn btnPrimary" onClick={() => void onPersistApiBase()}>保存并重连</button></div>
        </div>
      </section>

      <section className="summaryGrid">
        <div className="summaryCard card"><div className="summaryLabel">计划对象</div><div className="summaryValue">{plans.length}</div></div>
        <div className="summaryCard card"><div className="summaryLabel">待审批</div><div className="summaryValue">{summary.approvals_pending}</div></div>
        <div className="summaryCard card"><div className="summaryLabel">队列中</div><div className="summaryValue">{summary.dispatch_queue}</div></div>
        <div className="summaryCard card"><div className="summaryLabel">可重试任务</div><div className="summaryValue">{summary.retryable_tasks}</div></div>
      </section>

      <section className="contentGridTwo alignStart">
        <div className="card sectionBlock">
          <div className="sectionHeader">
            <div>
              <div className="sectionTitle">作业计划</div>
              <div className="sectionDesc">先落计划对象，再做人工审批。批准后会自动桥接为 AO-ACT 任务，详情区会显示任务与队列状态。</div>
            </div>
          </div>
          <div className="formGrid twoCols">
            <label className="field"><span>田块</span><select value={planFieldId} onChange={(e) => setPlanFieldId(e.target.value)}>{fields.map((field) => <option key={normalizeFieldId(field)} value={normalizeFieldId(field)}>{normalizeFieldName(field) || normalizeFieldId(field)}</option>)}</select></label>
            <label className="field"><span>模板</span><select value={planTemplate} onChange={(e) => void onPlanTemplateChange(e.target.value)}><option value="IRRIGATE">灌溉</option><option value="SPRAY">喷洒</option><option value="PLOW">翻地</option></select></label>
            <label className="field"><span>标题</span><input value={planTitle} onChange={(e) => setPlanTitle(e.target.value)} /></label>
            <label className="field"><span>开始时间</span><input type="datetime-local" value={planStart} onChange={(e) => setPlanStart(e.target.value)} /></label>
            <label className="field"><span>结束时间</span><input type="datetime-local" value={planEnd} onChange={(e) => setPlanEnd(e.target.value)} /></label>
            <label className="field" style={{ gridColumn: "1 / -1" }}><span>计划参数 JSON</span><textarea rows={6} value={planParametersText} onChange={(e) => setPlanParametersText(e.target.value)} /></label>
          </div>
          <div className="heroActions" style={{ marginTop: 14 }}>
            <button className="btn btnPrimary" onClick={() => void onCreatePlan()} disabled={loading}>创建计划</button>
            <div className="metaText">OperationPlan v1 会先落计划对象，再由人工带入审批。</div>
          </div>

          <div className="tableWrap" style={{ marginTop: 18 }}>
            <table className="tableCompact">
              <thead><tr><th>计划</th><th>田块</th><th>模板</th><th>状态</th><th>开始</th><th>操作</th></tr></thead>
              <tbody>
                {plans.length < 1 ? <tr><td colSpan={6}>暂无计划。</td></tr> : plans.map((item) => (
                  <tr key={item.plan_id}>
                    <td><button className="btn btnLink" onClick={() => setSelectedPlanId(item.plan_id)}>{item.title}</button><div className="metaText">{item.plan_id}</div></td>
                    <td>{item.field_id}</td>
                    <td>{item.template_code}</td>
                    <td><span className="pill">{item.status}</span></td>
                    <td>{fmtTs(item.scheduled_start_ts_ms)}</td>
                    <td className="actionsRow">
                      <button className="btn" onClick={() => void onUsePlanForApproval(item.plan_id)}>带入审批向导</button>
                      {item.status === "DRAFT" ? <button className="btn" onClick={() => void onPlanStatus(item.plan_id, "READY")}>置为 READY</button> : null}
                      {!item.approval_request_id ? <button className="btn btnPrimary" onClick={() => void onPlanSubmitApproval(item.plan_id)} disabled={session?.role !== "admin"}>提交审批</button> : null}
                      {item.status !== "ARCHIVED" ? <button className="btn" onClick={() => void onPlanStatus(item.plan_id, "ARCHIVED")}>归档</button> : null}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        <div className="card sectionBlock">
          <div className="sectionHeader">
            <div>
              <div className="sectionTitle">计划详情</div>
              <div className="sectionDesc">查看计划参数快照、审批关联和执行回执，减少在多个页面来回切换。</div>
            </div>
          </div>
          {selectedPlan ? (
            <div className="stackList compactList modernList">
              <div className="moduleCard">
                <div className="moduleTitle">{selectedPlan.title}</div>
                <div className="snapshotMeta">{selectedPlan.plan_id}</div>
                <div className="planSteps" style={{ marginTop: 10 }}>
                  {planSteps.map((step) => <span key={step.label} className={`pill ${step.done ? "pillSuccess" : ""} ${step.active ? "pillActive" : ""}`}>{step.label}</span>)}
                </div>
                <div className="timelineList">
                  <div className="timelineItem"><div>状态</div><div>{selectedPlan.status}</div></div>
                  <div className="timelineItem"><div>田块</div><div>{selectedPlan.field_id}</div></div>
                  <div className="timelineItem"><div>模板</div><div>{selectedPlan.template_code}</div></div>
                  <div className="timelineItem"><div>审批</div><div>{selectedPlan.approval_request_id || "未关联"}</div></div>
                  <div className="timelineItem"><div>审批结果</div><div>{selectedPlan.approval_status || "PENDING / 未决策"}</div></div>
                  <div className="timelineItem"><div>任务</div><div>{selectedPlan.act_task_id || "未生成"}</div></div>
                  <div className="timelineItem"><div>队列</div><div>{selectedPlan.queue_state || "未入队"}</div></div>
                  <div className="timelineItem"><div>回执</div><div>{selectedPlan.latest_receipt_status || "无"}</div></div>
                </div>
                <div className="heroActions" style={{ marginTop: 14 }}>
                  {selectedPlan.approval_request_id && selectedPlan.approval_status === "PENDING" ? (<>
                    <button className="btn btnPrimary" onClick={() => void onDecide(String(selectedPlan.approval_request_id), "APPROVE")} disabled={session?.role !== "admin"}>批准并生成任务</button>
                    <button className="btn" onClick={() => void onDecide(String(selectedPlan.approval_request_id), "REJECT")} disabled={session?.role !== "admin"}>驳回计划</button>
                  </>) : null}
                  {selectedPlan.act_task_id ? <button className="btn" onClick={() => void onDispatch(String(selectedPlan.act_task_id))}>下发任务</button> : null}
                  {selectedPlan.act_task_id ? <button className="btn" onClick={() => void onRetry(String(selectedPlan.act_task_id))}>重试下发</button> : null}
                </div>
              </div>
              <pre className="codeBlock">{shortJson(selectedPlan.plan_payload)}</pre>
            </div>
          ) : <div className="metaText">暂无计划。</div>}
        </div>
      </section>

      <section className="contentGridTwo alignStart">
        <div className="card sectionBlock">
          <div className="sectionHeader">
            <div>
              <div className="sectionTitle">审批控制台</div>
              <div className="sectionDesc">可以直接发起审批，也可以从左侧计划一键带入，保持计划对象与审批链的显式关联。</div>
            </div>
          </div>
          <div className="formGrid twoCols">
            <label className="field"><span>发起人</span><input value={issuer} onChange={(e) => setIssuer(e.target.value)} /></label>
            <label className="field"><span>模板</span><select value={actionType} onChange={(e) => void onTemplateChange(e.target.value)}><option value="IRRIGATE">灌溉</option><option value="SPRAY">喷洒</option><option value="PLOW">翻地</option><option value="HARROW">耙地</option><option value="HARVEST">采收</option></select></label>
            <label className="field"><span>目标</span><input value={targetText} onChange={(e) => setTargetText(e.target.value)} placeholder="field_c8_demo" /></label>
            <label className="field"><span>设备</span><input value={requestDeviceId} onChange={(e) => setRequestDeviceId(e.target.value)} placeholder="dev_demo" /></label>
            <label className="field" style={{ gridColumn: "1 / -1" }}><span>参数 JSON</span><textarea rows={6} value={parametersText} onChange={(e) => setParametersText(e.target.value)} /></label>
          </div>
          <div className="heroActions" style={{ marginTop: 14 }}>
            <button className="btn btnPrimary" onClick={() => void onCreateApproval()} disabled={loading || session?.role === "operator"}>提交审批</button>
            <button className="btn" onClick={() => setSelectedPlanId("")}>清空计划关联</button>
            <div className="metaText">当前角色：{session?.role === "admin" ? "管理员" : session?.role === "operator" ? "操作员" : "未识别"}</div>
          </div>
          <div className="metaText" style={{ marginTop: 10 }}>当前关联计划：{selectedPlanId || "无"}</div>

          <div className="tableWrap" style={{ marginTop: 18 }}>
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

        <div className="card sectionBlock">
          <div className="sectionHeader">
            <div>
              <div className="sectionTitle">执行监控</div>
              <div className="sectionDesc">保留显式下发与失败重试，不在本轮引入自动抢任务或隐藏编排。</div>
            </div>
          </div>
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
