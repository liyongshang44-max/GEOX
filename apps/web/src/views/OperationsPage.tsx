import React from "react";
import { Link } from "react-router-dom";
import {
  fetchAuthMe,
  fetchOperationsConsole,
  createApproval,
  decideApproval,
  dispatchAoActTask,
  retryAoActTask,
  type AuthMe,
  type OperationsConsoleResponse,
} from "../lib/api";
import OperationSummaryStats from "../components/operations/OperationSummaryStats";
import OperationQueueList from "../components/operations/OperationQueueList";
import OperationDetailPanel from "../components/operations/OperationDetailPanel";
import OperationQuickCreate from "../components/operations/OperationQuickCreate";
import { OP_LABELS, buildWorkItems, summarize, type OpsLang, type OperationWorkItem, type WorkTab } from "../lib/operationViewModel";

function getStoredToken(): string {
  try { return localStorage.getItem("geox_ao_act_token") || "dev_ao_act_admin_v0"; } catch { return "dev_ao_act_admin_v0"; }
}

function presetTemplate(actionType: string): { parameters: any; device_id?: string } {
  if (actionType === "IRRIGATE") return { parameters: { duration_min: 15, flow_rate: 12 } };
  if (actionType === "SPRAY") return { parameters: { dose_ml: 120, speed_kmh: 4 } };
  if (actionType === "PLOW") return { parameters: { depth_cm: 18, speed_kmh: 5 }, device_id: "dev_demo" };
  return { parameters: { duration_min: 10 } };
}

export default function OperationsPage(): React.ReactElement {
  const [token] = React.useState<string>(getStoredToken());
  const [session, setSession] = React.useState<AuthMe | null>(null);
  const [consoleData, setConsoleData] = React.useState<OperationsConsoleResponse | null>(null);
  const [statusText, setStatusText] = React.useState<string>("");
  const [loading, setLoading] = React.useState<boolean>(false);
  const [lang, setLang] = React.useState<OpsLang>(() => (typeof navigator !== "undefined" && navigator.language.toLowerCase().startsWith("zh") ? "zh" : "en"));
  const [activeTab, setActiveTab] = React.useState<WorkTab>("pending_approval");
  const [selectedKey, setSelectedKey] = React.useState<string>("");

  const [issuer, setIssuer] = React.useState("manual");
  const [actionType, setActionType] = React.useState("IRRIGATE");
  const [targetText, setTargetText] = React.useState("field_demo");
  const [requestDeviceId, setRequestDeviceId] = React.useState("");
  const [parametersText, setParametersText] = React.useState(JSON.stringify(presetTemplate("IRRIGATE").parameters));
  const [retryDeviceId, setRetryDeviceId] = React.useState("dev_demo");

  const labels = OP_LABELS[lang];
  const isDev = Boolean(import.meta.env.DEV);

  async function refresh(): Promise<void> {
    setLoading(true);
    try {
      const [me, overview] = await Promise.all([fetchAuthMe(token), fetchOperationsConsole(token)]);
      setSession(me);
      setConsoleData(overview);
      setStatusText(`${labels.refresh} OK`);
    } catch (e: any) {
      setStatusText(e?.bodyText || e?.message || String(e));
    } finally {
      setLoading(false);
    }
  }

  React.useEffect(() => {
    void refresh();
  }, []);

  const items = React.useMemo(() => buildWorkItems(consoleData, lang), [consoleData, lang]);
  const stats = React.useMemo(() => summarize(items), [items]);
  const queueItems = React.useMemo(() => items.filter((x) => x.status === activeTab), [activeTab, items]);

  React.useEffect(() => {
    if (!queueItems.length) {
      setSelectedKey("");
      return;
    }
    setSelectedKey((prev) => (prev && queueItems.some((x) => x.key === prev) ? prev : queueItems[0].key));
  }, [queueItems]);

  const selectedItem = React.useMemo(() => items.find((x) => x.key === selectedKey) || null, [items, selectedKey]);

  async function onCreateApproval(): Promise<void> {
    if (session?.role === "operator") {
      setStatusText(lang === "zh" ? "当前角色不能新建作业。" : "Current role cannot create operation.");
      return;
    }
    try {
      const parsedParameters = JSON.parse(parametersText || "{}");
      await createApproval(token, {
        issuer,
        action_type: actionType,
        target: targetText.trim(),
        time_window: { start_ts: Date.now() - 60_000, end_ts: Date.now() + 3_600_000 },
        parameter_schema: { keys: Object.keys(parsedParameters).map((name) => ({ name, type: typeof parsedParameters[name] === "number" ? "number" : typeof parsedParameters[name] === "boolean" ? "boolean" : "string" })) },
        parameters: parsedParameters,
        constraints: {},
        meta: requestDeviceId.trim() ? { device_id: requestDeviceId.trim() } : {},
      });
      setStatusText(labels.createdStatus);
      await refresh();
    } catch (e: any) {
      setStatusText(e?.bodyText || e?.message || String(e));
    }
  }

  function onTemplateChange(next: string): void {
    setActionType(next);
    const preset = presetTemplate(next);
    setParametersText(JSON.stringify(preset.parameters));
    if (preset.device_id) setRequestDeviceId(preset.device_id);
  }

  async function onPrimaryAction(item: OperationWorkItem): Promise<void> {
    try {
      if (item.status === "pending_approval" && item.approvalId) {
        await decideApproval(token, item.approvalId, { decision: "APPROVE", reason: "approved in operations console" });
      } else if (item.status === "ready_to_dispatch" && item.taskId) {
        await dispatchAoActTask(token, item.taskId, {});
      } else if (item.status === "failed" && item.taskId) {
        await retryAoActTask(token, item.taskId, { device_id: retryDeviceId || undefined, retry_reason: "manual_retry" });
      }
      await refresh();
    } catch (e: any) {
      setStatusText(e?.bodyText || e?.message || String(e));
    }
  }

  async function onCopy(text: string): Promise<void> {
    if (!text) return;
    try {
      await navigator.clipboard.writeText(text);
      setStatusText("copied");
    } catch {
      setStatusText("copy failed");
    }
  }

  const roleText = lang === "zh"
    ? `当前角色：${session?.role === "admin" ? "管理员" : session?.role === "operator" ? "操作员" : "未识别"}`
    : `Current role: ${session?.role || "unknown"}`;

  return (
    <div style={{ display: "grid", gap: 14 }}>
      <section className="card" style={{ padding: 16 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 12, flexWrap: "wrap" }}>
          <div>
            <h2 style={{ margin: 0, fontSize: 18 }}>{labels.pageTitle}</h2>
            <div className="muted" style={{ marginTop: 4 }}>{labels.pageDesc}</div>
          </div>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            <select className="select" value={lang} onChange={(e) => setLang(e.target.value as OpsLang)}>
              <option value="zh">中文</option>
              <option value="en">English</option>
            </select>
            <button className="btn" onClick={() => void refresh()} disabled={loading}>{labels.refresh}</button>
            <Link className="btn" to="/audit/export">{labels.auditExport}</Link>
            <button className="btn primary" onClick={() => document.getElementById("ops-quick-create")?.scrollIntoView({ behavior: "smooth" })}>{labels.createOperation}</button>
          </div>
        </div>
      </section>

      <OperationSummaryStats labels={labels} stats={stats} />

      <section style={{ display: "grid", gridTemplateColumns: "1.2fr 0.8fr", gap: 14 }}>
        <div>
          <h3 style={{ margin: "0 0 8px 0" }}>{labels.queueTitle}</h3>
          <OperationQueueList
            labels={labels}
            tab={activeTab}
            onTabChange={setActiveTab}
            items={queueItems}
            selectedKey={selectedKey}
            onSelect={(item) => setSelectedKey(item.key)}
            onPrimary={(item) => void onPrimaryAction(item)}
          />
        </div>
        <OperationDetailPanel item={selectedItem} labels={labels} isDev={isDev} onCopy={(text) => void onCopy(text)} />
      </section>

      <div id="ops-quick-create">
        <OperationQuickCreate
          labels={labels}
          issuer={issuer}
          actionType={actionType}
          targetText={targetText}
          requestDeviceId={requestDeviceId}
          parametersText={parametersText}
          roleText={roleText}
          disabled={loading || session?.role === "operator"}
          onIssuer={setIssuer}
          onActionType={onTemplateChange}
          onTargetText={setTargetText}
          onDevice={setRequestDeviceId}
          onParameters={setParametersText}
          onCreate={() => void onCreateApproval()}
        />
      </div>

      <section className="card" style={{ padding: 12 }}>
        <div className="muted">{statusText || "-"}</div>
      </section>
    </div>
  );
}
