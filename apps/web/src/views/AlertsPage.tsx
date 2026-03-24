// GEOX/apps/web/src/views/AlertsPage.tsx
import React from "react";
import { useSession } from "../auth/useSession"; // React hooks for alerts page.
import { ackAlertEvent, closeAlertEvent, createAlertRule, disableAlertRule, fetchAlertEvents, fetchAlertNotifications, fetchAlertRules, type AlertEventItem, type AlertEventStatus, type AlertNotificationItem, type AlertObjectType, type AlertRuleItem, type AlertRuleStatus } from "../lib/api"; // Alerts APIs.

const TOKEN_KEY = "geox_delivery_token_v1"; // Shared token storage key.

function fmtTs(v: number | null | undefined): string { // Format timestamp for Chinese UI.
  if (typeof v !== "number" || !Number.isFinite(v) || v <= 0) return "-"; // Missing => dash.
  return new Date(v).toLocaleString("zh-CN", { hour12: false }); // Render Chinese datetime.
} // End helper.

function parseLastValue(raw: string | null): string { // Format snapshot json for list card.
  if (!raw) return "-"; // Missing => dash.
  try { // Parse JSON snapshot when possible.
    const obj = JSON.parse(raw) as any; // Parse payload.
    if (typeof obj?.value_num === "number") return `${obj.value_num}`; // Prefer numeric value.
    if (typeof obj?.value_text === "string" && obj.value_text.trim()) return obj.value_text; // Fallback text value.
    if (typeof obj?.last_heartbeat_ts_ms === "number") return `心跳：${fmtTs(obj.last_heartbeat_ts_ms)}`; // Offline snapshot rendering.
    return JSON.stringify(obj); // Generic fallback.
  } catch { // Parse error branch.
    return raw; // Return original string.
  } // End try/catch.
} // End helper.

function parseNotifyChannels(raw: string | null | undefined): string { // Render rule notification channels.
  if (!raw || !raw.trim()) return "-";
  try {
    const arr = JSON.parse(raw);
    if (!Array.isArray(arr) || arr.length === 0) return "-";
    return arr.join(" / ");
  } catch {
    return raw;
  }
} // End helper.

export default function AlertsPage(): React.ReactElement { // Alerts commercial page.
  const { token, setToken } = useSession(); // Token state.
  const [rules, setRules] = React.useState<AlertRuleItem[]>([]); // Rule list.
  const [events, setEvents] = React.useState<AlertEventItem[]>([]); // Event list.
  const [notifications, setNotifications] = React.useState<AlertNotificationItem[]>([]); // Minimal notification records.
  const [busy, setBusy] = React.useState<boolean>(false); // Busy flag.
  const [status, setStatus] = React.useState<string>("正在准备告警中心..."); // Page status text.
  const [ruleStatusFilter, setRuleStatusFilter] = React.useState<AlertRuleStatus | "">(""); // Rule status filter.
  const [eventStatusFilter, setEventStatusFilter] = React.useState<AlertEventStatus | "">(""); // Event status filter.
  const [objectTypeFilter, setObjectTypeFilter] = React.useState<AlertObjectType | "">(""); // Shared object type filter.
  const [objectIdFilter, setObjectIdFilter] = React.useState<string>(""); // Shared object id filter.
  const [createObjectType, setCreateObjectType] = React.useState<AlertObjectType>("DEVICE"); // Create form object type.
  const [createObjectId, setCreateObjectId] = React.useState<string>("dev_d1_demo"); // Create form object id.
  const [createMetric, setCreateMetric] = React.useState<string>("soil_temp"); // Create form metric.
  const [createOperator, setCreateOperator] = React.useState<"LT" | "GT" | "LTE" | "GTE" | "EQ">("GT"); // Create form operator.
  const [createThreshold, setCreateThreshold] = React.useState<string>("30"); // Create form threshold.
  const [createNotifyInApp, setCreateNotifyInApp] = React.useState<boolean>(true); // In-app notification toggle.
  const [createNotifyWebhook, setCreateNotifyWebhook] = React.useState<boolean>(false); // Webhook notification toggle.
  const [lastAction, setLastAction] = React.useState<string>("-"); // Last action feedback.

  
  async function refresh(): Promise<void> { // Load rules and events together.
    setBusy(true); // Enter busy state.
    setStatus("正在同步告警规则与事件..."); // Loading message.
    try { // Fetch rule/event lists.
      const nextRules = await fetchAlertRules(token, { status: ruleStatusFilter, object_type: objectTypeFilter, object_id: objectIdFilter || undefined }); // Load rules.
      const nextEvents = await fetchAlertEvents(token, { status: eventStatusFilter, object_type: objectTypeFilter, object_id: objectIdFilter || undefined }); // Load events.
      const nextNotifications = await fetchAlertNotifications(token); // Load minimal notification records.
      setRules(nextRules); // Save rules.
      setEvents(nextEvents); // Save events.
      setNotifications(nextNotifications); // Save notifications.
      setStatus(`已加载 ${nextRules.length} 条规则 / ${nextEvents.length} 条事件 / ${nextNotifications.length} 条通知。`); // Success message.
    } catch (e: any) { // Error path.
      setStatus(`读取失败：${e?.message || String(e)}`); // Surface error text.
    } finally { // Always clear busy flag.
      setBusy(false); // Leave busy state.
    } // End try/finally.
  } // End helper.

  async function handleCreateRule(): Promise<void> { // Create rule from form.
    setBusy(true); // Enter busy state.
    setLastAction("正在创建规则..."); // Action feedback.
    try { // Create rule via API.
      const thresholdNum = Number(createThreshold); // Parse threshold.
      const result = await createAlertRule(token, { // Submit create request.
        object_type: createObjectType, // Target type.
        object_id: createObjectId.trim(), // Target id.
        metric: createMetric.trim(), // Metric.
        operator: createOperator, // Operator.
        threshold_num: Number.isFinite(thresholdNum) ? thresholdNum : null, // Numeric threshold.
        notify_channels: [createNotifyInApp ? "INAPP" : null, createNotifyWebhook ? "WEBHOOK" : null].filter(Boolean) as Array<"INAPP" | "WEBHOOK">, // Minimal notification channels.
      }); // End request.
      setLastAction(result.immediate_event_id ? `规则已创建，并立即产生事件 ${result.immediate_event_id}` : `规则已创建：${result.rule_id}`); // Feedback text.
      await refresh(); // Reload lists.
    } catch (e: any) { // Error path.
      setLastAction(`创建失败：${e?.message || String(e)}`); // Surface error.
    } finally { // Always clear busy flag.
      setBusy(false); // Leave busy state.
    } // End try/finally.
  } // End helper.

  async function handleDisableRule(ruleId: string): Promise<void> { // Disable selected rule.
    setBusy(true); // Enter busy state.
    setLastAction(`正在停用规则 ${ruleId} ...`); // Action feedback.
    try { // Call disable API.
      await disableAlertRule(token, ruleId); // Disable rule.
      setLastAction(`规则已停用：${ruleId}`); // Feedback.
      await refresh(); // Reload lists.
    } catch (e: any) { // Error path.
      setLastAction(`停用失败：${e?.message || String(e)}`); // Surface error.
    } finally { // Always clear busy flag.
      setBusy(false); // Leave busy state.
    } // End try/finally.
  } // End helper.

  async function handleAck(eventId: string): Promise<void> { // Ack selected event.
    setBusy(true); // Enter busy state.
    setLastAction(`正在确认事件 ${eventId} ...`); // Action feedback.
    try { // Call ack API.
      await ackAlertEvent(token, eventId); // Ack event.
      setLastAction(`事件已确认：${eventId}`); // Feedback.
      await refresh(); // Reload lists.
    } catch (e: any) { // Error path.
      setLastAction(`确认失败：${e?.message || String(e)}`); // Surface error.
    } finally { // Always clear busy flag.
      setBusy(false); // Leave busy state.
    } // End try/finally.
  } // End helper.

  async function handleClose(eventId: string): Promise<void> { // Close selected event.
    setBusy(true); // Enter busy state.
    setLastAction(`正在关闭事件 ${eventId} ...`); // Action feedback.
    try { // Call close API.
      await closeAlertEvent(token, eventId); // Close event.
      setLastAction(`事件已关闭：${eventId}`); // Feedback.
      await refresh(); // Reload lists.
    } catch (e: any) { // Error path.
      setLastAction(`关闭失败：${e?.message || String(e)}`); // Surface error.
    } finally { // Always clear busy flag.
      setBusy(false); // Leave busy state.
    } // End try/finally.
  } // End helper.

  React.useEffect(() => { // Initial load on mount.
    void refresh(); // Load first screen.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // End effect.

  return (
    <div className="consolePage">
      <section className="hero card compactHero">
        <div>
          <div className="eyebrow">Alerts · Sprint A1</div>
          <h2 className="heroTitle">告警中心</h2>
          <p className="heroText">本轮把告警补到最小通知闭环：规则可带通知渠道，事件触发后会留下通知记录，先不扩展到真实外发平台。</p>
        </div>
        <div className="heroActions">
          <button className="btn primary" onClick={() => void refresh()} disabled={busy}>刷新告警</button>
        </div>
      </section>

      <div className="summaryGrid">
        <div className="metricCard card"><div className="metricLabel">规则总数</div><div className="metricValue">{rules.length}</div><div className="metricHint">当前筛选范围内的规则</div></div>
        <div className="metricCard card"><div className="metricLabel">开放事件</div><div className="metricValue">{events.filter((x) => x.status === "OPEN").length}</div><div className="metricHint">仍待处理的告警</div></div>
        <div className="metricCard card"><div className="metricLabel">已确认事件</div><div className="metricValue">{events.filter((x) => x.status === "ACKED").length}</div><div className="metricHint">已确认，未关闭</div></div>
        <div className="metricCard card"><div className="metricLabel">通知记录</div><div className="metricValue">{notifications.length}</div><div className="metricHint">触发后留痕的最小通知记录</div></div>
      </div>

      <div className="contentGridTwo alignStart">
        <section className="card sectionBlock">
          <div className="sectionHeader"><div><div className="sectionTitle">创建规则</div><div className="sectionDesc">先支持最小阈值规则和最小通知渠道。若设备当前最新遥测已越过阈值，会立即生成事件并写入通知记录。</div></div></div>
          <label className="field">访问令牌<input className="input" value={token} onChange={(e) => setToken(e.target.value)} /></label>
          <div className="formGridTwo">
            <label className="field">对象类型<select className="input" value={createObjectType} onChange={(e) => setCreateObjectType(e.target.value as AlertObjectType)}><option value="DEVICE">DEVICE</option><option value="FIELD">FIELD</option></select></label>
            <label className="field">对象 ID<input className="input" value={createObjectId} onChange={(e) => setCreateObjectId(e.target.value)} /></label>
            <label className="field">指标<input className="input" value={createMetric} onChange={(e) => setCreateMetric(e.target.value)} /></label>
            <label className="field">比较符<select className="input" value={createOperator} onChange={(e) => setCreateOperator(e.target.value as any)}><option value="GT">GT</option><option value="GTE">GTE</option><option value="LT">LT</option><option value="LTE">LTE</option><option value="EQ">EQ</option></select></label>
            <label className="field">阈值<input className="input" value={createThreshold} onChange={(e) => setCreateThreshold(e.target.value)} /></label>
          </div>
          <div className="inlineActions" style={{ gap: 16, flexWrap: "wrap" }}>
            <label className="checkboxRow"><input type="checkbox" checked={createNotifyInApp} onChange={(e) => setCreateNotifyInApp(e.target.checked)} />站内记录通知</label>
            <label className="checkboxRow"><input type="checkbox" checked={createNotifyWebhook} onChange={(e) => setCreateNotifyWebhook(e.target.checked)} />Webhook 记录</label>
          </div>
          <div className="inlineActions"><button className="btn primary" onClick={() => void handleCreateRule()} disabled={busy}>创建规则</button></div>
          <div className="devBanner">最近动作：{lastAction}</div>
        </section>

        <section className="card sectionBlock">
          <div className="sectionHeader"><div><div className="sectionTitle">筛选</div><div className="sectionDesc">规则和事件共用对象维度筛选；状态分别独立，便于运营快速定位问题范围。</div></div></div>
          <div className="formGridTwo">
            <label className="field">规则状态<select className="input" value={ruleStatusFilter} onChange={(e) => setRuleStatusFilter(e.target.value as AlertRuleStatus | "")}><option value="">全部</option><option value="ACTIVE">ACTIVE</option><option value="DISABLED">DISABLED</option></select></label>
            <label className="field">事件状态<select className="input" value={eventStatusFilter} onChange={(e) => setEventStatusFilter(e.target.value as AlertEventStatus | "")}><option value="">全部</option><option value="OPEN">OPEN</option><option value="ACKED">ACKED</option><option value="CLOSED">CLOSED</option></select></label>
            <label className="field">对象类型<select className="input" value={objectTypeFilter} onChange={(e) => setObjectTypeFilter(e.target.value as AlertObjectType | "")}><option value="">全部</option><option value="DEVICE">DEVICE</option><option value="FIELD">FIELD</option></select></label>
            <label className="field">对象 ID<input className="input" value={objectIdFilter} onChange={(e) => setObjectIdFilter(e.target.value)} /></label>
          </div>
          <div className="inlineActions"><button className="btn" onClick={() => void refresh()} disabled={busy}>应用筛选</button></div>
        </section>
      </div>

      <div className="contentGridTwo alignStart">
        <section className="card sectionBlock">
          <div className="sectionHeader"><div><div className="sectionTitle">规则列表</div><div className="sectionDesc">规则先支持停用，不在本轮扩展复杂编辑器。</div></div></div>
          <div className="list modernList">
            {rules.map((rule) => (
              <div key={rule.rule_id} className="infoCard">
                <div className="jobTitleRow"><div><div className="title">{rule.metric}</div><div className="metaText">{rule.rule_id}</div></div><div className={`pill tone-${rule.status === "ACTIVE" ? "ok" : "warn"}`}>{rule.status}</div></div>
                <div className="meta wrapMeta"><span>{rule.object_type}：{rule.object_id}</span><span>条件：{rule.operator} {rule.threshold_num ?? rule.threshold_ms ?? "-"}</span><span>通知：{parseNotifyChannels(rule.notify_channels_json)}</span><span>更新时间：{fmtTs(rule.updated_ts_ms)}</span></div>
                <div className="inlineActions"><button className="btn" onClick={() => void handleDisableRule(rule.rule_id)} disabled={busy || rule.status !== "ACTIVE"}>停用规则</button></div>
              </div>
            ))}
            {!rules.length ? <div className="emptyState">当前没有规则。可先针对设备温度或湿度创建一条阈值规则。</div> : null}
          </div>
        </section>

        <section className="card sectionBlock">
          <div className="sectionHeader"><div><div className="sectionTitle">事件列表</div><div className="sectionDesc">事件支持确认和关闭，帮助运营把告警从“发现”推进到“处理完成”。</div></div></div>
          <div className="list modernList">
            {events.map((event) => (
              <div key={event.event_id} className="infoCard">
                <div className="jobTitleRow"><div><div className="title">{event.metric}</div><div className="metaText">{event.event_id}</div></div><div className={`pill tone-${event.status === "OPEN" ? "bad" : event.status === "ACKED" ? "warn" : "ok"}`}>{event.status}</div></div>
                <div className="meta wrapMeta"><span>{event.object_type}：{event.object_id}</span><span>规则：{event.rule_id}</span><span>触发值：{parseLastValue(event.last_value_json)}</span><span>触发时间：{fmtTs(event.raised_ts_ms)}</span></div>
                <div className="inlineActions"><button className="btn" onClick={() => void handleAck(event.event_id)} disabled={busy || event.status === "CLOSED"}>确认</button><button className="btn" onClick={() => void handleClose(event.event_id)} disabled={busy || event.status === "CLOSED"}>关闭</button></div>
              </div>
            ))}
            {!events.length ? <div className="emptyState">当前没有事件。若要立即演示，可先插入一条超阈值遥测，再创建对应规则。</div> : null}
          </div>
        </section>
      </div>

      <section className="card sectionBlock">
        <div className="sectionHeader"><div><div className="sectionTitle">通知记录</div><div className="sectionDesc">这是本轮最小通知闭环：当事件触发后，系统会按规则中的渠道配置记录一条通知留痕。</div></div></div>
        <div className="list modernList">
          {notifications.map((item) => (
            <div key={item.notification_id} className="infoCard">
              <div className="jobTitleRow"><div><div className="title">{item.channel}</div><div className="metaText">{item.notification_id}</div></div><div className="pill tone-ok">{item.status}</div></div>
              <div className="meta wrapMeta"><span>事件：{item.event_id}</span><span>规则：{item.rule_id}</span><span>时间：{fmtTs(item.created_ts_ms)}</span></div>
            </div>
          ))}
          {!notifications.length ? <div className="emptyState">当前没有通知记录。创建带通知渠道的规则并触发事件后，会在这里出现留痕。</div> : null}
        </div>
      </section>
    </div>
  );
} // End page.
