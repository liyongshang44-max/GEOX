import React from "react";
import { ackAlert, ALERT_SEVERITY, ALERT_STATUS, fetchAlerts, fetchAlertSummary, resolveAlert, type AlertStatus, type AlertV1 } from "../../../api";

function fmtTs(iso: string | null | undefined): string {
  if (!iso) return "-";
  const ts = Date.parse(String(iso));
  if (!Number.isFinite(ts) || ts <= 0) return "-";
  return new Date(ts).toLocaleString("zh-CN", { hour12: false });
}

export default function AlertsPage(): React.ReactElement {
  const [items, setItems] = React.useState<AlertV1[]>([]);
  const [busy, setBusy] = React.useState(false);
  const [statusText, setStatusText] = React.useState("正在准备告警中心...");
  const [lastAction, setLastAction] = React.useState("-");
  const [severityFilter, setSeverityFilter] = React.useState<"" | keyof typeof ALERT_SEVERITY>("");
  const [statusFilter, setStatusFilter] = React.useState<"" | keyof typeof ALERT_STATUS>("");
  const [categoryFilter, setCategoryFilter] = React.useState("");
  const [summary, setSummary] = React.useState<{ total: number; byStatus: Record<string, number>; bySeverity: Record<string, number> }>({
    total: 0,
    byStatus: {},
    bySeverity: {},
  });

  async function refresh(): Promise<void> {
    setBusy(true);
    setStatusText("正在同步 AlertV1 列表...");
    try {
      const params = {
        severity: severityFilter || undefined,
        status: statusFilter || undefined,
        category: categoryFilter.trim() || undefined,
      };
      const [nextItems, nextSummary] = await Promise.all([fetchAlerts(params), fetchAlertSummary(params)]);
      setItems(nextItems);
      setSummary({
        total: Number(nextSummary.total ?? 0),
        byStatus: nextSummary.by_status ?? {},
        bySeverity: nextSummary.by_severity ?? {},
      });
      setStatusText(`已加载 ${nextItems.length} 条告警。`);
    } catch (e: any) {
      setStatusText(`读取失败：${e?.message || String(e)}`);
    } finally {
      setBusy(false);
    }
  }

  async function handleAck(alertId: string): Promise<void> {
    setBusy(true);
    setLastAction(`正在确认 ${alertId} ...`);
    try {
      await ackAlert(alertId);
      setLastAction(`已确认：${alertId}`);
      await refresh();
    } catch (e: any) {
      setLastAction(`确认失败：${e?.message || String(e)}`);
    } finally {
      setBusy(false);
    }
  }

  async function handleResolve(alertId: string): Promise<void> {
    setBusy(true);
    setLastAction(`正在关闭 ${alertId} ...`);
    try {
      await resolveAlert(alertId);
      setLastAction(`已关闭：${alertId}`);
      await refresh();
    } catch (e: any) {
      setLastAction(`关闭失败：${e?.message || String(e)}`);
    } finally {
      setBusy(false);
    }
  }

  React.useEffect(() => {
    void refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="consolePage">
      <section className="hero card compactHero">
        <div>
          <div className="eyebrow">Alerts · V1</div>
          <h2 className="heroTitle">告警中心</h2>
          <p className="heroText">已切换到 /api/v1/alerts（AlertV1）接口，统一按分类、状态与严重度追踪告警并执行确认/关闭动作。</p>
        </div>
        <div className="heroActions">
          <button className="btn primary" onClick={() => void refresh()} disabled={busy}>刷新告警</button>
        </div>
      </section>

      <div className="summaryGrid">
        <div className="metricCard card"><div className="metricLabel">告警总数</div><div className="metricValue">{summary.total}</div><div className="metricHint">当前筛选范围</div></div>
        <div className="metricCard card"><div className="metricLabel">OPEN</div><div className="metricValue">{Number(summary.byStatus.OPEN ?? 0)}</div><div className="metricHint">待处理</div></div>
        <div className="metricCard card"><div className="metricLabel">ACKED</div><div className="metricValue">{Number(summary.byStatus.ACKED ?? 0)}</div><div className="metricHint">已确认</div></div>
        <div className="metricCard card"><div className="metricLabel">CRITICAL</div><div className="metricValue">{Number(summary.bySeverity.CRITICAL ?? 0)}</div><div className="metricHint">高优先级风险</div></div>
      </div>

      <section className="card sectionBlock">
        <div className="sectionHeader"><div><div className="sectionTitle">筛选</div><div className="sectionDesc">按 severity / status / category 过滤 AlertV1。</div></div></div>
        <div className="formGridTwo">
          <label className="field">严重度<select className="input" value={severityFilter} onChange={(e) => setSeverityFilter(e.target.value as "" | keyof typeof ALERT_SEVERITY)}><option value="">全部</option><option value="LOW">LOW</option><option value="MEDIUM">MEDIUM</option><option value="HIGH">HIGH</option><option value="CRITICAL">CRITICAL</option></select></label>
          <label className="field">状态<select className="input" value={statusFilter} onChange={(e) => setStatusFilter(e.target.value as "" | AlertStatus)}><option value="">全部</option><option value="OPEN">OPEN</option><option value="ACKED">ACKED</option><option value="CLOSED">CLOSED</option></select></label>
          <label className="field">分类<input className="input" value={categoryFilter} onChange={(e) => setCategoryFilter(e.target.value)} placeholder="如 DEVICE_HEARTBEAT_STALE" /></label>
        </div>
        <div className="inlineActions"><button className="btn" onClick={() => void refresh()} disabled={busy}>应用筛选</button></div>
        <div className="devBanner">最近动作：{lastAction}</div>
      </section>

      <section className="card sectionBlock">
        <div className="sectionHeader"><div><div className="sectionTitle">AlertV1 列表</div><div className="sectionDesc">显示 category/status/severity/reasons/source_refs 与对象维度。</div></div></div>
        <div className="list modernList">
          {items.map((item) => (
            <div key={item.alert_id} className="infoCard">
              <div className="jobTitleRow"><div><div className="title">{item.category}</div><div className="metaText">{item.alert_id}</div></div><div className={`pill tone-${item.status === "OPEN" ? "bad" : item.status === "ACKED" ? "warn" : "ok"}`}>{item.status}</div></div>
              <div className="meta wrapMeta">
                <span>严重度：{item.severity}</span>
                <span>对象：{item.object_type} / {item.object_id}</span>
                <span>触发时间：{fmtTs(item.triggered_at)}</span>
                <span>原因：{item.reasons?.length ? item.reasons.join(" / ") : "-"}</span>
                <span>证据引用：{item.source_refs?.length ?? 0}</span>
              </div>
              <div className="meta wrapMeta"><span>建议动作：{item.recommended_action || "-"}</span></div>
              <div className="inlineActions"><button className="btn" onClick={() => void handleAck(item.alert_id)} disabled={busy || item.status === "CLOSED"}>确认</button><button className="btn" onClick={() => void handleResolve(item.alert_id)} disabled={busy || item.status === "CLOSED"}>关闭</button></div>
            </div>
          ))}
          {!items.length ? <div className="emptyState">当前没有告警。</div> : null}
        </div>
      </section>

      <section className="card sectionBlock"><div className="sectionDesc">{statusText}</div></section>
    </div>
  );
}
